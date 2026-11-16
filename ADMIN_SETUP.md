Open `/admin` with an administrator account to review signups and handle password requests.

## Create the first admin before publishing

After applying the migrations to a new hosted project, open **Authentication → Users** in Supabase and create your own account with a unique password. Use an email address you control. Copy the new user's UUID from the dashboard.

Open **SQL Editor** in the same hosted project and replace `YOUR_USER_UUID` below. The transaction approves the account and assigns the admin role together. You can run it again for the same account.

```sql
begin;

update auth.users
set email_confirmed_at = coalesce(email_confirmed_at, now()),
    confirmation_token = '',
    updated_at = now()
where id = 'YOUR_USER_UUID'::uuid;

insert into spend_private.account_reviews (user_id, status, reviewed_at)
values ('YOUR_USER_UUID'::uuid, 'approved', now())
on conflict (user_id) do update
set status = excluded.status, reviewed_at = excluded.reviewed_at;

insert into spend_private.admins (user_id)
values ('YOUR_USER_UUID'::uuid)
on conflict do nothing;

commit;
```

Sign in on the hosted site and confirm it opens `/admin` before sharing the site. The password is set through Supabase Auth and does not belong in the repository or migration files.

## Local development

1. Apply the migrations and start the local Supabase stack with `supabase start`. If the stack was already running before the configuration changed, stop and start it to load the Auth hook.
2. In the trusted database console, grant access to a specific existing account whose identity you have verified. Replace the example email before running this statement.

   ```sql
   insert into spend_private.admins (user_id)
   select id from auth.users
   where lower(email) = lower('replace-with-your-email@example.com')
     and email_confirmed_at is not null
   on conflict do nothing
   returning user_id;
   ```

   Confirm the query returned the expected user ID. If this is a fresh database with no existing account, create the initial owner through trusted Supabase Auth administration and explicitly approve that owner's review record before signing in.
3. Sign in and open `http://127.0.0.1:5173/admin`. Approve an account only after checking that the requester controls the listed email. Approval records the decision and confirms that email in Auth.

For local password recovery, run `supabase functions serve manual-recovery` alongside the local stack. In the admin dashboard, choose **Password requests**, verify the user's identity, generate the link, and share it privately. Use **Mark as shared** once you have sent it.

For a hosted project, enable `public.spend_review_access` as the Custom Access Token hook after applying the migrations and deploy the `manual-recovery` Edge Function. Generate the reset link from the live admin site so the recipient can open it. The hook enforces pending and rejected status before a token is issued.
