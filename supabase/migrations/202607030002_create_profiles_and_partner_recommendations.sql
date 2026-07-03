create extension if not exists citext with schema extensions;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email extensions.citext not null unique,
  username extensions.citext unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint username_format check (
    username is null or username::text ~ '^[a-zA-Z0-9_]{3,24}$'
  )
);

alter table public.profiles enable row level security;

create policy "Users can read their own profile" on public.profiles
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can insert their own profile" on public.profiles
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users can update their own profile" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create or replace function public.handle_auth_user_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id, email)
  values (new.id, new.email)
  on conflict (user_id) do update
    set email = excluded.email, updated_at = now();
  return new;
end;
$$;

drop trigger if exists auth_user_profile_sync on auth.users;
create trigger auth_user_profile_sync
  after insert or update of email on auth.users
  for each row execute function public.handle_auth_user_profile();

insert into public.profiles (user_id, email)
select id, email
from auth.users
where email is not null
on conflict (user_id) do update set email = excluded.email;

create or replace function public.get_partner_watch_history(partner_username text)
returns table (
  username text,
  watched_tmdb_ids integer[]
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  partner_id uuid;
  canonical_username text;
begin
  if auth.uid() is null then
    raise exception 'Du musst angemeldet sein.';
  end if;

  select p.user_id, p.username::text
  into partner_id, canonical_username
  from public.profiles p
  where p.username = trim(partner_username)::extensions.citext;

  if partner_id is null then
    raise exception 'Benutzername nicht gefunden.';
  end if;
  if partner_id = auth.uid() then
    raise exception 'Gib den Benutzernamen einer anderen Person ein.';
  end if;

  return query
  select
    canonical_username,
    coalesce(
      array_agg(distinct h.tmdb_id) filter (
        where h.tmdb_id is not null and h.deleted_at is null
      ),
      '{}'::integer[]
    )
  from public.watch_history_entries h
  where h.user_id = partner_id;
end;
$$;

revoke all on function public.get_partner_watch_history(text) from public;
grant execute on function public.get_partner_watch_history(text) to authenticated;
