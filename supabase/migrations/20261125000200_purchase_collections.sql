create table public.purchase_collections (
  id uuid primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  created_at timestamptz not null default now()
);
create index purchase_collections_owner on public.purchase_collections(owner_id);

create table public.purchase_sections (
  id uuid primary key,
  collection_id uuid not null references public.purchase_collections(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  created_at timestamptz not null default now()
);
create index purchase_sections_collection on public.purchase_sections(collection_id);

create table public.purchase_section_entries (
  expense_id uuid primary key references public.expenses(id) on delete cascade,
  section_id uuid not null references public.purchase_sections(id) on delete cascade
);
create index purchase_section_entries_section on public.purchase_section_entries(section_id);

alter table public.purchase_collections enable row level security;
alter table public.purchase_sections enable row level security;
alter table public.purchase_section_entries enable row level security;
revoke all on public.purchase_collections, public.purchase_sections, public.purchase_section_entries
  from public, anon, authenticated;

create function public.create_purchase_collection(p_id uuid, p_name text, p_collection uuid default null)
returns void language plpgsql security definer set search_path = ''
as $$
declare actor uuid := public.confirmed_expense_owner();
begin
  if p_collection is null then
    insert into public.purchase_collections(id,owner_id,name)
    values(p_id,actor,btrim(p_name)) on conflict(id) do nothing;
    if not found and not exists (
      select 1 from public.purchase_collections where id=p_id and owner_id=actor and name=btrim(p_name)
    ) then raise exception 'expense_changed'; end if;
  else
    if not exists (select 1 from public.purchase_collections where id=p_collection and owner_id=actor) then
      raise exception 'expense_changed';
    end if;
    insert into public.purchase_sections(id,collection_id,name)
    values(p_id,p_collection,btrim(p_name)) on conflict(id) do nothing;
    if not found and not exists (
      select 1 from public.purchase_sections where id=p_id and collection_id=p_collection and name=btrim(p_name)
    ) then raise exception 'expense_changed'; end if;
  end if;
end;
$$;

create function public.save_section_purchase(p_section uuid, p_id uuid, p_item text, p_amount integer,
  p_category text, p_spent_on date, p_note text default null)
returns void language plpgsql security definer set search_path = ''
as $$
declare actor uuid := public.confirmed_expense_owner();
begin
  if not exists (
    select 1 from public.purchase_sections s join public.purchase_collections c on c.id=s.collection_id
    where s.id=p_section and c.owner_id=actor
  ) then raise exception 'expense_changed'; end if;

  perform pg_advisory_xact_lock(hashtextextended(p_id::text, 83));
  if exists (select 1 from public.expenses where id=p_id) and not exists (
    select 1 from public.purchase_section_entries where expense_id=p_id and section_id=p_section
  ) then raise exception 'expense_changed'; end if;

  perform public.save_expense(p_id,p_item,p_amount,p_category,p_spent_on,p_note);
  insert into public.purchase_section_entries(expense_id,section_id)
  values(p_id,p_section) on conflict(expense_id) do nothing;
end;
$$;

create function public.list_purchase_collections()
returns table(id uuid, name text, sections jsonb)
language sql stable security definer set search_path = ''
as $$
  select c.id,c.name,coalesce(items.sections,'[]'::jsonb)
  from public.purchase_collections c
  cross join lateral (
    select jsonb_agg(jsonb_build_object('id',s.id,'name',s.name,'purchases',coalesce(entries.purchases,'[]'::jsonb))
      order by s.created_at,s.id) as sections
    from public.purchase_sections s
    cross join lateral (
      select jsonb_agg(to_jsonb(e) order by e.spent_on desc,e.id desc) as purchases
      from public.purchase_section_entries link join public.expenses e on e.id=link.expense_id
      where link.section_id=s.id and e.owner_id=c.owner_id and e.archived_at is null
    ) entries
    where s.collection_id=c.id
  ) items
  where c.owner_id=(select auth.uid())
  order by c.created_at desc,c.id;
$$;

revoke all on function public.create_purchase_collection(uuid,text,uuid),
  public.save_section_purchase(uuid,uuid,text,integer,text,date,text),
  public.list_purchase_collections() from public, anon, authenticated;
grant execute on function public.create_purchase_collection(uuid,text,uuid),
  public.save_section_purchase(uuid,uuid,text,integer,text,date,text),
  public.list_purchase_collections() to authenticated;
