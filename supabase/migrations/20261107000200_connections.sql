create table public.friendships (
  id uuid primary key default gen_random_uuid(),
  sender uuid not null references public.profiles(id) on delete cascade,
  recipient uuid not null references public.profiles(id) on delete cascade,
  state text not null default 'pending' check (state in ('pending','accepted','declined','removed')),
  check (sender <> recipient)
);
create unique index friendship_pair on public.friendships (least(sender, recipient), greatest(sender, recipient));

create table public.money_requests (
  id uuid primary key default gen_random_uuid(),
  sender uuid not null references public.profiles(id) on delete cascade,
  recipient uuid not null references public.profiles(id) on delete cascade,
  amount_minor integer not null check (amount_minor > 0),
  currency text not null default 'EGP' check (currency = 'EGP'),
  reason text not null check (reason ~ '[^[:space:]]' and char_length(reason) <= 500),
  due_date date,
  state text not null default 'pending' check (state in ('pending','accepted','declined','cancelled')),
  created_at timestamptz not null default now(),
  check (sender <> recipient)
);
create table public.request_events (
  id bigint generated always as identity primary key,
  request_id uuid not null references public.money_requests(id) on delete cascade,
  actor uuid not null references public.profiles(id) on delete cascade,
  event text not null check (event in ('sent','accepted','declined','cancelled')),
  created_at timestamptz not null default now()
);
create index request_events_request on public.request_events (request_id, id);
create index money_requests_sender on public.money_requests (sender, created_at);
create index money_requests_recipient on public.money_requests (recipient, created_at);

alter table public.friendships enable row level security;
alter table public.money_requests enable row level security;
alter table public.request_events enable row level security;
revoke all on public.friendships, public.money_requests, public.request_events from public, anon, authenticated;
grant select on public.friendships, public.money_requests, public.request_events to authenticated;

create policy friendship_participants on public.friendships for select to authenticated
  using ((select auth.uid()) in (sender, recipient));
create policy request_participants on public.money_requests for select to authenticated
  using ((select auth.uid()) in (sender, recipient));
create policy event_participants on public.request_events for select to authenticated
  using (exists (select 1 from public.money_requests where id = request_id));

-- Only reveal names for people already related to the viewer.
create function public.connection_names()
returns table (id uuid, username text, display_name text)
language sql stable security definer set search_path = ''
as $$
  select p.id, p.username, p.display_name from public.profiles p
  where p.id = (select auth.uid())
    or exists (select 1 from public.friendships f
      where (f.sender = (select auth.uid()) and f.recipient = p.id)
         or (f.recipient = (select auth.uid()) and f.sender = p.id));
$$;

create function public.send_friend_request(target_username text)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  target uuid;
  result uuid;
begin
  select id into target from public.profiles where username = lower(btrim(target_username));
  if caller is null or target is null or caller = target then
    raise exception 'friend_unavailable' using errcode = 'P0001';
  end if;
  insert into public.friendships as f (sender, recipient) values (caller, target)
  on conflict ((least(sender, recipient)), (greatest(sender, recipient))) do update
    set sender = excluded.sender, recipient = excluded.recipient, state = 'pending'
    where f.state in ('declined','removed')
  returning id into result;
  if result is null then raise exception 'friend_exists' using errcode = 'P0001'; end if;
  return result;
end;
$$;

create function public.respond_friendship(friendship_id uuid, decision text)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  update public.friendships set state = decision where id = friendship_id and (
    (state = 'pending' and recipient = auth.uid() and decision in ('accepted','declined'))
    or (state = 'accepted' and auth.uid() in (sender, recipient) and decision = 'removed')
  );
  if not found then raise exception 'action_unavailable' using errcode = 'P0001'; end if;
end;
$$;

create or replace function public.send_money_request(target_id uuid, minor_units integer, request_reason text, deadline date default null)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  result uuid;
begin
  -- Serialize request creation against removal of the friendship.
  perform 1 from public.friendships where state = 'accepted' and
    least(sender, recipient) = least(caller, target_id) and
    greatest(sender, recipient) = greatest(caller, target_id)
    and caller is not null and target_id is not null
  for update;
  if not found then raise exception 'friend_unavailable' using errcode = 'P0001'; end if;

  insert into public.money_requests (sender, recipient, amount_minor, reason, due_date)
    values (caller, target_id, minor_units, request_reason, deadline) returning id into result;
  insert into public.request_events (request_id, actor, event) values (result, caller, 'sent');
  return result;
end;
$$;

create function public.respond_money_request(request_id uuid, decision text)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  -- The pending predicate makes simultaneous responses settle to one transition.
  update public.money_requests set state = decision where id = request_id and state = 'pending' and (
    (recipient = auth.uid() and decision in ('accepted','declined'))
    or (sender = auth.uid() and decision = 'cancelled')
  );
  if not found then raise exception 'action_unavailable' using errcode = 'P0001'; end if;
  insert into public.request_events (request_id, actor, event) values (request_id, auth.uid(), decision);
end;
$$;

revoke all on function public.connection_names(), public.send_friend_request(text),
  public.respond_friendship(uuid,text), public.send_money_request(uuid,integer,text,date),
  public.respond_money_request(uuid,text) from public, anon, authenticated;
grant execute on function public.connection_names(), public.send_friend_request(text),
  public.respond_friendship(uuid,text), public.send_money_request(uuid,integer,text,date),
  public.respond_money_request(uuid,text) to authenticated;

