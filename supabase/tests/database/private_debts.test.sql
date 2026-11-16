begin;
set local search_path = public, extensions;
select plan(25);

insert into auth.users (id, email, email_confirmed_at) values
  ('00000000-0000-4000-8000-000000000071', 'debt-owner@example.test', now()),
  ('00000000-0000-4000-8000-000000000072', 'debt-contact@example.test', now()),
  ('00000000-0000-4000-8000-000000000073', 'debt-outsider@example.test', now());
insert into public.profiles (id, username, display_name, language) values
  ('00000000-0000-4000-8000-000000000071', 'debt_owner', 'Owner', 'en'),
  ('00000000-0000-4000-8000-000000000072', 'debt_contact', 'أحمد', 'ar');
insert into public.money_requests (id, sender, recipient, amount_minor, reason, due_date, state) values
  ('00000000-0000-4000-8000-000000000077', '00000000-0000-4000-8000-000000000072',
    '00000000-0000-4000-8000-000000000071', 7000, 'Shared expense', '2026-12-12', 'accepted'),
  ('00000000-0000-4000-8000-000000000078', '00000000-0000-4000-8000-000000000072',
    '00000000-0000-4000-8000-000000000071', 9000, 'Pending expense', null, 'pending');
insert into public.request_payments (request_id, amount_minor, state) values
  ('00000000-0000-4000-8000-000000000077', 2000, 'confirmed'),
  ('00000000-0000-4000-8000-000000000077', 1000, 'pending');

set local role anon;
select throws_ok($$select * from public.private_debts$$, '42501', null, 'anon cannot read private debts');
select throws_ok($$select * from public.debt_overview()$$, '42501', null, 'anon cannot read balances');

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000071';
select lives_ok($$select public.save_private_debt('00000000-0000-4000-8000-000000000074',
  'أحمد', 'owed', 20000, '2026-12-11')$$, 'owner can record a debt by name');
select lives_ok($$select public.save_private_debt('00000000-0000-4000-8000-000000000074',
  'أحمد', 'owed', 20000, '2026-12-11')$$, 'repeating creation is idempotent');
select throws_ok($$select public.save_private_debt('00000000-0000-4000-8000-000000000075',
  'Unlinked contact', 'wrong', 1000)$$, '23514', null, 'unknown directions are rejected');
select lives_ok($$select public.save_private_debt('00000000-0000-4000-8000-000000000075',
  'Unlinked contact', 'owe', 3000)$$, 'the opposite direction can omit a due date');
select results_eq($$select owed_minor, owe_minor, due_source, due_minor, pending_count from public.debt_overview()$$,
  $$values (20000::bigint, 8000::bigint, 'private'::text, 20000::bigint, 1::bigint)$$,
  'dashboard combines distinct balances, subtracts confirmed payments only, and reports pending requests separately');
select lives_ok($$select public.record_private_debt_payment('00000000-0000-4000-8000-000000000076',
  '00000000-0000-4000-8000-000000000074', 5000, '2026-11-09')$$, 'owner records a partial repayment');
select lives_ok($$select public.record_private_debt_payment('00000000-0000-4000-8000-000000000076',
  '00000000-0000-4000-8000-000000000074', 5000, '2026-11-09')$$, 'same repayment can be retried');
select results_eq($$select paid_minor, version from public.private_debts where id = '00000000-0000-4000-8000-000000000074'$$,
  $$values (5000, 2)$$, 'a retry does not increment the balance or revision');
select results_eq($$select after_data->>'remaining_minor' from public.personal_activity where entity_type = 'private_debt_payment'$$,
  $$values ('15000'::text)$$, 'exactly one repayment event stores the remaining balance');
select throws_ok($$select public.record_private_debt_payment('00000000-0000-4000-8000-000000000079',
  '00000000-0000-4000-8000-000000000074', 15001, '2026-11-09')$$,
  'P0001', 'private_debt_payment_exceeds_balance', 'repayment cannot exceed the remainder');
select throws_ok($$select public.save_private_debt('00000000-0000-4000-8000-000000000074',
  'أحمد', 'owe', 20000, p_version => 2)$$, 'P0001', 'private_debt_changed', 'direction stays fixed after repayment');
select throws_ok($$select public.save_private_debt('00000000-0000-4000-8000-000000000074',
  'أحمد', 'owed', 4999, p_version => 2)$$, 'P0001', 'private_debt_changed', 'the new amount must cover repayments');
select lives_ok($$select public.save_private_debt('00000000-0000-4000-8000-000000000074',
  'أحمد', 'owed', 18000, '2026-12-10', 2)$$, 'owner can revise amount and due date');
select results_eq($$select before_data->>'amount_minor', after_data->>'amount_minor'
  from public.personal_activity where entity_type = 'private_debt' and action = 'updated'$$,
  $$values ('20000'::text, '18000'::text)$$, 'edit retains previous and new values');
select throws_ok($$update public.private_debt_payments set amount_minor = 1$$, '42501', null, 'repayments are not directly writable');

set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000072';
select is_empty($$select * from public.private_debts$$, 'matching account name does not grant debt access');
select is_empty($$select * from public.private_debt_payments$$, 'matching account name does not grant repayment access');
select is_empty($$select * from public.personal_activity$$, 'private activity belongs to its owner');
select results_eq($$select owed_minor, owe_minor from public.debt_overview()$$, $$values (5000::bigint, 0::bigint)$$,
  'other participant sees only their shared balance');
select throws_ok($$select public.archive_private_debt('00000000-0000-4000-8000-000000000074', 3)$$,
  'P0001', 'private_debt_changed', 'another account cannot archive the debt');

set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000071';
select lives_ok($$select public.archive_private_debt('00000000-0000-4000-8000-000000000074', 3)$$,
  'owner can archive a debt');
select results_eq($$select owed_minor, owe_minor, due_source from public.debt_overview()$$,
  $$values (0::bigint, 8000::bigint, 'shared'::text)$$, 'archive removes the private balance and exposes the next due shared debt');
select results_eq($$select after_data->>'paid_minor' from public.personal_activity where action = 'archived'$$,
  $$values ('5000'::text)$$, 'archiving keeps the repayment snapshot in history');

select * from finish();
rollback;
