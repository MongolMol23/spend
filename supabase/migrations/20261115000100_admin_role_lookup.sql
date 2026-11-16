create function public.spend_is_admin()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from spend_private.admins where user_id = auth.uid());
$$;

revoke all on function public.spend_is_admin() from public, anon, authenticated;
grant execute on function public.spend_is_admin() to authenticated;
