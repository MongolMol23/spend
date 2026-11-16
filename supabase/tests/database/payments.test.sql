begin;
set local search_path = public, extensions;
select plan(28);
insert into auth.users (id,email,email_confirmed_at) values
('00000000-0000-4000-8000-000000000031','payer@example.test',now()),
('00000000-0000-4000-8000-000000000032','creditor@example.test',now()),
('00000000-0000-4000-8000-000000000033','outsider@example.test',now());
insert into public.profiles(id,username,display_name,language) values
('00000000-0000-4000-8000-000000000031','payer31','Payer','en'),
('00000000-0000-4000-8000-000000000032','creditor32','Creditor','en'),
('00000000-0000-4000-8000-000000000033','outsider33','Outsider','en');
insert into public.money_requests(id,sender,recipient,amount_minor,reason,state) values
('00000000-0000-4000-8000-000000000041','00000000-0000-4000-8000-000000000032',
 '00000000-0000-4000-8000-000000000031',50000,'Original dinner','accepted');
insert into public.request_events(request_id,actor,event) values
('00000000-0000-4000-8000-000000000041','00000000-0000-4000-8000-000000000032','sent');

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000031';
select lives_ok($$select public.record_request_payment('00000000-0000-4000-8000-000000000041',20000,'00000000-0000-4000-8000-000000000051')$$,'payer records 200');
select lives_ok($$select public.record_request_payment('00000000-0000-4000-8000-000000000041',20000,'00000000-0000-4000-8000-000000000051')$$,'retry succeeds');
select is((select count(*) from public.request_payments),1::bigint,'retry creates one payment');
select throws_ok($$select public.record_request_payment('00000000-0000-4000-8000-000000000041',21000,'00000000-0000-4000-8000-000000000051')$$,'P0001','key_conflict','key cannot be reused for different payload');
select throws_ok($$select public.record_request_payment('00000000-0000-4000-8000-000000000041',30001,'00000000-0000-4000-8000-000000000052')$$,'P0001','invalid_payment','pending payment reserves balance');
select throws_ok($$select public.respond_request_payment((select id from public.request_payments),'confirmed')$$,'P0001','action_unavailable','payer cannot confirm receipt');
select is((select count(*) from public.request_payments where state='confirmed'),0::bigint,'pending does not count as paid');

set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000033';
select is((select count(*) from public.request_payments),0::bigint,'third party cannot read payments');
select throws_ok($$select public.record_request_payment('00000000-0000-4000-8000-000000000041',100,'00000000-0000-4000-8000-000000000055')$$,'P0001','action_unavailable','third party cannot create payment');

set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000032';
select lives_ok($$select public.respond_request_payment((select id from public.request_payments),'confirmed')$$,'creditor confirms receipt');
select lives_ok($$select public.respond_request_payment((select id from public.request_payments),'confirmed')$$,'confirmation retry succeeds');
select is((select count(*) from public.request_events where event='payment_confirmed'),1::bigint,'confirmation logs once');
select is((select sum(amount_minor) from public.request_payments where state='confirmed'),20000::bigint,'confirmed amount is 200');

set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000031';
select lives_ok($$select public.propose_request_correction('00000000-0000-4000-8000-000000000041','request_amount','wrong total','00000000-0000-4000-8000-000000000053',null,10000)$$,'payer proposes correction');
select throws_ok($$select public.respond_request_correction((select id from public.request_corrections),'approved')$$,'P0001','action_unavailable','proposer cannot approve own correction');

set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000032';
select throws_ok($$select public.respond_request_correction((select id from public.request_corrections),'approved')$$,'P0001','invalid_correction','correction cannot reduce total below paid');
select lives_ok($$select public.respond_request_correction((select id from public.request_corrections),'declined')$$,'recipient can decline invalid correction');

set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000031';
select lives_ok($$select public.record_request_payment('00000000-0000-4000-8000-000000000041',30000,'00000000-0000-4000-8000-000000000054')$$,'payer records remaining 300');
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000032';
select lives_ok($$select public.respond_request_payment((select id from public.request_payments where state='pending'),'confirmed')$$,'creditor confirms final payment');
select is((select state from public.money_requests),'settled','request is settled');
select lives_ok($$select public.propose_request_correction('00000000-0000-4000-8000-000000000041','payment_cancel','entered in error','00000000-0000-4000-8000-000000000056',(select id from public.request_payments where amount_minor=20000))$$,'creditor proposes cancellation');
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000031';
select lives_ok($$select public.respond_request_correction((select id from public.request_corrections where state='pending'),'approved')$$,'payer approves cancellation');
select is((select state from public.money_requests),'accepted','cancelled confirmed payment reopens debt');
select is((select details->>'reason' from public.request_events where event='sent'),'Original dinner','original reason remains in history');
select lives_ok($$select public.propose_request_correction('00000000-0000-4000-8000-000000000041','request_reason','fix reason','00000000-0000-4000-8000-000000000057',null,null,'New reason')$$,'payer proposes a reason correction');
select lives_ok($$select public.record_request_payment('00000000-0000-4000-8000-000000000041',10000,'00000000-0000-4000-8000-000000000058')$$,'another action changes the request version');
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000032';
select throws_ok($$select public.respond_request_correction((select id from public.request_corrections where state='pending'),'approved')$$,
  'P0001','stale_correction','stale correction cannot overwrite a newer state');
select lives_ok($$select public.respond_request_correction((select id from public.request_corrections where state='pending'),'declined')$$,'stale correction can still be declined');
reset role;
select * from finish();
rollback;
