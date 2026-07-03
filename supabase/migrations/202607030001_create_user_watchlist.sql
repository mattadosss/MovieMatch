create table if not exists public.user_watchlist (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  tmdb_id integer not null,
  title text not null,
  overview text not null default '',
  genre_ids integer[] not null default '{}',
  genre_names text[] not null default '{}',
  runtime_minutes integer,
  vote_average double precision not null default 0,
  release_year integer,
  poster_path text,
  watch_providers jsonb not null default '[]'::jsonb,
  watch_provider_link text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (id, user_id),
  unique (user_id, tmdb_id)
);

alter table public.user_watchlist enable row level security;

create policy "Users can read their own watchlist" on public.user_watchlist
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can insert their own watchlist" on public.user_watchlist
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users can update their own watchlist" on public.user_watchlist
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
