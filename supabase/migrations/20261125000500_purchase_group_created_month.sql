create function public.list_purchase_folders_with_months()
returns table(id uuid, name text, sections jsonb, purchases jsonb, created_month text)
language sql stable security definer set search_path = ''
as $$
  select f.id,f.name,f.sections,f.purchases,to_char(c.created_at at time zone 'Africa/Cairo','YYYY-MM')
  from public.list_purchase_folders() f
  join public.purchase_collections c on c.id=f.id
  where c.owner_id=(select auth.uid())
  order by c.created_at desc,c.id;
$$;

revoke all on function public.list_purchase_folders_with_months() from public, anon, authenticated;
grant execute on function public.list_purchase_folders_with_months() to authenticated;
