begin;
set local search_path = public, extensions;
select plan(17);

insert into auth.users (id, email, email_confirmed_at) values
  ('00000000-0000-4000-8000-000000000011', 'friend-a@example.test', now()),
  ('00000000-0000-4000-8000-000000000012', 'friend-b@example.test', now()),
  ('00000000-0000-4000-8000-000000000013', 'friend-c@example.test', now());
insert into public.profiles (id, username, display_name, language) values
  ('00000000-0000-4000-8000-000000000011', 'phase2_a', 'A', 'en'),
  ('00000000-0000-4000-8000-000000000012', 'phase2_b', 'B', 'ar'),
  ('00000000-0000-4000-8000-000000000013', 'phase2_c', 'C', 'en');

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000011';
select throws_ok($$select send_friend_request('phase2_a')$$,'P0001','friend_unavailable','self-add is denied');
select lives_ok($$select send_friend_request(' PHASE2_B ')$$,'can send normalized friend request');
select throws_ok($$select send_friend_request('phase2_b')$$,'P0001','friend_exists','duplicate friendship is denied');
select throws_ok($$select send_money_request('00000000-0000-4000-8000-000000000012',50000,'Dinner')$$,
  'P0001','friend_unavailable','pending friendship cannot send a request');
select throws_ok($$select respond_friendship((select id from friendships),'accepted')$$,
  'P0001','action_unavailable','sender cannot accept friendship');

set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000012';
select lives_ok($$select respond_friendship((select id from friendships),'accepted')$$,'recipient accepts friendship');

set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000011';
select throws_ok($$select send_money_request('00000000-0000-4000-8000-000000000012',50000,'   ')$$,
  '23514',null,'blank reason is rejected');
select throws_ok($$select send_money_request('00000000-0000-4000-8000-000000000012',0,'Dinner')$$,
  '23514',null,'zero amount is rejected');
select lives_ok($$select send_money_request('00000000-0000-4000-8000-000000000012',50000,'Dinner')$$,'accepted friend can request money');
select throws_ok($$select respond_money_request((select id from money_requests),'accepted')$$,
  'P0001','action_unavailable','sender cannot accept money request');

set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000012';
select lives_ok($$select respond_money_request((select id from money_requests),'accepted')$$,'recipient accepts money request');
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000011';
do $$ begin
  perform set_config('test.pending_request', send_money_request(
    '00000000-0000-4000-8000-000000000012', 1000, 'Cancel sample')::text, true);
end $$;

set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000013';
select throws_ok($$select respond_money_request(current_setting('test.pending_request')::uuid,'accepted')$$,
  'P0001','action_unavailable','third account cannot change a known pending request');

set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000011';
select lives_ok($$select respond_money_request(current_setting('test.pending_request')::uuid,'cancelled')$$,
  'sender can cancel a pending request');
select throws_ok($$select respond_money_request(current_setting('test.pending_request')::uuid,'cancelled')$$,
  'P0001','action_unavailable','a terminal request cannot change twice');

set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000012';
select respond_friendship((select id from friendships),'removed');
select is((select count(*) from request_events),4::bigint,'history survives removal of the friendship');

set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000013';
select is((select count(*) from money_requests),0::bigint,'third account cannot read requests');
select is((select count(*) from request_events),0::bigint,'third account cannot read events');

reset role;
select * from finish();
rollback;
