-- Per-customer accounts for multi-tenant 2MindOS.
-- Snapshot for each account lives in lifeos_snapshots with id = accounts.id.

create table if not exists accounts (
  id text primary key,
  login text not null unique,
  password_hash text not null,
  status text not null default 'active' check (status in ('active', 'paused')),
  display_name text,
  plan_until date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists accounts_status_idx on accounts (status);
create index if not exists accounts_login_lower_idx on accounts (lower(login));

alter table accounts enable row level security;
-- No public policies: only service_role / secret key (bypasses RLS).

comment on table accounts is '2MindOS customer logins issued by admin';
