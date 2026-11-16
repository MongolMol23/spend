begin;
set local search_path = public, extensions;
select plan(6);

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-00000000a001', 'approval-admin@example.test'),
  ('00000000-0000-4000-8000-00000000a002', 'approval-member@example.test');
select ok(public.spend_review_access('{"user_id":"00000000-0000-4000-8000-00000000a002"}') ? 'error', 'new accounts cannot obtain a token');
insert into spend_private.admins values ('00000000-0000-4000-8000-00000000a001');

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-00000000a002';
select throws_ok('select * from public.spend_admin_users()', '42501', 'spend_admin_required', 'members cannot read account emails');
select throws_ok($$select public.spend_review_account('00000000-0000-4000-8000-00000000a002', 'approved')$$, '42501', 'spend_admin_required', 'members cannot self-approve');

set local request.jwt.claim.sub = '00000000-0000-4000-8000-00000000a001';
select is((select status from public.spend_admin_users() where email = 'approval-member@example.test'), 'pending', 'admin can read the queue');
select lives_ok($$select public.spend_review_account('00000000-0000-4000-8000-00000000a002', 'approved')$$, 'admin can approve');
reset role;
select ok(not (public.spend_review_access('{"user_id":"00000000-0000-4000-8000-00000000a002","claims":{}}') ? 'error'), 'approved member can obtain a token');
select * from finish();
rollback;
