create table if not exists public.user_streaming_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  provider_ids integer[] not null default '{}',
  updated_at timestamptz not null default now()
);

alter table public.user_streaming_preferences enable row level security;

create policy "Users can read their own streaming preferences"
  on public.user_streaming_preferences
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can insert their own streaming preferences"
  on public.user_streaming_preferences
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own streaming preferences"
  on public.user_streaming_preferences
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
