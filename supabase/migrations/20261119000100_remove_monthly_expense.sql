alter table public.monthly_expense_items
  drop constraint monthly_expense_items_check,
  add constraint monthly_expense_items_stop_date_check
    check (stops_on is null or stops_on >= starts_on);

create function public.monthly_expense_remove(p_item uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := public.confirmed_expense_owner();
  month_start date := date_trunc('month',now() at time zone 'Africa/Cairo')::date;
begin
  perform pg_advisory_xact_lock(hashtextextended(actor::text, 71));
  update public.monthly_expense_items
  set stops_on = least(stops_on, month_start)
  where id = p_item and owner_id = actor;
  if not found then raise exception 'monthly_changed'; end if;

  -- Dues reference purchases. Removing the checklist rows leaves those purchases intact.
  delete from public.monthly_expense_dues
  where item_id = p_item and owner_id = actor and month >= month_start;
end;
$$;

revoke all on function public.monthly_expense_remove(uuid) from public, anon, authenticated;
grant execute on function public.monthly_expense_remove(uuid) to authenticated;
