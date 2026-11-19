alter table public.expenses add column from_monthly_expense boolean not null default false;

-- Backfill payments whose checklist entry still exists without adding purchase edits to the history.
do $$
begin
  alter table public.expenses disable trigger expense_activity;
  update public.expenses e
  set from_monthly_expense = true
  where exists (
    select 1 from public.monthly_expense_dues d
    where d.expense_id = e.id and d.owner_id = e.owner_id
  );
  alter table public.expenses enable trigger expense_activity;
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

  -- Store the payment's origin on the purchase so deleting a checklist cannot change its budget treatment.
  insert into public.expenses (id,owner_id,item,amount_minor,category,spent_on,from_monthly_expense)
  values (p_expense,actor,btrim(due.name),p_amount,due.category,p_paid_on,true)
  on conflict (id) do nothing;
  if not found then raise exception 'monthly_changed'; end if;
  update public.monthly_expense_dues set expense_id=p_expense where id=due.id;
end;
$$;

create or replace function public.spend_budget_overview()
returns table (amount_minor integer, starts_on date, ends_on date, today date, spent_minor bigint, today_minor bigint)
language sql stable security invoker set search_path = ''
as $$
  with budget as (
    select b.*, (now() at time zone 'Africa/Cairo')::date as today
    from public.spending_budgets b where b.owner_id = (select auth.uid())
  )
  select b.amount_minor, b.starts_on, b.ends_on, b.today, coalesce(t.spent, 0), coalesce(t.spent_today, 0)
  from budget b
  cross join lateral (
    select sum(e.amount_minor) as spent, sum(e.amount_minor) filter (where e.spent_on = b.today) as spent_today
    from public.expenses e
    where e.owner_id = b.owner_id and e.archived_at is null
      and not e.from_monthly_expense and e.category <> 'bills'
      and e.spent_on between b.starts_on and least(b.today, b.ends_on)
  ) t;
$$;
