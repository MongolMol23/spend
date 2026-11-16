create table public.savings_goals (
  id uuid primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120 and name ~ '[^[:space:]]'),
  target_minor integer not null check (target_minor > 0),
  saved_minor integer not null default 0 check (saved_minor >= 0),
  target_on date check (target_on between date '0001-01-01' and date '9999-12-31'),
  version integer not null default 1,
  archived_at timestamptz
);
create index savings_goals_owner on public.savings_goals (owner_id, name, id);

create table public.savings_movements (
  id uuid primary key,
  goal_id uuid not null references public.savings_goals(id) on delete cascade,
  direction text not null check (direction in ('deposit', 'withdraw')),
  amount_minor integer not null check (amount_minor > 0),
  moved_on date not null check (moved_on between date '0001-01-01' and date '9999-12-31')
);
create index savings_movements_goal on public.savings_movements (goal_id, moved_on desc, id desc);

alter table public.savings_goals enable row level security;
alter table public.savings_movements enable row level security;
revoke all on public.savings_goals, public.savings_movements from public, anon, authenticated;
grant select on public.savings_goals, public.savings_movements to authenticated;
create policy savings_goal_owner on public.savings_goals for select to authenticated
  using (owner_id = (select auth.uid()));
create policy savings_movement_owner on public.savings_movements for select to authenticated
  using (exists (select 1 from public.savings_goals g where g.id = goal_id));

create function public.capture_savings_goal_activity()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  -- Movements record their own event in the same transaction as the balance update.
  if tg_op = 'UPDATE' and new.saved_minor <> old.saved_minor then return new; end if;
  insert into public.personal_activity (owner_id, entity_type, entity_id, action, before_data, after_data)
  values (new.owner_id, 'savings_goal', new.id,
    case when tg_op = 'INSERT' then 'created' when new.archived_at is not null then 'archived' else 'updated' end,
    case when tg_op = 'UPDATE' then to_jsonb(old) - 'owner_id' end, to_jsonb(new) - 'owner_id');
  return new;
end;
$$;
create trigger savings_goal_activity after insert or update on public.savings_goals
  for each row execute function public.capture_savings_goal_activity();

create function public.save_savings_goal(p_id uuid, p_name text, p_target integer,
  p_target_on date default null, p_version integer default null)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := public.confirmed_expense_owner();
  desired jsonb := jsonb_build_object('name', btrim(p_name), 'target_minor', p_target, 'target_on', p_target_on);
begin
  if p_version is null then
    insert into public.savings_goals (id, owner_id, name, target_minor, target_on)
    values (p_id, actor, btrim(p_name), p_target, p_target_on) on conflict (id) do nothing;
    if not found and not exists (
      select 1 from public.personal_activity where owner_id = actor and entity_type = 'savings_goal'
        and entity_id = p_id and action = 'created' and after_data @> desired
    ) then raise exception 'savings_changed'; end if;
    return;
  end if;
  update public.savings_goals g set name = btrim(p_name), target_minor = p_target,
    target_on = p_target_on, version = g.version + 1
  where g.id = p_id and g.owner_id = actor and g.archived_at is null and g.version = p_version
    and not (to_jsonb(g) @> desired);
  if not found and not exists (
    select 1 from public.savings_goals g where g.id = p_id and g.owner_id = actor
      and g.archived_at is null and (g.version = p_version or g.version - 1 = p_version)
      and to_jsonb(g) @> desired
  ) then raise exception 'savings_changed'; end if;
end;
$$;

create function public.record_savings_movement(p_id uuid, p_goal uuid, p_direction text, p_amount integer, p_moved_on date)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := public.confirmed_expense_owner();
  goal public.savings_goals%rowtype;
  balance bigint;
begin
  select * into goal from public.savings_goals where id = p_goal and owner_id = actor for update;
  if not found then raise exception 'savings_changed'; end if;
  if exists (select 1 from public.savings_movements where id = p_id and goal_id = p_goal
    and direction = p_direction and amount_minor = p_amount and moved_on = p_moved_on
  ) then return; end if;
  if goal.archived_at is not null then raise exception 'savings_changed'; end if;
  if p_direction is null or p_direction not in ('deposit', 'withdraw') or p_amount is null or p_amount <= 0 then
    raise exception 'savings_invalid_movement';
  end if;
  balance := goal.saved_minor::bigint + case when p_direction = 'deposit' then p_amount else -p_amount end;
  if balance < 0 then raise exception 'savings_insufficient'; end if;
  if balance > 2147483647 then raise exception 'savings_balance_limit'; end if;
  insert into public.savings_movements (id, goal_id, direction, amount_minor, moved_on)
  values (p_id, p_goal, p_direction, p_amount, p_moved_on) on conflict (id) do nothing;
  if not found then raise exception 'savings_changed'; end if;
  update public.savings_goals set saved_minor = balance::integer, version = version + 1 where id = p_goal;
  insert into public.personal_activity (owner_id, entity_type, entity_id, action, before_data, after_data)
  values (actor, 'savings_movement', p_id, 'created', null,
    jsonb_build_object('goal_id', p_goal, 'name', goal.name, 'direction', p_direction,
      'amount_minor', p_amount, 'moved_on', p_moved_on, 'saved_minor', balance));
end;
$$;

create function public.archive_savings_goal(p_id uuid, p_version integer)
returns void language plpgsql security definer set search_path = ''
as $$
declare actor uuid := public.confirmed_expense_owner();
begin
  update public.savings_goals set archived_at = now(), version = version + 1
  where id = p_id and owner_id = actor and archived_at is null and version = p_version;
  if not found and not exists (
    select 1 from public.savings_goals where id = p_id and owner_id = actor
      and archived_at is not null and version - 1 = p_version
  ) then raise exception 'savings_changed'; end if;
end;
$$;

create function public.savings_overview(p_month date)
returns table (saved_minor bigint, deposited_minor bigint, withdrawn_minor bigint)
language sql stable security invoker set search_path = ''
as $$
  select (select coalesce(sum(g.saved_minor), 0) from public.savings_goals g
          where g.owner_id = (select auth.uid()) and g.archived_at is null),
    coalesce(sum(m.amount_minor) filter (where m.direction = 'deposit'), 0),
    coalesce(sum(m.amount_minor) filter (where m.direction = 'withdraw'), 0)
  from public.savings_movements m join public.savings_goals g on g.id = m.goal_id
  where g.owner_id = (select auth.uid()) and m.moved_on >= date_trunc('month', p_month::timestamp)::date
    and m.moved_on < date_trunc('month', p_month::timestamp) + interval '1 month';
$$;

revoke all on function public.capture_savings_goal_activity(), public.save_savings_goal(uuid,text,integer,date,integer),
  public.record_savings_movement(uuid,uuid,text,integer,date), public.archive_savings_goal(uuid,integer),
  public.savings_overview(date) from public, anon, authenticated;
grant execute on function public.save_savings_goal(uuid,text,integer,date,integer),
  public.record_savings_movement(uuid,uuid,text,integer,date), public.archive_savings_goal(uuid,integer),
  public.savings_overview(date) to authenticated;
