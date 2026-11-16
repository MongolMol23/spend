begin;
set local search_path = public, extensions;
select plan(21);

insert into auth.users (id, email, email_confirmed_at) values
  ('00000000-0000-4000-8000-000000000081', 'savings-owner@example.test', now()),
  ('00000000-0000-4000-8000-000000000082', 'savings-other@example.test', now()),
  ('00000000-0000-4000-8000-000000000083', 'savings-unconfirmed@example.test', null);

set local role anon;
select throws_ok($$select * from public.savings_overview('2026-11-01')$$, '42501', null, 'anon cannot read savings');
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000083';
select throws_ok($$select public.save_savings_goal('00000000-0000-4000-8000-000000000084', 'Bike', 10000)$$,
  '42501', 'expense_signin_required', 'unconfirmed accounts cannot create goals');

set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000081';
select lives_ok($$select public.save_savings_goal('00000000-0000-4000-8000-000000000084', 'عجلة', 10000)$$,
  'owner can create a goal without a target date');
select lives_ok($$select public.save_savings_goal('00000000-0000-4000-8000-000000000084', 'عجلة', 10000)$$,
  'creation is safe to retry');
select lives_ok($$select public.record_savings_movement('00000000-0000-4000-8000-000000000085',
  '00000000-0000-4000-8000-000000000084', 'deposit', 12000, '2026-11-03')$$, 'deposits can exceed the target');
select lives_ok($$select public.record_savings_movement('00000000-0000-4000-8000-000000000085',
  '00000000-0000-4000-8000-000000000084', 'deposit', 12000, '2026-11-03')$$, 'deposit is safe to retry');
select throws_ok($$select public.record_savings_movement('00000000-0000-4000-8000-000000000086',
  '00000000-0000-4000-8000-000000000084', 'withdraw', 12001, '2026-11-04')$$,
  'P0001', 'savings_insufficient', 'withdrawal cannot exceed the balance');
select lives_ok($$select public.record_savings_movement('00000000-0000-4000-8000-000000000086',
  '00000000-0000-4000-8000-000000000084', 'withdraw', 2500, '2026-11-04')$$, 'owner can withdraw funds');
select is((select saved_minor from public.savings_goals), 9500, 'rejected and retried movements do not change the balance');
select is((select count(*) from public.personal_activity), 3::bigint, 'creation and two movements each have exactly one event');
select results_eq($$select * from public.savings_overview('2026-11-01')$$,
  $$values (9500::bigint, 12000::bigint, 2500::bigint)$$, 'dashboard separates saved, deposited, and withdrawn');
select results_eq($$select * from public.savings_overview('2026-12-01')$$,
  $$values (9500::bigint, 0::bigint, 0::bigint)$$, 'monthly movements are filtered by date');
select lives_ok($$select public.save_savings_goal('00000000-0000-4000-8000-000000000084', 'عجلة', 15000, '2027-01-01', 3)$$,
  'owner can revise the target and date');
select results_eq($$select before_data->>'target_minor', after_data->>'target_minor'
  from public.personal_activity where action = 'updated'$$, $$values ('10000'::text, '15000'::text)$$, 'edit preserves both targets');
select throws_ok($$update public.savings_goals set saved_minor = 1$$, '42501', null, 'balance cannot be written directly');

set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000082';
select is_empty($$select * from public.savings_goals$$, 'another account cannot read goals');
select is_empty($$select * from public.savings_movements$$, 'another account cannot read movements');
select is_empty($$select * from public.personal_activity$$, 'another account cannot read history');
select throws_ok($$select public.record_savings_movement('00000000-0000-4000-8000-000000000087',
  '00000000-0000-4000-8000-000000000084', 'deposit', 1000, '2026-11-05')$$, 'P0001', 'savings_changed', 'another account cannot modify the goal');

set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000081';
select lives_ok($$select public.archive_savings_goal('00000000-0000-4000-8000-000000000084', 4)$$, 'owner can archive a goal');
select results_eq($$select * from public.savings_overview('2026-11-01')$$,
  $$values (0::bigint, 12000::bigint, 2500::bigint)$$, 'archiving removes active balance and retains monthly movement history');

select * from finish();
rollback;
