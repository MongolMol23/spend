create schema if not exists spend_private;
revoke all on schema spend_private from public, anon, authenticated;

create table spend_private.admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);

create table spend_private.account_reviews (
  user_id uuid primary key references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz
);

create function spend_private.queue_new_account()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into spend_private.account_reviews (user_id) values (new.id);
  return new;
end;
$$;

revoke all on function spend_private.queue_new_account() from public;
create trigger spend_queue_new_account after insert on auth.users
for each row execute function spend_private.queue_new_account();

-- Auth calls this before granting a session, regardless of the sign-in method.
create function public.spend_review_access(event jsonb)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
begin
  if exists (
    select 1 from spend_private.account_reviews r
    where r.user_id = (event->>'user_id')::uuid and r.status <> 'approved'
  ) then
    return jsonb_build_object('error', jsonb_build_object(
      'http_code', 403, 'message', 'spend_account_pending_review'
    ));
  end if;
  return event;
end;
$$;
revoke all on function public.spend_review_access(jsonb) from public, anon, authenticated;
grant execute on function public.spend_review_access(jsonb) to supabase_auth_admin;

create function public.spend_admin_users()
returns table (id uuid, username text, email text, display_name text, created_at timestamptz, status text, reviewed_at timestamptz)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not exists (select 1 from spend_private.admins a where a.user_id = auth.uid()) then
    raise insufficient_privilege using message = 'spend_admin_required';
  end if;
  return query
    select u.id, p.username, u.email::text, p.display_name, u.created_at,
      coalesce(r.status, case when u.email_confirmed_at is null then 'pending' else 'approved' end), r.reviewed_at
    from auth.users u
    left join public.profiles p on p.id = u.id
    left join spend_private.account_reviews r on r.user_id = u.id
    order by u.created_at desc, u.id;
end;
$$;

create function public.spend_review_account(target_id uuid, decision text)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not exists (select 1 from spend_private.admins a where a.user_id = auth.uid()) then
    raise insufficient_privilege using message = 'spend_admin_required';
  end if;
  if decision is null or decision not in ('approved', 'rejected') then
    raise invalid_parameter_value;
  end if;

  insert into spend_private.account_reviews (user_id)
  select u.id from auth.users u where u.id = target_id and u.email_confirmed_at is null
  on conflict do nothing;

  update spend_private.account_reviews
  set status = decision, reviewed_by = auth.uid(), reviewed_at = now()
  where user_id = target_id and status = 'pending';
  if not found then raise exception 'spend_account_already_reviewed'; end if;

  if decision = 'approved' then
    -- Approval is the initial group's out-of-band identity check.
    update auth.users set email_confirmed_at = coalesce(email_confirmed_at, now()),
      confirmation_token = '', updated_at = now() where id = target_id;
  end if;
end;
$$;

revoke all on function public.spend_admin_users(), public.spend_review_account(uuid, text) from public, anon, authenticated;
grant execute on function public.spend_admin_users(), public.spend_review_account(uuid, text) to authenticated;
