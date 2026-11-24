alter table public.monthly_expense_items alter column due_day drop not null;
alter table public.monthly_expense_dues alter column due_on drop not null;

create table public.monthly_expense_payments (
  expense_id uuid primary key references public.expenses(id),
  due_id uuid not null references public.monthly_expense_dues(id) on delete cascade
);
create index monthly_payments_due on public.monthly_expense_payments(due_id);
alter table public.monthly_expense_payments enable row level security;
revoke all on public.monthly_expense_payments from public, anon, authenticated;

-- Include the original single payment alongside any newer partial payments.
create view public.monthly_active_payments as
select links.due_id, e.id as expense_id, e.owner_id, e.amount_minor, e.spent_on
from (
  select d.id as due_id, d.expense_id from public.monthly_expense_dues d where d.expense_id is not null
  union all
  select p.due_id, p.expense_id from public.monthly_expense_payments p
) links
join public.expenses e on e.id=links.expense_id
where e.archived_at is null;
revoke all on public.monthly_active_payments from public, anon, authenticated;
create or replace function public.monthly_expense_add(p_id uuid, p_name text, p_amount integer, p_day integer, p_category text)
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
      and amount_minor=p_amount and due_day is not distinct from p_day and category=p_category) then
    raise exception 'monthly_changed';
  end if;
end;
$$;

create or replace function public.monthly_expense_list(p_month date)
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
    case when i.due_day is not null then month_start + (least(i.due_day,extract(day from month_end)::integer)-1) end
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

create or replace function public.monthly_expense_pay(p_due uuid,p_expense uuid,p_amount integer,p_paid_on date)
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

  if exists(select 1 from public.monthly_expense_payments p
    join public.expenses e on e.id=p.expense_id
    where p.due_id=due.id and e.archived_at is null) then
    raise exception 'monthly_changed';
  end if;

  -- Store the payment's origin on the purchase so deleting a checklist cannot change its budget treatment.
  insert into public.expenses (id,owner_id,item,amount_minor,category,spent_on,from_monthly_expense)
  values (p_expense,actor,btrim(due.name),p_amount,due.category,p_paid_on,true)
  on conflict (id) do nothing;
  if not found then raise exception 'monthly_changed'; end if;
  update public.monthly_expense_dues set expense_id=p_expense where id=due.id;
end;
$$;

create or replace function public.monthly_expense_unpay(p_due uuid,p_expense uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare actor uuid := public.confirmed_expense_owner(); due public.monthly_expense_dues; expense public.expenses;
begin
  select * into due from public.monthly_expense_dues where id=p_due and owner_id=actor for update;
  if not found or (due.expense_id is distinct from p_expense and not exists(
    select 1 from public.monthly_expense_payments where due_id=p_due and expense_id=p_expense)) then raise exception 'monthly_changed'; end if;
  select * into expense from public.expenses where id=p_expense and owner_id=actor for update;
  if not found then raise exception 'monthly_changed'; end if;
  if expense.archived_at is null then
    perform public.archive_expense(expense.id,expense.version);
  end if;
end;
$$;

create function public.monthly_expense_balances(p_month date)
returns table(id uuid,item_id uuid,name text,expected_minor integer,category text,due_on date,
  month date,paid_minor bigint,payments jsonb,stops_on date)
language sql security definer set search_path = ''
as $$
  select d.id,d.item_id,d.name,d.expected_minor,d.category,d.due_on,
    date_trunc('month',p_month::timestamp)::date,coalesce(p.total,0),
    coalesce(p.payments,'[]'::jsonb),d.stops_on
  from public.monthly_expense_list(p_month) d
  cross join lateral (
    select sum(e.amount_minor) as total,
      jsonb_agg(jsonb_build_object('id',e.expense_id,'amount_minor',e.amount_minor,'paid_on',e.spent_on)
        order by e.spent_on desc,e.expense_id) as payments
    from public.monthly_active_payments e
    where e.due_id=d.id and e.owner_id=(select auth.uid())
  ) p
  order by (coalesce(p.total,0)>=d.expected_minor),d.due_on nulls last,d.id;
$$;

create function public.monthly_expense_record_payment(p_due uuid,p_expense uuid,p_amount integer,p_paid_on date)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := public.confirmed_expense_owner();
  due public.monthly_expense_dues;
  paid bigint;
begin
  select * into due from public.monthly_expense_dues where id=p_due and owner_id=actor for update;
  if not found then raise exception 'monthly_changed'; end if;
  if p_amount is null or p_amount <= 0 or p_paid_on is null
    or p_paid_on > (now() at time zone 'Africa/Cairo')::date or p_paid_on < due.month then
    raise invalid_parameter_value;
  end if;

  if exists(select 1 from public.monthly_expense_payments p join public.expenses e on e.id=p.expense_id
    where p.due_id=p_due and e.id=p_expense and e.owner_id=actor
    and e.amount_minor=p_amount and e.spent_on=p_paid_on) then
    return;
  end if;

  select coalesce(sum(e.amount_minor),0) into paid
    from public.monthly_active_payments e where e.due_id=p_due and e.owner_id=actor;
  if p_amount > due.expected_minor-paid then raise exception 'monthly_changed'; end if;

  insert into public.expenses(id,owner_id,item,amount_minor,category,spent_on,from_monthly_expense)
  values(p_expense,actor,due.name,p_amount,due.category,p_paid_on,true)
  on conflict (id) do nothing;
  if not found then raise exception 'monthly_changed'; end if;
  insert into public.monthly_expense_payments(expense_id,due_id) values(p_expense,p_due);
end;
$$;

revoke all on function public.monthly_expense_balances(date),
  public.monthly_expense_record_payment(uuid,uuid,integer,date) from public, anon, authenticated;
grant execute on function public.monthly_expense_balances(date),
  public.monthly_expense_record_payment(uuid,uuid,integer,date) to authenticated;
