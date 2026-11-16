create function public.signup_username_available(requested_username text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  -- Expose availability only, including names reserved by unconfirmed signups.
  select case
    when normalized.username ~ '^[a-z0-9_]{3,24}$' then not exists (
      select 1 from public.profiles where username = normalized.username
    )
    else false
  end
  from (select lower(btrim(requested_username)) as username) normalized;
$$;

revoke all on function public.signup_username_available(text) from public, anon, authenticated;
grant execute on function public.signup_username_available(text) to anon, authenticated;
