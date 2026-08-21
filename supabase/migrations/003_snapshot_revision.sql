-- Atomic revision for lifeos_snapshots (compare-and-swap on write).
alter table lifeos_snapshots
  add column if not exists revision bigint not null default 0;

update lifeos_snapshots
set revision = greatest(
  revision,
  coalesce((payload->>'revision')::bigint, 0)
)
where id = 'default';

comment on column lifeos_snapshots.revision is 'Monotonic CAS counter for 2MindOS snapshot writes';
