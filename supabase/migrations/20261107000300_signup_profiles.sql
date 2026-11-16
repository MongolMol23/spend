alter table public.profiles
  add column name_ar text check (char_length(btrim(name_ar)) between 1 and 80),
  add column name_en text check (char_length(btrim(name_en)) between 1 and 80);

-- Reserve the username in the signup transaction. Legacy signup callers can still
-- create their profile after confirmation.
create function public.create_signup_profile()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  profile jsonb := new.raw_user_meta_data -> 'spend_profile';
  locale text := profile ->> 'language';
  arabic_name text := btrim(profile ->> 'name_ar');
  english_name text := btrim(profile ->> 'name_en');
begin
  if profile is null then return new; end if;
  if arabic_name is null or english_name is null then
    raise exception 'missing signup name';
  end if;
  insert into public.profiles (id, username, display_name, language, name_ar, name_en)
  values (new.id, lower(btrim(profile ->> 'username')),
    case when locale = 'ar' then arabic_name else english_name end,
    locale, arabic_name, english_name);
  return new;
end;
$$;
revoke all on function public.create_signup_profile() from public, anon, authenticated;
create trigger spend_signup_profile after insert on auth.users
for each row execute function public.create_signup_profile();

-- Reserved usernames become discoverable only after email confirmation.
create or replace function public.find_profile(requested_username text)
returns table (username text, display_name text)
language sql stable security definer set search_path = ''
as $$
  select p.username, p.display_name from public.profiles p
  join auth.users u on u.id = p.id
  where p.username = lower(btrim(requested_username))
    and u.email_confirmed_at is not null and (select auth.uid()) is not null;
$$;

create function public.require_confirmed_friend()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.state = 'pending' and not exists (
    select 1 from auth.users where id = new.recipient and email_confirmed_at is not null
  ) then
    raise exception 'friend_unavailable' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke all on function public.require_confirmed_friend() from public, anon, authenticated;
create trigger spend_confirmed_friend before insert or update on public.friendships
for each row execute function public.require_confirmed_friend();
