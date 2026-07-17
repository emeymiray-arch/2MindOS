-- Cloud snapshot of the Life OS JSON brain (no auth required for service role).
-- Apply in Supabase Dashboard → SQL Editor if CLI is unavailable.

create table if not exists lifeos_snapshots (
  id text primary key default 'default',
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table lifeos_snapshots enable row level security;

-- No public policies: only service_role / secret key can read/write (bypasses RLS).
-- Optional: allow authenticated users their own row later.

comment on table lifeos_snapshots is '2MindOS full store snapshot for cloud backup/sync';
