create table public.monthly_expense_items (
  id uuid primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  amount_minor integer not null check (amount_minor > 0),
  due_day integer not null check (due_day between 1 and 31),
  category text not null references public.expense_categories(code),
  starts_on date not null,
  stops_on date,
  check (stops_on is null or stops_on > starts_on)
);
create table public.monthly_expense_dues (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.monthly_expense_items(id),
  owner_id uuid not null references auth.users(id) on delete cascade,
  month date not null,
  name text not null,
  expected_minor integer not null check (expected_minor > 0),
  category text not null references public.expense_categories(code),
  due_on date not null,
  expense_id uuid references public.expenses(id),
  unique (item_id, month),
  unique (expense_id)
);
create index monthly_items_owner on public.monthly_expense_items(owner_id);
create index monthly_dues_owner_month on public.monthly_expense_dues(owner_id, month);
alter table public.monthly_expense_items enable row level security;
alter table public.monthly_expense_dues enable row level security;
revoke all on public.monthly_expense_items, public.monthly_expense_dues from public, anon, authenticated;
grant select on public.monthly_expense_items, public.monthly_expense_dues to authenticated;
create policy monthly_items_read on public.monthly_expense_items for select to authenticated
  using (owner_id = (select auth.uid()));
create policy monthly_dues_read on public.monthly_expense_dues for select to authenticated
  using (owner_id = (select auth.uid()));

create function public.monthly_expense_add(p_id uuid, p_name text, p_amount integer, p_day integer, p_category text)
returns void language plpgsql security definer set search_path = ''
as $$
declare actor uuid := public.confirmed_expense_owner();
begin
  perform pg_advisory_xact_lock(hashtextextended(actor::text, 71));
  insert into public.monthly_expense_items(id,owner_id,name,amount_minor,due_day,category,starts_on)
  values (p_id,actor,btrim(p_name),p_amount,p_day,p_category,
    date_trunc('month',now() at time zone 'Africa/Cairo')::date)
  on conflict(id) do nothing;
  if not found and not exists(select 1 from public.monthly_expense_items
    where id=p_id and owner_id=actor and name=btrim(p_name)
      and amount_minor=p_amount and due_day=p_day and category=p_category) then
    raise exception 'monthly_changed';
  end if;
end;
$$;

-- Snapshot each month's expected amounts so later months keep their own checklist.
create function public.monthly_expense_list(p_month date)
returns table(id uuid,item_id uuid,name text,expected_minor integer,category text,due_on date,
  expense_id uuid,paid_minor integer,paid_on date,stops_on date)
language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := public.confirmed_expense_owner();
  month_start date := date_trunc('month',p_month::timestamp)::date;
  month_end date := (month_start + interval '1 month - 1 day')::date;
begin
  if p_month is null or p_month < date '0001-01-01' or p_month > date '9999-12-01' then
    raise invalid_parameter_value;
  end if;
  perform pg_advisory_xact_lock(hashtextextended(actor::text, 71));
  insert into public.monthly_expense_dues(item_id,owner_id,month,name,expected_minor,category,due_on)
  select i.id,actor,month_start,i.name,i.amount_minor,i.category,
    month_start + (least(i.due_day,extract(day from month_end)::integer)-1)
  from public.monthly_expense_items i
  where i.owner_id=actor and i.starts_on<=month_start and (i.stops_on is null or i.stops_on>month_start)
  on conflict on constraint monthly_expense_dues_item_id_month_key do nothing;
  return query
  select d.id,d.item_id,d.name,d.expected_minor,d.category,d.due_on,
    e.id,e.amount_minor,e.spent_on,i.stops_on
  from public.monthly_expense_dues d
  join public.monthly_expense_items i on i.id=d.item_id
  left join public.expenses e on e.id=d.expense_id and e.archived_at is null
  where d.owner_id=actor and d.month=month_start
  order by (e.id is not null),d.due_on,d.id;
end;
$$;

create function public.monthly_expense_pay(p_due uuid,p_expense uuid,p_amount integer,p_paid_on date)
returns void language plpgsql security definer set search_path = ''
as $$
declare actor uuid := public.confirmed_expense_owner(); due public.monthly_expense_dues;
begin
  select * into due from public.monthly_expense_dues where id=p_due and owner_id=actor for update;
  if not found then raise exception 'monthly_changed'; end if;
  if p_paid_on is null or p_paid_on > (now() at time zone 'Africa/Cairo')::date
    or p_paid_on < due.month then
    raise invalid_parameter_value;
  end if;
  if exists(select 1 from public.expenses where id=due.expense_id and archived_at is null) then
    if due.expense_id=p_expense and exists(select 1 from public.expenses
      where id=p_expense and amount_minor=p_amount and spent_on=p_paid_on) then return; end if;
    raise exception 'monthly_already_paid';
  end if;
  -- The ledger expense and paid check commit together, including the existing purchase audit trail.
  perform public.save_expense(p_expense,due.name,p_amount,due.category,p_paid_on);
  if exists(select 1 from public.expenses where id=p_expense and archived_at is not null) then
    raise exception 'monthly_changed';
  end if;
  update public.monthly_expense_dues set expense_id=p_expense where id=due.id;
end;
$$;

create function public.monthly_expense_unpay(p_due uuid,p_expense uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare actor uuid := public.confirmed_expense_owner(); due public.monthly_expense_dues; expense public.expenses;
begin
  select * into due from public.monthly_expense_dues where id=p_due and owner_id=actor for update;
  if not found or due.expense_id is distinct from p_expense then raise exception 'monthly_changed'; end if;
  select * into expense from public.expenses where id=p_expense and owner_id=actor for update;
  if not found then raise exception 'monthly_changed'; end if;
  if expense.archived_at is null then
    perform public.archive_expense(expense.id,expense.version);
  end if;
end;
$$;

create function public.monthly_expense_stop(p_item uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare actor uuid := public.confirmed_expense_owner();
begin
  perform pg_advisory_xact_lock(hashtextextended(actor::text, 71));
  update public.monthly_expense_items set stops_on=coalesce(stops_on,
    (date_trunc('month',now() at time zone 'Africa/Cairo')+interval '1 month')::date)
  where id=p_item and owner_id=actor;
  if not found then raise exception 'monthly_changed'; end if;
  -- Discard only unpaid future snapshots which may have been viewed in advance.
  delete from public.monthly_expense_dues d using public.monthly_expense_items i
  where d.item_id=i.id and i.id=p_item and i.owner_id=actor and d.month>=i.stops_on
    and not exists(select 1 from public.expenses e where e.id=d.expense_id and e.archived_at is null);
end;
$$;
revoke all on function public.monthly_expense_add(uuid,text,integer,integer,text),
  public.monthly_expense_list(date),public.monthly_expense_pay(uuid,uuid,integer,date),
  public.monthly_expense_unpay(uuid,uuid),public.monthly_expense_stop(uuid) from public,anon,authenticated;
grant execute on function public.monthly_expense_add(uuid,text,integer,integer,text),
  public.monthly_expense_list(date),public.monthly_expense_pay(uuid,uuid,integer,date),
  public.monthly_expense_unpay(uuid,uuid),public.monthly_expense_stop(uuid) to authenticated;
