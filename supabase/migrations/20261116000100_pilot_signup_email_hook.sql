-- During the manual approval pilot, signup is queued without sending mail.
-- Other email-based actions must not report a successful delivery.
create function public.spend_pilot_signup_email(event jsonb)
returns jsonb language sql set search_path = ''
as $$
  select case when event #>> '{email_data,email_action_type}' = 'signup'
    then '{}'::jsonb
    else jsonb_build_object('error', jsonb_build_object(
      'http_code', 403, 'message', 'Spend uses manual account recovery during the pilot'
    ))
  end;
$$;

revoke all on function public.spend_pilot_signup_email(jsonb) from public, anon, authenticated;
grant execute on function public.spend_pilot_signup_email(jsonb) to supabase_auth_admin;
