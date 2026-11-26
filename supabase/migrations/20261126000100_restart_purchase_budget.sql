create function public.spend_save_budget(p_amount integer, p_end date, p_restart boolean)
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
    starts_on = case when p_restart or b.ends_on < today then today else b.starts_on end,
    ends_on = excluded.ends_on;
end;
$$;

revoke all on function public.spend_save_budget(integer,date,boolean) from public, anon, authenticated;
grant execute on function public.spend_save_budget(integer,date,boolean) to authenticated;

create or replace function public.spend_save_budget(p_amount integer, p_end date)
returns void language sql security invoker set search_path = ''
as $$
  select public.spend_save_budget(p_amount, p_end, false);
$$;
