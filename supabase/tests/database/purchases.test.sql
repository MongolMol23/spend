begin;
set local search_path = public, extensions;
select plan(27);

insert into auth.users (id, email, email_confirmed_at) values
  ('00000000-0000-4000-8000-000000000041', 'purchase-owner@example.test', now()),
  ('00000000-0000-4000-8000-000000000042', 'purchase-other@example.test', now()),
  ('00000000-0000-4000-8000-000000000043', 'purchase-unconfirmed@example.test', null);

set local role anon;
select throws_ok($$select * from public.expenses$$, '42501', null, 'anon cannot read expenses');
select throws_ok($$select public.expense_month_summary('2026-11-01')$$, '42501', null, 'anon cannot read monthly totals');

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000041';
select lives_ok($$select public.save_expense('00000000-0000-4000-8000-000000000044',
  ' Groceries ', 12345, 'groceries', '2026-11-30', 'ملاحظة خاصة')$$, 'confirmed owner can record a purchase');
select results_eq($$select item, amount_minor, note from public.expenses$$,
  $$values ('Groceries'::text, 12345, 'ملاحظة خاصة'::text)$$, 'purchase stores cents and original Arabic note');
select lives_ok($$select public.save_expense('00000000-0000-4000-8000-000000000044',
  ' Groceries ', 12345, 'groceries', '2026-11-30', 'ملاحظة خاصة')$$, 'lost create response can be retried');
select results_eq($$select action from public.personal_activity$$, $$values ('created'::text)$$, 'retry produces one history entry');
select throws_ok($$select public.save_expense('00000000-0000-4000-8000-000000000044',
  'Different', 12345, 'groceries', '2026-11-30')$$, 'P0001', 'expense_changed', 'a reused key must match the original payload');
select throws_ok($$update public.expenses set amount_minor = 1$$, '42501', null, 'client cannot bypass the purchase API');
select throws_ok($$delete from public.personal_activity$$, '42501', null, 'client cannot erase its history');
select throws_ok($$select public.save_expense('00000000-0000-4000-8000-000000000045',
  'Invalid', 0, 'groceries', '2026-11-30')$$, '23514', null, 'database rejects zero amounts');
select throws_ok($$select public.save_expense('00000000-0000-4000-8000-000000000045',
  'Invalid', 1, 'unknown', '2026-11-30')$$, '23503', null, 'database rejects unknown categories');

select lives_ok($$select public.save_expense('00000000-0000-4000-8000-000000000044',
  'Groceries', 15075, 'groceries', '2026-11-30', p_version => 1)$$, 'owner can edit the current version');
select lives_ok($$select public.save_expense('00000000-0000-4000-8000-000000000044',
  'Groceries', 15075, 'groceries', '2026-11-30', p_version => 1)$$, 'lost edit response can be retried');
select throws_ok($$select public.save_expense('00000000-0000-4000-8000-000000000044',
  'Groceries', 20000, 'groceries', '2026-11-30', p_version => 1)$$, 'P0001', 'expense_changed', 'stale edits cannot overwrite saved changes');
select results_eq(
  $$select before_data->>'amount_minor', after_data->>'amount_minor' from public.personal_activity where action = 'updated'$$,
  $$values ('12345'::text, '15075'::text)$$, 'history records original and corrected amounts exactly once'
);
select lives_ok($$select public.save_expense('00000000-0000-4000-8000-000000000045',
  'Taxi', 5000, 'transport', '2026-12-01')$$, 'owner can record a purchase in the following month');
select results_eq($$select * from public.expense_month_summary('2026-11-01')$$,
  $$values ('groceries'::text, 15075::bigint)$$, 'monthly totals count the current amount and respect the month boundary');

set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000042';
select is_empty($$select * from public.expenses$$, 'another account cannot read expenses');
select is_empty($$select * from public.personal_activity$$, 'another account cannot read purchase history');
select is_empty($$select * from public.expense_month_summary('2026-11-01')$$, 'another account cannot read spending totals');
select throws_ok($$select public.save_expense('00000000-0000-4000-8000-000000000044',
  'Changed', 1, 'groceries', '2026-11-30', p_version => 2)$$, 'P0001', 'expense_changed', 'another account cannot edit the purchase');
select throws_ok($$select public.archive_expense('00000000-0000-4000-8000-000000000044', 2)$$,
  'P0001', 'expense_changed', 'another account cannot archive the purchase');

set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000043';
select throws_ok($$select public.save_expense('00000000-0000-4000-8000-000000000046',
  'Item', 1, 'groceries', '2026-11-30')$$, '42501', 'expense_signin_required', 'unconfirmed accounts cannot save purchases');

set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000041';
select lives_ok($$select public.archive_expense('00000000-0000-4000-8000-000000000044', 2)$$, 'owner can remove the purchase from active spending');
select lives_ok($$select public.archive_expense('00000000-0000-4000-8000-000000000044', 2)$$, 'lost archive response can be retried');
select is_empty($$select * from public.expense_month_summary('2026-11-01')$$, 'archived expenses are excluded from totals');
select results_eq($$select before_data->>'amount_minor', after_data->>'amount_minor' from public.personal_activity where action = 'archived'$$,
  $$values ('15075'::text, '15075'::text)$$, 'archive retains the purchase and original amount in history');

select * from finish();
rollback;
