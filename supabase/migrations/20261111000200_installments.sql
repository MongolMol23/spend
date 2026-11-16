create table public.installment_plans (
  id uuid primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120 and name ~ '[^[:space:]]'),
  total_minor integer not null check (total_minor > 0),
  schedule jsonb not null,
  version integer not null default 1,
  archived_at timestamptz
);
create index installment_plans_owner on public.installment_plans (owner_id, name, id);
create table public.installment_dues (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.installment_plans(id) on delete cascade,
  due_on date not null check (due_on between date '0001-01-01' and date '9999-12-31'),
  amount_minor integer not null check (amount_minor > 0),
  paid_minor integer not null default 0 check (paid_minor between 0 and amount_minor)
);
create index installment_dues_plan on public.installment_dues (plan_id, due_on, id);
create table public.installment_payments (
  id uuid primary key,
  due_id uuid not null references public.installment_dues(id) on delete cascade,
  amount_minor integer not null check (amount_minor > 0),
  paid_on date not null check (paid_on between date '0001-01-01' and date '9999-12-31')
);
create index installment_payments_due on public.installment_payments (due_id, paid_on desc, id desc);

alter table public.installment_plans enable row level security;
alter table public.installment_dues enable row level security;
alter table public.installment_payments enable row level security;
revoke all on public.installment_plans, public.installment_dues, public.installment_payments from public, anon, authenticated;
grant select on public.installment_plans, public.installment_dues, public.installment_payments to authenticated;
create policy installment_plan_owner on public.installment_plans for select to authenticated using (owner_id = (select auth.uid()));
create policy installment_due_owner on public.installment_dues for select to authenticated
  using (exists (select 1 from public.installment_plans p where p.id = plan_id));
create policy installment_payment_owner on public.installment_payments for select to authenticated
  using (exists (select 1 from public.installment_dues d where d.id = due_id));

create function public.save_installment_plan(p_id uuid, p_name text, p_total integer, p_schedule jsonb, p_version integer default null)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := public.confirmed_expense_owner();
  previous public.installment_plans%rowtype;
  saved public.installment_plans%rowtype;
begin
  if jsonb_typeof(p_schedule) is distinct from 'array' then raise exception 'installment_schedule'; end if;
  if jsonb_array_length(p_schedule) not between 1 and 120 or p_total is null or p_total <= 0 then
    raise exception 'installment_schedule';
  end if;
  if (select coalesce(sum(s.amount_minor), 0) from jsonb_to_recordset(p_schedule) s(due_on date, amount_minor integer)) <> p_total
    or exists (select 1 from jsonb_to_recordset(p_schedule) s(due_on date, amount_minor integer)
      where s.amount_minor is null or s.amount_minor <= 0 or s.due_on is null
        or s.due_on not between date '0001-01-01' and date '9999-12-31') then
    raise exception 'installment_schedule';
  end if;
  select jsonb_agg(jsonb_build_object('due_on', s.due_on, 'amount_minor', s.amount_minor) order by s.due_on, s.amount_minor)
  into p_schedule from jsonb_to_recordset(p_schedule) s(due_on date, amount_minor integer);
  if p_version is null then
    insert into public.installment_plans (id, owner_id, name, total_minor, schedule)
    values (p_id, actor, btrim(p_name), p_total, p_schedule)
    on conflict (id) do nothing returning * into saved;
    if not found then
      if exists (select 1 from public.personal_activity where owner_id = actor and entity_type = 'installment_plan'
        and entity_id = p_id and action = 'created' and after_data->>'name' = btrim(p_name)
        and (after_data->>'total_minor')::integer = p_total and after_data->'schedule' = p_schedule) then return; end if;
      raise exception 'installment_changed';
    end if;
  else
    select * into previous from public.installment_plans where id = p_id and owner_id = actor and archived_at is null for update;
    if not found then raise exception 'installment_changed'; end if;
    if previous.version in (p_version, p_version + 1) and previous.name = btrim(p_name)
      and previous.total_minor = p_total and previous.schedule = p_schedule then return; end if;
    if previous.version <> p_version then raise exception 'installment_changed'; end if;
    if previous.schedule <> p_schedule or previous.total_minor <> p_total then
      if exists (select 1 from public.installment_dues where plan_id = p_id and paid_minor > 0) then
        raise exception 'installment_schedule_locked';
      end if;
      delete from public.installment_dues where plan_id = p_id;
    end if;
    update public.installment_plans set name = btrim(p_name), total_minor = p_total, schedule = p_schedule, version = version + 1
    where id = p_id returning * into saved;
  end if;
  if p_version is null or previous.schedule <> p_schedule or previous.total_minor <> p_total then
    insert into public.installment_dues (plan_id, due_on, amount_minor)
    select p_id, s.due_on, s.amount_minor from jsonb_to_recordset(p_schedule) s(due_on date, amount_minor integer);
  end if;
  insert into public.personal_activity (owner_id, entity_type, entity_id, action, before_data, after_data)
  values (actor, 'installment_plan', p_id, case when p_version is null then 'created' else 'updated' end,
    case when p_version is not null then to_jsonb(previous) - 'owner_id' end, to_jsonb(saved) - 'owner_id');
end;
$$;

create function public.record_installment_payment(p_id uuid, p_due uuid, p_amount integer, p_paid_on date)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := public.confirmed_expense_owner();
  plan public.installment_plans%rowtype;
  due public.installment_dues%rowtype;
begin
  -- Take the plan lock before reading the installment so schedule edits and payments serialize.
  select p.* into plan from public.installment_plans p join public.installment_dues d on d.plan_id = p.id
  where d.id = p_due and p.owner_id = actor for update of p;
  if not found then raise exception 'installment_changed'; end if;
  if exists (select 1 from public.installment_payments where id = p_id and due_id = p_due
    and amount_minor = p_amount and paid_on = p_paid_on) then return; end if;
  select * into due from public.installment_dues where id = p_due and plan_id = plan.id;
  if not found or plan.archived_at is not null then raise exception 'installment_changed'; end if;
  if p_amount is null or p_amount <= 0 or p_amount > due.amount_minor - due.paid_minor then
    raise exception 'installment_payment_exceeds_balance';
  end if;
  insert into public.installment_payments (id, due_id, amount_minor, paid_on)
  values (p_id, p_due, p_amount, p_paid_on) on conflict (id) do nothing;
  if not found then raise exception 'installment_changed'; end if;
  update public.installment_dues set paid_minor = paid_minor + p_amount where id = p_due;
  update public.installment_plans set version = version + 1 where id = plan.id;
  insert into public.personal_activity (owner_id, entity_type, entity_id, action, before_data, after_data)
  values (actor, 'installment_payment', p_id, 'created', null,
    jsonb_build_object('plan_id', plan.id, 'name', plan.name, 'due_on', due.due_on, 'paid_on', p_paid_on,
      'amount_minor', p_amount, 'remaining_minor', due.amount_minor - due.paid_minor - p_amount));
end;
$$;

create function public.archive_installment_plan(p_id uuid, p_version integer)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := public.confirmed_expense_owner();
  previous public.installment_plans%rowtype;
  saved public.installment_plans%rowtype;
begin
  select * into previous from public.installment_plans where id = p_id and owner_id = actor for update;
  if not found then raise exception 'installment_changed'; end if;
  if previous.archived_at is not null and previous.version - 1 = p_version then return; end if;
  if previous.archived_at is not null or previous.version is distinct from p_version then
    raise exception 'installment_changed';
  end if;
  update public.installment_plans set archived_at = now(), version = version + 1 where id = p_id returning * into saved;
  insert into public.personal_activity (owner_id, entity_type, entity_id, action, before_data, after_data)
  values (actor, 'installment_plan', p_id, 'archived', to_jsonb(previous) - 'owner_id', to_jsonb(saved) - 'owner_id');
end;
$$;

create function public.installment_overview(p_month date)
returns table (paid_minor bigint, remaining_minor bigint, overdue_minor bigint,
  next_plan_id uuid, next_name text, next_due_on date, next_minor integer)
language sql stable security invoker set search_path = ''
as $$
  with open_dues as (
    select d.id, d.plan_id, p.name, d.due_on, d.amount_minor - d.paid_minor as remaining
    from public.installment_dues d join public.installment_plans p on p.id = d.plan_id
    where p.owner_id = (select auth.uid()) and p.archived_at is null and d.amount_minor > d.paid_minor
  ), totals as (
    select coalesce(sum(remaining), 0) as remaining,
      coalesce(sum(remaining) filter (where due_on < (now() at time zone 'Africa/Cairo')::date), 0) as overdue
    from open_dues
  ), paid as (
    select coalesce(sum(m.amount_minor), 0) as total
    from public.installment_payments m join public.installment_dues d on d.id = m.due_id
    join public.installment_plans p on p.id = d.plan_id
    where p.owner_id = (select auth.uid())
      and m.paid_on >= date_trunc('month', p_month::timestamp)::date
      and m.paid_on < date_trunc('month', p_month::timestamp) + interval '1 month'
  )
  select paid.total, totals.remaining, totals.overdue, next.plan_id, next.name, next.due_on, next.remaining
  from totals cross join paid left join lateral (
    select * from open_dues order by due_on, id limit 1
  ) next on true;
$$;

revoke all on function public.save_installment_plan(uuid,text,integer,jsonb,integer),
  public.record_installment_payment(uuid,uuid,integer,date), public.archive_installment_plan(uuid,integer),
  public.installment_overview(date) from public, anon, authenticated;
grant execute on function public.save_installment_plan(uuid,text,integer,jsonb,integer),
  public.record_installment_payment(uuid,uuid,integer,date), public.archive_installment_plan(uuid,integer),
  public.installment_overview(date) to authenticated;
