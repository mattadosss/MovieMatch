create table if not exists public.watch_history_entries (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  raw_title text not null,
  parsed_title text not null,
  watch_date timestamptz not null,
  tmdb_id integer,
  media_type text check (media_type in ('movie', 'tv')),
  genre_ids integer[] not null default '{}',
  genre_names text[] not null default '{}',
  runtime_minutes integer,
  vote_average double precision,
  release_year integer,
  poster_path text,
  match_status text not null check (match_status in ('matched', 'unmatched')),
  source text not null check (source in ('netflix_csv', 'manual', 'marked_from_suggestion')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (id, user_id)
);

create index if not exists watch_history_entries_user_updated_idx
  on public.watch_history_entries (user_id, updated_at desc);

alter table public.watch_history_entries enable row level security;

create policy "Users can read their own watch history"
  on public.watch_history_entries
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can insert their own watch history"
  on public.watch_history_entries
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own watch history"
  on public.watch_history_entries
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own watch history"
  on public.watch_history_entries
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);
