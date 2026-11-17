create table public.spending_budgets (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  amount_minor integer not null check (amount_minor > 0),
  starts_on date not null,
  ends_on date not null check (ends_on >= starts_on and ends_on - starts_on <= 365)
);

alter table public.spending_budgets enable row level security;
revoke all on public.spending_budgets from public, anon, authenticated;
grant select on public.spending_budgets to authenticated;
create policy spending_budgets_owner on public.spending_budgets for select to authenticated
  using (owner_id = (select auth.uid()));

create function public.spend_save_budget(p_amount integer, p_end date)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  owner uuid := auth.uid();
  today date := (now() at time zone 'Africa/Cairo')::date;
begin
  if owner is null then raise insufficient_privilege; end if;
  if p_end is null or p_end < today then raise invalid_parameter_value; end if;

  insert into public.spending_budgets as b (owner_id, amount_minor, starts_on, ends_on)
  values (owner, p_amount, today, p_end)
  on conflict (owner_id) do update set
    amount_minor = excluded.amount_minor,
    starts_on = case when b.ends_on >= today then b.starts_on else today end,
    ends_on = excluded.ends_on;
end;
$$;

-- SECURITY INVOKER keeps every underlying ledger read subject to its existing privacy rules.
create function public.spend_budget_overview()
returns table (amount_minor integer, starts_on date, ends_on date, today date, spent_minor bigint, today_minor bigint)
language sql stable set search_path = ''
as $$
  with budget as (
    select b.*, (now() at time zone 'Africa/Cairo')::date as today
    from public.spending_budgets b where b.owner_id = (select auth.uid())
  )
  select b.amount_minor, b.starts_on, b.ends_on, b.today, coalesce(t.spent, 0), coalesce(t.spent_today, 0)
  from budget b
  cross join lateral (
    select sum(amount) as spent, sum(amount) filter (where day = b.today) as spent_today
    from (
      select e.amount_minor as amount, e.spent_on as day from public.expenses e
        where e.owner_id = b.owner_id and e.archived_at is null
      union all
      select p.amount_minor, p.paid_on from public.private_debt_payments p
        join public.private_debts d on d.id = p.debt_id where d.owner_id = b.owner_id and d.direction = 'owe'
      union all
      select p.amount_minor, p.paid_on from public.installment_payments p
        join public.installment_dues d on d.id = p.due_id
        join public.installment_plans i on i.id = d.plan_id where i.owner_id = b.owner_id
      union all
      select p.amount_minor, (p.created_at at time zone 'Africa/Cairo')::date from public.request_payments p
        join public.money_requests r on r.id = p.request_id
        where r.recipient = b.owner_id and p.state in ('pending', 'confirmed')
    ) entries
    where day between b.starts_on and least(b.today, b.ends_on)
  ) t;
$$;

revoke all on function public.spend_save_budget(integer,date), public.spend_budget_overview() from public, anon, authenticated;
grant execute on function public.spend_save_budget(integer,date), public.spend_budget_overview() to authenticated;
