begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(8);

insert into auth.users (id, email, email_confirmed_at) values
  ('00000000-0000-4000-8000-000000000001', 'owner@example.test', now()),
  ('00000000-0000-4000-8000-000000000002', 'other@example.test', now());

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000001';

select lives_ok($$
  insert into public.profiles (username, display_name, language) values ('owner', 'Owner', 'ar')
$$, 'owner can create their own profile');
select is((select language from public.profiles where username = 'owner'), 'ar', 'owner can read preference');

set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000002';
select is((select count(*) from public.profiles), 0::bigint, 'other account cannot read private profiles');
select is_empty(
  $$update public.profiles set language = 'en' where username = 'owner' returning id$$,
  'other account cannot update profile'
);
select results_eq(
  $$select * from public.find_profile(' OWNER ')$$,
  $$values ('owner'::text, 'Owner'::text)$$,
  'lookup returns only public identity fields'
);
select throws_ok(
  $$insert into public.profiles (username, display_name, language) values ('owner', 'Other', 'en')$$,
  '23505', null, 'duplicate normalized username is rejected'
);

reset role;
set local role anon;
select throws_ok($$select * from public.profiles$$, '42501', null, 'anonymous profile read denied');
select throws_ok($$select * from public.find_profile('owner')$$, '42501', null, 'anonymous lookup denied');
reset role;

select * from finish();
rollback;
