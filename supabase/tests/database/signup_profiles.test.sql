begin;
set local search_path = public, extensions;
select plan(7);

insert into auth.users (id, email, email_confirmed_at) values
  ('00000000-0000-4000-8000-000000000021', 'signup-viewer@example.test', now());
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-000000000022', 'signup-owner@example.test',
    '{"spend_profile":{"username":"Signup_Test","name_ar":"محمد","name_en":"Mohamed","language":"ar"}}');

set local role anon;
select is(public.signup_username_available(' SIGNUP_TEST '), false, 'reserved names are unavailable before confirmation');
select is(public.signup_username_available('another_username'), true, 'a valid unused name is available');
select is(public.signup_username_available('not valid'), false, 'invalid names are unavailable');
reset role;

select results_eq(
  $$select username, name_ar, name_en from public.profiles where id = '00000000-0000-4000-8000-000000000022'$$,
  $$values ('signup_test'::text, 'محمد'::text, 'Mohamed'::text)$$,
  'signup saves both names and normalizes the username'
);

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000021';
select is_empty($$select * from public.find_profile('signup_test')$$, 'unconfirmed profile stays out of lookup');

reset role;
update auth.users set email_confirmed_at = now() where id = '00000000-0000-4000-8000-000000000022';
set local role authenticated;
select results_eq(
  $$select * from public.find_profile(' SIGNUP_TEST ')$$,
  $$values ('signup_test'::text, 'محمد'::text)$$,
  'confirmed profile is discoverable by its normalized username'
);

reset role;
select throws_ok(
  $$insert into auth.users (id, email, raw_user_meta_data) values
    ('00000000-0000-4000-8000-000000000023', 'duplicate-signup@example.test',
      '{"spend_profile":{"username":"signup_test","name_ar":"علي","name_en":"Ali","language":"en"}}')$$,
  '23505', null, 'the signup transaction cannot reserve a duplicate username'
);

select * from finish();
rollback;
