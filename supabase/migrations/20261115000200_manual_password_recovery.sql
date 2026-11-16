create table spend_private.password_requests (
  user_id uuid primary key references auth.users(id) on delete cascade,
  requested_at timestamptz not null default now()
);

-- Always return the same result to avoid revealing whether an email exists.
create function public.spend_request_recovery(requested_email text)
returns void language sql security definer set search_path = ''
as $$
  insert into spend_private.password_requests (user_id)
  select u.id from auth.users u
  where lower(u.email) = lower(btrim(requested_email)) and u.email_confirmed_at is not null
    and not exists (select 1 from spend_private.account_reviews r where r.user_id = u.id and r.status <> 'approved')
  on conflict do nothing;
$$;

create function public.spend_recovery_queue()
returns uuid[] language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.spend_is_admin() then raise insufficient_privilege; end if;
  return array(select user_id from spend_private.password_requests order by requested_at);
end;
$$;

create function public.spend_recovery_target(target_id uuid)
returns text language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.spend_is_admin() then raise insufficient_privilege; end if;
  return (select u.email from auth.users u join spend_private.password_requests p on p.user_id = u.id
    where u.id = target_id and u.email_confirmed_at is not null
      and not exists (select 1 from spend_private.account_reviews r where r.user_id = u.id and r.status <> 'approved'));
end;
$$;

create function public.spend_finish_recovery(target_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not public.spend_is_admin() then raise insufficient_privilege; end if;
  delete from spend_private.password_requests where user_id = target_id;
end;
$$;

revoke all on function public.spend_request_recovery(text), public.spend_recovery_queue(), public.spend_recovery_target(uuid), public.spend_finish_recovery(uuid) from public, anon, authenticated;
grant execute on function public.spend_request_recovery(text) to anon, authenticated;
grant execute on function public.spend_recovery_queue(), public.spend_recovery_target(uuid), public.spend_finish_recovery(uuid) to authenticated;
