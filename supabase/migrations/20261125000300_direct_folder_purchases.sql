alter table public.purchase_section_entries
  alter column section_id drop not null,
  add column collection_id uuid references public.purchase_collections(id) on delete cascade,
  add constraint purchase_entry_destination check (num_nonnulls(section_id, collection_id) = 1);
create index purchase_section_entries_collection on public.purchase_section_entries(collection_id)
  where collection_id is not null;

create function public.save_purchase_in_folder(p_collection uuid, p_section uuid, p_id uuid,
  p_item text, p_amount integer, p_category text, p_spent_on date, p_note text)
returns void language plpgsql security definer set search_path = ''
as $$
declare actor uuid := public.confirmed_expense_owner();
begin
  if num_nonnulls(p_collection,p_section) <> 1 or not exists (
    select 1 from public.purchase_collections c
    where c.owner_id=actor and (c.id=p_collection or exists (
      select 1 from public.purchase_sections s where s.id=p_section and s.collection_id=c.id
    ))
  ) then raise exception 'expense_changed'; end if;

  perform pg_advisory_xact_lock(hashtextextended(p_id::text, 83));
  if exists (select 1 from public.expenses where id=p_id) and not exists (
    select 1 from public.purchase_section_entries where expense_id=p_id
      and section_id is not distinct from p_section and collection_id is not distinct from p_collection
  ) then raise exception 'expense_changed'; end if;

  perform public.save_expense(p_id,p_item,p_amount,p_category,p_spent_on,p_note);
  insert into public.purchase_section_entries(expense_id,section_id,collection_id)
  values(p_id,p_section,p_collection) on conflict(expense_id) do nothing;
end;
$$;
revoke all on function public.save_purchase_in_folder(uuid,uuid,uuid,text,integer,text,date,text)
  from public, anon, authenticated;

create or replace function public.save_section_purchase(p_section uuid, p_id uuid, p_item text, p_amount integer,
  p_category text, p_spent_on date, p_note text default null)
returns void language sql security definer set search_path = ''
as $$ select public.save_purchase_in_folder(null,p_section,p_id,p_item,p_amount,p_category,p_spent_on,p_note) $$;

create function public.save_collection_purchase(p_collection uuid, p_id uuid, p_item text, p_amount integer,
  p_category text, p_spent_on date, p_note text default null)
returns void language sql security definer set search_path = ''
as $$ select public.save_purchase_in_folder(p_collection,null,p_id,p_item,p_amount,p_category,p_spent_on,p_note) $$;

create function public.list_purchase_folders()
returns table(id uuid, name text, sections jsonb, purchases jsonb)
language sql stable security definer set search_path = ''
as $$
  select c.id,c.name,c.sections,coalesce(entries.purchases,'[]'::jsonb)
  from public.list_purchase_collections() c
  cross join lateral (
    select jsonb_agg(to_jsonb(e) order by e.spent_on desc,e.id desc) as purchases
    from public.purchase_section_entries link join public.expenses e on e.id=link.expense_id
    where link.collection_id=c.id and e.owner_id=(select auth.uid()) and e.archived_at is null
  ) entries;
$$;

revoke all on function public.save_collection_purchase(uuid,uuid,text,integer,text,date,text),
  public.list_purchase_folders() from public, anon, authenticated;
grant execute on function public.save_collection_purchase(uuid,uuid,text,integer,text,date,text),
  public.list_purchase_folders() to authenticated;
