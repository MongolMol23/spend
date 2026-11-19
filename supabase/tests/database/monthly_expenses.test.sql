begin;
set local search_path = public, extensions;
select no_plan();

insert into auth.users(id,email,email_confirmed_at) values
 ('10000000-0000-4000-8000-000000000001','monthly-owner@example.test',now()),
 ('10000000-0000-4000-8000-000000000002','monthly-other@example.test',now());

set local role anon;
select throws_ok($$select public.monthly_expense_list(current_date)$$,'42501',null,'anonymous calls are blocked');
set local role authenticated;
set local request.jwt.claim.sub = '10000000-0000-4000-8000-000000000001';
select lives_ok($$select public.monthly_expense_add('10000000-0000-4000-8000-000000000010',' Internet ',30000,31,'bills')$$,'add recurring item');
select lives_ok($$select public.monthly_expense_add('10000000-0000-4000-8000-000000000010',' Internet ',30000,31,'bills')$$,'retry add is idempotent');
select is((select count(*) from public.monthly_expense_items),1::bigint,'one recurring item');
select throws_ok($$select public.monthly_expense_add('10000000-0000-4000-8000-000000000011','Invalid',0,1,'bills')$$,'23514',null,'zero amount blocked');
select throws_ok($$select public.monthly_expense_add('10000000-0000-4000-8000-000000000011','Invalid',10,32,'bills')$$,'23514',null,'invalid due day blocked');
select lives_ok($$select * from public.monthly_expense_list((now() at time zone 'Africa/Cairo')::date)$$,'create current checklist');
select lives_ok($$select * from public.monthly_expense_list((now() at time zone 'Africa/Cairo')::date)$$,'retry checklist does not duplicate');
select is((select count(*) from public.monthly_expense_dues),1::bigint,'one occurrence per month');
select is_empty($$select * from public.monthly_expense_list('2000-01-01')$$,'items do not appear before start month');
select lives_ok($$select * from public.monthly_expense_list('2028-02-01')$$,'future checklist can be previewed');
select is((select due_on from public.monthly_expense_dues where month='2028-02-01'),'2028-02-29'::date,'31st clamps to leap February end');
select lives_ok($$select public.monthly_expense_pay(
 (select id from public.monthly_expense_dues where month=date_trunc('month',now() at time zone 'Africa/Cairo')::date),
 '10000000-0000-4000-8000-000000000020',32500,(now() at time zone 'Africa/Cairo')::date)$$,'record actual payment');
select lives_ok($$select public.monthly_expense_pay(
 (select id from public.monthly_expense_dues where month=date_trunc('month',now() at time zone 'Africa/Cairo')::date),
 '10000000-0000-4000-8000-000000000020',32500,(now() at time zone 'Africa/Cairo')::date)$$,'retry payment is idempotent');
select is((select count(*) from public.expenses where archived_at is null),1::bigint,'only one purchase is charged');
select is((select sum(total_minor) from public.expense_month_summary((now() at time zone 'Africa/Cairo')::date)),32500::numeric,'actual payment appears in spending totals');
select is((select expected_minor from public.monthly_expense_dues where expense_id is not null),30000,'expected amount stays separate');
select throws_ok($$select public.monthly_expense_pay(
 (select id from public.monthly_expense_dues where month=date_trunc('month',now() at time zone 'Africa/Cairo')::date),
 '10000000-0000-4000-8000-000000000021',32500,(now() at time zone 'Africa/Cairo')::date)$$,'P0001','monthly_already_paid','second operation cannot charge again');
select throws_ok($$select public.monthly_expense_pay(
 (select id from public.monthly_expense_dues where month='2028-02-01'),
 '10000000-0000-4000-8000-000000000021',32500,'2028-02-01')$$,'22023',null,'future payments blocked');
select throws_ok($$select public.monthly_expense_pay(
 (select id from public.monthly_expense_dues where month='2028-02-01'),
 '10000000-0000-4000-8000-000000000021',32500,'2020-02-01')$$,'22023',null,'payment cannot predate its obligation month');

set local request.jwt.claim.sub = '10000000-0000-4000-8000-000000000002';
select is_empty($$select * from public.monthly_expense_items$$,'other account cannot read templates');
select is_empty($$select * from public.monthly_expense_dues$$,'other account cannot read checklists');
select is_empty($$select * from public.monthly_expense_list((now() at time zone 'Africa/Cairo')::date)$$,'RPC only returns own items');
select throws_ok($$select public.monthly_expense_stop('10000000-0000-4000-8000-000000000010')$$,'P0001','monthly_changed','cannot stop someone else’s item');
select throws_ok($$select public.monthly_expense_add('10000000-0000-4000-8000-000000000010',' Internet ',30000,31,'bills')$$,'P0001','monthly_changed','cannot reuse another owner’s template');

set local request.jwt.claim.sub = '10000000-0000-4000-8000-000000000001';
select lives_ok($$select public.monthly_expense_unpay(
 (select id from public.monthly_expense_dues where expense_id is not null),
 '10000000-0000-4000-8000-000000000020')$$,'undo payment');
select lives_ok($$select public.monthly_expense_unpay(
 (select id from public.monthly_expense_dues where expense_id is not null),
 '10000000-0000-4000-8000-000000000020')$$,'undo retry is safe');
select is((select count(*) from public.expenses where archived_at is null),0::bigint,'undo removes expense from active ledger');
select is((select count(*) from public.personal_activity where entity_id='10000000-0000-4000-8000-000000000020'),2::bigint,'payment and undo remain in audit history');
select is((select paid_minor from public.monthly_expense_list((now() at time zone 'Africa/Cairo')::date)),null::integer,'checklist returns to unpaid');
select lives_ok($$select public.monthly_expense_pay(
 (select id from public.monthly_expense_dues where month=date_trunc('month',now() at time zone 'Africa/Cairo')::date),
 '10000000-0000-4000-8000-000000000022',31000,(now() at time zone 'Africa/Cairo')::date)$$,'can record corrected payment after undo');
select lives_ok($$select public.monthly_expense_stop('10000000-0000-4000-8000-000000000010')$$,'stop future repetition');
select lives_ok($$select public.monthly_expense_stop('10000000-0000-4000-8000-000000000010')$$,'stop retry is safe');
select is_empty($$select * from public.monthly_expense_list('2028-02-01')$$,'stopped future preview is removed');
select is((select count(*) from public.monthly_expense_list((now() at time zone 'Africa/Cairo')::date)),1::bigint,'current month stays available');
select throws_ok($$update public.monthly_expense_dues set expected_minor=1$$,'42501',null,'clients cannot bypass procedures');

reset role;
insert into public.monthly_expense_items(id,owner_id,name,amount_minor,due_day,category,starts_on)
values('10000000-0000-4000-8000-000000000030','10000000-0000-4000-8000-000000000001',
 'Late bill',10000,1,'bills',(date_trunc('month',now() at time zone 'Africa/Cairo')-interval '1 month')::date);
set local role authenticated;
select lives_ok($$select * from public.monthly_expense_list(
 (date_trunc('month',now() at time zone 'Africa/Cairo')-interval '1 month')::date)$$,'previous month can be reviewed');
select lives_ok($$select public.monthly_expense_pay(
 (select id from public.monthly_expense_dues where item_id='10000000-0000-4000-8000-000000000030'),
 '10000000-0000-4000-8000-000000000031',10000,(now() at time zone 'Africa/Cairo')::date)$$,'overdue previous-month bill can be paid today');
select is((select spent_on from public.expenses where id='10000000-0000-4000-8000-000000000031'),
 (now() at time zone 'Africa/Cairo')::date,'late payment hits the actual spending date');

set local role anon;
select throws_ok($$select public.monthly_expense_remove('10000000-0000-4000-8000-000000000010')$$,
 '42501',null,'anonymous removal is blocked');
set local role authenticated;
set local request.jwt.claim.sub = '10000000-0000-4000-8000-000000000002';
select throws_ok($$select public.monthly_expense_remove('10000000-0000-4000-8000-000000000010')$$,
 'P0001','monthly_changed','cannot remove another owner’s obligation');
set local request.jwt.claim.sub = '10000000-0000-4000-8000-000000000001';
select lives_ok($$select * from public.monthly_expense_list('2028-02-01')$$,'preview before removal');
select lives_ok($$select public.monthly_expense_remove('10000000-0000-4000-8000-000000000010')$$,
 'remove a paid item already stopped for next month');
select lives_ok($$select public.monthly_expense_remove('10000000-0000-4000-8000-000000000010')$$,
 'repeat removal safely');
select is((select count(*) from public.expenses where id='10000000-0000-4000-8000-000000000022' and archived_at is null),
 1::bigint,'recorded purchase remains active');
select lives_ok($$select public.monthly_expense_remove('10000000-0000-4000-8000-000000000030')$$,
 'remove an ongoing obligation');
select is_empty($$select * from public.monthly_expense_list((now() at time zone 'Africa/Cairo')::date)$$,
 'removed items do not regenerate this month');
select is_empty($$select * from public.monthly_expense_list('2028-02-01')$$,
 'future snapshots are removed');
select is((select expense_id from public.monthly_expense_list(
 (date_trunc('month',now() at time zone 'Africa/Cairo')-interval '1 month')::date)),
 '10000000-0000-4000-8000-000000000031'::uuid,'previous checklist keeps the recorded payment');
select * from finish();
rollback;
