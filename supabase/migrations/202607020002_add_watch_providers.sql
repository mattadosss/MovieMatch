alter table public.watch_history_entries
  add column if not exists watch_providers jsonb not null default '[]'::jsonb,
  add column if not exists watch_provider_link text;
