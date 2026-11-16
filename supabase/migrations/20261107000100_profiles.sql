create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade default auth.uid(),
  username text not null unique check (username ~ '^[a-z0-9_]{3,24}$'),
  display_name text not null check (char_length(btrim(display_name)) between 1 and 80),
  language text not null check (language in ('en', 'ar'))
);

alter table public.profiles enable row level security;
revoke all on public.profiles from anon, authenticated;
grant select, insert, update on public.profiles to authenticated;

create policy "Owners read profiles" on public.profiles for select to authenticated
  using (id = (select auth.uid()));
create policy "Owners create profiles" on public.profiles for insert to authenticated
  with check (id = (select auth.uid()));
create policy "Owners update profiles" on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Exact lookup deliberately projects only the fields needed for discovery.
create function public.find_profile(requested_username text)
returns table (username text, display_name text)
language sql stable security definer set search_path = ''
as $$
  select p.username, p.display_name from public.profiles p
  where p.username = lower(btrim(requested_username)) and (select auth.uid()) is not null;
$$;
revoke all on function public.find_profile(text) from public, anon;
grant execute on function public.find_profile(text) to authenticated;

