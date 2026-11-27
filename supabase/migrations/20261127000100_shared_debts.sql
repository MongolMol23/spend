alter table public.money_requests add column is_offer boolean not null default false;

-- Sender and recipient remain the creditor and debtor for existing payment functions.
create function public.create_shared_debt(p_id uuid, target_id uuid, minor_units integer, request_reason text,
  i_owe boolean, deadline date default null)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  creditor uuid := case when i_owe then target_id else caller end;
  debtor uuid := case when i_owe then caller else target_id end;
  result uuid;
begin
  if i_owe is null or p_id is null then raise invalid_parameter_value; end if;
  perform 1 from public.friendships where state = 'accepted' and
    least(sender, recipient) = least(caller, target_id) and
    greatest(sender, recipient) = greatest(caller, target_id)
    and caller is not null and target_id is not null
  for update;
  if not found then raise exception 'friend_unavailable' using errcode = 'P0001'; end if;

  insert into public.money_requests (id, sender, recipient, amount_minor, reason, due_date, is_offer)
    values (p_id, creditor, debtor, minor_units, request_reason, deadline, i_owe)
    on conflict (id) do nothing returning id into result;
  if result is null then
    if exists (select 1 from public.money_requests where id = p_id
      and sender = creditor and recipient = debtor and is_offer = i_owe
      and amount_minor = minor_units and reason = request_reason and due_date is not distinct from deadline) then
      return p_id;
    end if;
    raise exception 'request_changed' using errcode = 'P0001';
  end if;
  insert into public.request_events (request_id, actor, event) values (result, caller, 'sent');
  return result;
end;
$$;

create or replace function public.respond_money_request(request_id uuid, decision text)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  update public.money_requests set state = decision where id = request_id and state = 'pending' and (
    ((case when is_offer then sender else recipient end) = auth.uid() and decision in ('accepted','declined'))
    or ((case when is_offer then recipient else sender end) = auth.uid() and decision = 'cancelled')
  );
  if not found then raise exception 'action_unavailable' using errcode = 'P0001'; end if;
  insert into public.request_events (request_id, actor, event) values (request_id, auth.uid(), decision);
end;
$$;

create function public.list_debt_entries(p_direction text, p_offset integer)
returns table (id uuid, source text, contact text, remaining_minor bigint, due_on date, reason text)
language sql stable security invoker set search_path = ''
as $$
  with viewer as (select auth.uid() as id),
  entries as (
    select d.id, 'private'::text as source, d.contact, (d.amount_minor - d.paid_minor)::bigint as remaining_minor,
      d.due_on, null::text as reason
    from public.private_debts d, viewer v
    where d.owner_id = v.id and d.archived_at is null and d.direction = p_direction
    union all
    select r.id, 'shared', coalesce(n.display_name, r.reason), (r.amount_minor - coalesce(payments.paid, 0))::bigint,
      r.due_date, r.reason
    from viewer v
    join public.money_requests r on (p_direction = 'owed' and r.sender = v.id)
      or (p_direction = 'owe' and r.recipient = v.id)
    left join public.connection_names() n on n.id = case when r.sender = v.id then r.recipient else r.sender end
    cross join lateral (
      select sum(p.amount_minor) as paid from public.request_payments p where p.request_id = r.id and p.state = 'confirmed'
    ) payments
    where r.state in ('accepted', 'settled')
  )
  select e.id, e.source, e.contact, e.remaining_minor, e.due_on, e.reason from entries e
  order by e.contact, e.id, e.source offset greatest(p_offset, 0) limit 21;
$$;

revoke all on function public.create_shared_debt(uuid,uuid,integer,text,boolean,date),
  public.list_debt_entries(text,integer) from public, anon, authenticated;
grant execute on function public.create_shared_debt(uuid,uuid,integer,text,boolean,date),
  public.list_debt_entries(text,integer) to authenticated;

create or replace function public.debt_overview()
returns table (owed_minor bigint, owe_minor bigint, due_id uuid, due_source text,
  due_label text, due_on date, due_minor bigint, pending_count bigint)
language sql stable security invoker set search_path = ''
as $$
  with balances as (
    select d.id, 'private'::text as source, d.contact as label, d.direction, d.due_on,
      (d.amount_minor - d.paid_minor)::bigint as remaining
    from public.private_debts d
    where d.owner_id = (select auth.uid()) and d.archived_at is null and d.amount_minor > d.paid_minor
    union all
    select r.id, 'shared', r.reason, case when r.sender = (select auth.uid()) then 'owed' else 'owe' end,
      r.due_date, r.amount_minor - coalesce(p.total, 0)
    from public.money_requests r
    cross join lateral (
      select sum(amount_minor) as total from public.request_payments where request_id = r.id and state = 'confirmed'
    ) p
    where r.state = 'accepted' and ((select auth.uid()) in (r.sender, r.recipient))
      and r.amount_minor > coalesce(p.total, 0)
  ), totals as (
    select coalesce(sum(remaining) filter (where direction = 'owed'), 0)::bigint as owed,
      coalesce(sum(remaining) filter (where direction = 'owe'), 0)::bigint as owe
    from balances
  )
  select t.owed, t.owe, b.id, b.source, b.label, b.due_on, b.remaining,
    (select count(*) from public.money_requests where (case when is_offer then sender else recipient end) = (select auth.uid()) and state = 'pending')
  from totals t left join lateral (
    select * from balances where due_on is not null order by due_on, source, id limit 1
  ) b on true;
$$;
