create table public.private_debts (
  id uuid primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  contact text not null check (char_length(contact) between 1 and 120 and contact ~ '[^[:space:]]'),
  direction text not null check (direction in ('owed', 'owe')),
  amount_minor integer not null check (amount_minor > 0),
  paid_minor integer not null default 0 check (paid_minor between 0 and amount_minor),
  due_on date check (due_on between date '0001-01-01' and date '9999-12-31'),
  version integer not null default 1,
  archived_at timestamptz
);
create index private_debts_owner on public.private_debts (owner_id, id) where archived_at is null;

create table public.private_debt_payments (
  id uuid primary key,
  debt_id uuid not null references public.private_debts(id) on delete cascade,
  amount_minor integer not null check (amount_minor > 0),
  paid_on date not null check (paid_on between date '0001-01-01' and date '9999-12-31'),
  created_at timestamptz not null default now()
);
create index private_debt_payments_debt on public.private_debt_payments (debt_id, paid_on desc, id desc);

alter table public.private_debts enable row level security;
alter table public.private_debt_payments enable row level security;
revoke all on public.private_debts, public.private_debt_payments from public, anon, authenticated;
grant select on public.private_debts, public.private_debt_payments to authenticated;
create policy private_debt_owner on public.private_debts for select to authenticated
  using (owner_id = (select auth.uid()));
create policy private_debt_payment_owner on public.private_debt_payments for select to authenticated
  using (exists (select 1 from public.private_debts d where d.id = debt_id));

create function public.capture_private_debt_activity()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  -- Repayments write their own event. Do not count the associated balance update twice.
  if tg_op = 'UPDATE' and new.paid_minor <> old.paid_minor then return new; end if;
  insert into public.personal_activity (owner_id, entity_type, entity_id, action, before_data, after_data)
  values (new.owner_id, 'private_debt', new.id,
    case when tg_op = 'INSERT' then 'created' when new.archived_at is not null then 'archived' else 'updated' end,
    case when tg_op = 'UPDATE' then to_jsonb(old) - 'owner_id' end,
    to_jsonb(new) - 'owner_id');
  return new;
end;
$$;
create trigger private_debt_activity after insert or update on public.private_debts
  for each row execute function public.capture_private_debt_activity();

create function public.save_private_debt(
  p_id uuid, p_contact text, p_direction text, p_amount integer,
  p_due_on date default null, p_version integer default null
)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := public.confirmed_expense_owner();
  desired jsonb := jsonb_build_object('contact', btrim(p_contact), 'direction', p_direction,
    'amount_minor', p_amount, 'due_on', p_due_on);
begin
  if p_version is null then
    insert into public.private_debts (id, owner_id, contact, direction, amount_minor, due_on)
    values (p_id, actor, btrim(p_contact), p_direction, p_amount, p_due_on)
    on conflict (id) do nothing;
    if not found and not exists (
      select 1 from public.personal_activity where owner_id = actor and entity_type = 'private_debt'
        and entity_id = p_id and action = 'created' and after_data @> desired
    ) then raise exception 'private_debt_changed'; end if;
    return;
  end if;

  -- Once money has moved, preserve the direction of that repayment.
  update public.private_debts d set contact = btrim(p_contact), direction = p_direction,
    amount_minor = p_amount, due_on = p_due_on, version = d.version + 1
  where d.id = p_id and d.owner_id = actor and d.archived_at is null and d.version = p_version
    and d.paid_minor <= p_amount and (d.paid_minor = 0 or d.direction = p_direction)
    and not (to_jsonb(d) @> desired);
  if not found and not exists (
    select 1 from public.private_debts d where d.id = p_id and d.owner_id = actor and d.archived_at is null
      and (d.version = p_version or d.version - 1 = p_version) and to_jsonb(d) @> desired
  ) then raise exception 'private_debt_changed'; end if;
end;
$$;

create function public.record_private_debt_payment(p_id uuid, p_debt uuid, p_amount integer, p_paid_on date)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := public.confirmed_expense_owner();
  debt public.private_debts%rowtype;
begin
  -- Serialize repayment and debt edits against the same row before validating the remaining balance.
  select * into debt from public.private_debts where id = p_debt and owner_id = actor for update;
  if not found then raise exception 'private_debt_changed'; end if;
  if exists (select 1 from public.private_debt_payments
    where id = p_id and debt_id = p_debt and amount_minor = p_amount and paid_on = p_paid_on
  ) then return; end if;
  if debt.archived_at is not null then raise exception 'private_debt_changed'; end if;
  if p_amount is null or p_amount <= 0 or p_amount > debt.amount_minor - debt.paid_minor then
    raise exception 'private_debt_payment_exceeds_balance';
  end if;

  insert into public.private_debt_payments (id, debt_id, amount_minor, paid_on)
  values (p_id, p_debt, p_amount, p_paid_on) on conflict (id) do nothing;
  if not found then raise exception 'private_debt_changed'; end if;
  update public.private_debts set paid_minor = paid_minor + p_amount, version = version + 1 where id = p_debt;
  insert into public.personal_activity (owner_id, entity_type, entity_id, action, before_data, after_data)
  values (actor, 'private_debt_payment', p_id, 'created', null,
    jsonb_build_object('debt_id', p_debt, 'contact', debt.contact, 'direction', debt.direction,
      'amount_minor', p_amount, 'paid_on', p_paid_on, 'remaining_minor', debt.amount_minor - debt.paid_minor - p_amount));
end;
$$;

create function public.archive_private_debt(p_id uuid, p_version integer)
returns void language plpgsql security definer set search_path = ''
as $$
declare actor uuid := public.confirmed_expense_owner();
begin
  update public.private_debts set archived_at = now(), version = version + 1
  where id = p_id and owner_id = actor and archived_at is null and version = p_version;
  if not found and not exists (
    select 1 from public.private_debts where id = p_id and owner_id = actor
      and archived_at is not null and version - 1 = p_version
  ) then raise exception 'private_debt_changed'; end if;
end;
$$;

-- Private and accepted shared balances are distinct sources. Only confirmed shared payments reduce a balance.
create function public.debt_overview()
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
    (select count(*) from public.money_requests where recipient = (select auth.uid()) and state = 'pending')
  from totals t left join lateral (
    select * from balances where due_on is not null order by due_on, source, id limit 1
  ) b on true;
$$;

revoke all on function public.capture_private_debt_activity(),
  public.save_private_debt(uuid,text,text,integer,date,integer),
  public.record_private_debt_payment(uuid,uuid,integer,date),
  public.archive_private_debt(uuid,integer), public.debt_overview() from public, anon, authenticated;
grant execute on function public.save_private_debt(uuid,text,text,integer,date,integer),
  public.record_private_debt_payment(uuid,uuid,integer,date),
  public.archive_private_debt(uuid,integer), public.debt_overview() to authenticated;
