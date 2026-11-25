create function public.purchase_list_groups(p_month date, p_category text, p_offset integer)
returns table(group_key text, purchases jsonb)
language sql stable security definer set search_path = ''
as $$
  with matching as (
    select e, e.id, e.spent_on,
      case when p.due_id is null then 'purchase:' || e.id::text
        else 'monthly:' || p.due_id::text end as group_key
    from public.expenses e
    left join public.monthly_active_payments p on p.expense_id=e.id and p.owner_id=e.owner_id
    where e.owner_id=(select auth.uid()) and e.archived_at is null
      and e.spent_on>=p_month and e.spent_on<p_month+interval '1 month'
      and (p_category is null or e.category=p_category)
  )
  select m.group_key, jsonb_agg(to_jsonb(m.e) order by m.spent_on desc,m.id desc)
  from matching m
  group by m.group_key
  order by max(m.spent_on) desc, max(m.id::text) desc, m.group_key
  limit 16 offset greatest(p_offset,0);
$$;

revoke all on function public.purchase_list_groups(date,text,integer) from public, anon, authenticated;
grant execute on function public.purchase_list_groups(date,text,integer) to authenticated;
