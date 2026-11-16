begin;
set local search_path = public, extensions;
select plan(15);

insert into auth.users (id, email, email_confirmed_at) values
  ('00000000-0000-4000-8000-000000000091', 'installment-owner@example.test', now()),
  ('00000000-0000-4000-8000-000000000092', 'installment-other@example.test', now());

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000091';
select throws_ok($$select save_installment_plan('00000000-0000-4000-8000-000000000093', 'Laptop',
  10000, '[{"due_on":"2000-01-01","amount_minor":5000}]')$$,
  'P0001', 'installment_schedule', 'schedule must equal the plan total');
select lives_ok($$select save_installment_plan('00000000-0000-4000-8000-000000000093', 'Laptop',
  10000, '[{"due_on":"2000-01-01","amount_minor":5000},{"due_on":"2099-01-01","amount_minor":5000}]')$$,
  'owner can create a plan');
select lives_ok($$select record_installment_payment('00000000-0000-4000-8000-000000000094',
  (select id from installment_dues where due_on = '2000-01-01'), 2000, '2026-11-03')$$, 'owner can pay part of a due');
select lives_ok($$select record_installment_payment('00000000-0000-4000-8000-000000000094',
  (select id from installment_dues where due_on = '2000-01-01'), 2000, '2026-11-03')$$, 'payment retry is safe');
select throws_ok($$select record_installment_payment('00000000-0000-4000-8000-000000000095',
  (select id from installment_dues where due_on = '2000-01-01'), 3001, '2026-11-03')$$,
  'P0001', 'installment_payment_exceeds_balance', 'overpayment is rejected');
select throws_ok($$select save_installment_plan('00000000-0000-4000-8000-000000000093', 'Laptop',
  5000, '[{"due_on":"2000-01-01","amount_minor":5000}]', 2)$$,
  'P0001', 'installment_schedule_locked', 'payments lock the schedule');
select results_eq($$select paid_minor, remaining_minor, overdue_minor from installment_overview('2026-11-01')$$,
  $$values (2000::bigint, 8000::bigint, 3000::bigint)$$, 'dashboard separates paid, remaining, and overdue');
select is((select count(*) from personal_activity), 2::bigint, 'payment retry writes one event');
select throws_ok($$update installment_dues set paid_minor = 1$$, '42501', null, 'balances require a payment');

set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000092';
select is_empty($$select * from installment_plans$$, 'another account cannot read plans');
select is_empty($$select * from installment_dues$$, 'another account cannot read the schedule');
select is_empty($$select * from installment_payments$$, 'another account cannot read payments');
select is_empty($$select * from personal_activity$$, 'another account cannot read activity');

set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000091';
select lives_ok($$select archive_installment_plan('00000000-0000-4000-8000-000000000093', 2)$$,
  'owner can archive a plan');
select results_eq($$select paid_minor, remaining_minor, overdue_minor from installment_overview('2026-11-01')$$,
  $$values (2000::bigint, 0::bigint, 0::bigint)$$, 'archiving preserves monthly payments');

select * from finish();
rollback;
