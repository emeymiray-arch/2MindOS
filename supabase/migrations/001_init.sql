-- 2MindOS Life Graph schema (Supabase / Postgres + pgvector)
-- Apply when connecting a remote Supabase project.

create extension if not exists vector;
create extension if not exists "pgcrypto";

create table if not exists spheres (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  slug text not null,
  name text not null,
  kpi_label text,
  kpi_value text,
  sort_order int not null default 0,
  unique (user_id, slug)
);

create table if not exists nodes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  title text not null,
  body text,
  sphere_id uuid references spheres(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  salience real not null default 0.5,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists edges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_id uuid not null references nodes(id) on delete cascade,
  target_id uuid not null references nodes(id) on delete cascade,
  type text not null,
  weight real not null default 1,
  provenance text not null check (provenance in ('user','ai','rule')),
  confidence real not null default 0.5,
  created_at timestamptz not null default now()
);

create table if not exists embeddings (
  node_id uuid primary key references nodes(id) on delete cascade,
  embedding vector(1536) not null
);

create table if not exists captures (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  raw text not null,
  status text not null default 'pending',
  node_ids uuid[] not null default '{}',
  edge_ids uuid[] not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  node_id uuid not null references nodes(id) on delete cascade,
  horizon text not null check (horizon in ('day','week','month','year')),
  title text not null,
  progress real not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  node_id uuid not null references nodes(id) on delete cascade,
  title text not null,
  target_per_day real not null default 1,
  unit text,
  streak int not null default 0,
  active boolean not null default true
);

create table if not exists habit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  habit_id uuid not null references habits(id) on delete cascade,
  log_date date not null,
  value real not null default 1,
  created_at timestamptz not null default now()
);

create table if not exists vitals_days (
  user_id uuid not null references auth.users(id) on delete cascade,
  log_date date not null,
  water_ml int not null default 0,
  water_target_ml int not null default 2500,
  sleep_hours real not null default 0,
  sleep_target_hours real not null default 8,
  mood int,
  health_score int,
  prayers jsonb not null default '{}'::jsonb,
  primary key (user_id, log_date)
);

create index if not exists nodes_user_salience_idx on nodes (user_id, salience desc);
create index if not exists edges_user_source_idx on edges (user_id, source_id);
create index if not exists edges_user_target_idx on edges (user_id, target_id);

alter table spheres enable row level security;
alter table nodes enable row level security;
alter table edges enable row level security;
alter table captures enable row level security;
alter table goals enable row level security;
alter table habits enable row level security;
alter table habit_logs enable row level security;
alter table vitals_days enable row level security;

create policy spheres_owner on spheres for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy nodes_owner on nodes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy edges_owner on edges for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy captures_owner on captures for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy goals_owner on goals for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy habits_owner on habits for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy habit_logs_owner on habit_logs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy vitals_owner on vitals_days for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
