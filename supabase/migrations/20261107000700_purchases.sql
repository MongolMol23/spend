create table public.expense_categories (
  code text primary key
);

insert into public.expense_categories (code) values
  ('groceries'), ('transport'), ('dining'), ('bills'), ('health'), ('shopping'), ('other');

create table public.expenses (
  id uuid primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  item text not null check (char_length(item) between 1 and 120 and item ~ '[^[:space:]]'),
  amount_minor integer not null check (amount_minor > 0),
  category text not null references public.expense_categories(code),
  spent_on date not null check (spent_on between date '0001-01-01' and date '9999-12-31'),
  note text check (char_length(note) <= 500),
  version integer not null default 1 check (version > 0),
  archived_at timestamptz
);

create index expenses_owner_calendar on public.expenses (owner_id, spent_on desc, id desc)
  where archived_at is null;

create table public.personal_activity (
  id bigint generated always as identity primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  entity_type text not null,
  entity_id uuid not null,
  action text not null check (action in ('created', 'updated', 'archived')),
  before_data jsonb,
  after_data jsonb not null,
  created_at timestamptz not null default now()
);

create index personal_activity_owner_history on public.personal_activity (owner_id, entity_type, id desc);
create unique index personal_activity_created_entity on public.personal_activity (entity_type, entity_id)
  where action = 'created';

alter table public.expense_categories enable row level security;
alter table public.expenses enable row level security;
alter table public.personal_activity enable row level security;

revoke all on public.expense_categories, public.expenses, public.personal_activity from public, anon, authenticated;
grant select on public.expense_categories, public.expenses, public.personal_activity to authenticated;

create policy expense_categories_read on public.expense_categories for select to authenticated using (true);
create policy expenses_owner_read on public.expenses for select to authenticated using ((select auth.uid()) = owner_id);
create policy personal_activity_owner_read on public.personal_activity for select to authenticated
  using ((select auth.uid()) = owner_id);

-- The purchase and its history commit together. Client roles can only read the history.
create function public.capture_expense_activity()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.personal_activity (owner_id, entity_type, entity_id, action, before_data, after_data)
  values (
    new.owner_id, 'purchase', new.id,
    case when tg_op = 'INSERT' then 'created'
         when new.archived_at is not null and old.archived_at is null then 'archived'
         else 'updated' end,
    case when tg_op = 'UPDATE' then to_jsonb(old) - 'owner_id' end,
    to_jsonb(new) - 'owner_id'
  );
  return new;
end;
$$;

create trigger expense_activity after insert or update on public.expenses
  for each row execute function public.capture_expense_activity();

create function public.confirmed_expense_owner()
returns uuid language plpgsql security definer set search_path = ''
as $$
declare actor uuid := auth.uid();
begin
  if actor is null or not exists (
    select 1 from auth.users where id = actor and email_confirmed_at is not null
  ) then
    raise exception 'expense_signin_required' using errcode = '42501';
  end if;
  return actor;
end;
$$;

create function public.save_expense(
  p_id uuid, p_item text, p_amount integer, p_category text, p_spent_on date,
  p_note text default null, p_version integer default null
)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := public.confirmed_expense_owner();
  desired jsonb := jsonb_build_object('item', btrim(p_item), 'amount_minor', p_amount,
    'category', p_category, 'spent_on', p_spent_on, 'note', p_note);
begin
  if p_version is null then
    insert into public.expenses (id, owner_id, item, amount_minor, category, spent_on, note)
    values (p_id, actor, btrim(p_item), p_amount, p_category, p_spent_on, p_note)
    on conflict (id) do nothing;
    -- A retry must match the original creation, even if this expense was later edited.
    if not found and not exists (
      select 1 from public.personal_activity
      where owner_id = actor and entity_type = 'purchase' and entity_id = p_id
        and action = 'created' and after_data @> desired
    ) then
      raise exception 'expense_changed';
    end if;
    return;
  end if;

  update public.expenses set item = btrim(p_item), amount_minor = p_amount, category = p_category,
    spent_on = p_spent_on, note = p_note, version = version + 1
  where id = p_id and owner_id = actor and archived_at is null and version = p_version;
  if not found and not exists (
    select 1 from public.expenses e where e.id = p_id and e.owner_id = actor
      and e.archived_at is null and e.version - 1 = p_version and to_jsonb(e) @> desired
  ) then
    raise exception 'expense_changed';
  end if;
end;
$$;

create function public.archive_expense(p_id uuid, p_version integer)
returns void language plpgsql security definer set search_path = ''
as $$
declare actor uuid := public.confirmed_expense_owner();
begin
  update public.expenses set archived_at = now(), version = version + 1
  where id = p_id and owner_id = actor and archived_at is null and version = p_version;
  if not found and not exists (
    select 1 from public.expenses where id = p_id and owner_id = actor
      and archived_at is not null and version - 1 = p_version
  ) then
    raise exception 'expense_changed';
  end if;
end;
$$;

create function public.expense_month_summary(p_month date)
returns table (category text, total_minor bigint)
language sql stable security invoker set search_path = ''
as $$
  select e.category, sum(e.amount_minor)
  from public.expenses e
  where e.owner_id = (select auth.uid()) and e.archived_at is null
    and e.spent_on >= date_trunc('month', p_month::timestamp)::date
    and e.spent_on < date_trunc('month', p_month::timestamp) + interval '1 month'
  group by e.category
  order by e.category;
$$;

revoke all on function public.capture_expense_activity(), public.confirmed_expense_owner(),
  public.save_expense(uuid,text,integer,text,date,text,integer), public.archive_expense(uuid,integer),
  public.expense_month_summary(date) from public, anon, authenticated;
grant execute on function public.save_expense(uuid,text,integer,text,date,text,integer),
  public.archive_expense(uuid,integer), public.expense_month_summary(date) to authenticated;
