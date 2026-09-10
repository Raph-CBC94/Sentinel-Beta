create table if not exists public.sanctions (
  id uuid primary key default gen_random_uuid(),
  guild_id text not null,
  member_id text not null,
  member_tag text not null,
  type text not null check (type in ('warning', 'timeout')),
  warning_level integer not null default 1 check (warning_level between 1 and 5),
  reason text not null,
  moderator_id text not null,
  moderator_tag text not null,
  created_at timestamptz not null default now(),
  duration_seconds integer,
  expires_at timestamptz,
  status text not null default 'pending'
    check (status in ('pending', 'applied', 'failed', 'removed')),
  dm_sent boolean,
  dm_error text,
  removed_at timestamptz,
  removed_by text
);

alter table public.sanctions
  add column if not exists warning_level integer not null default 1;

alter table public.sanctions
  drop constraint if exists sanctions_warning_level_check;

alter table public.sanctions
  add constraint sanctions_warning_level_check
  check (warning_level between 1 and 5);

create index if not exists sanctions_member_history_idx
  on public.sanctions (guild_id, member_id, created_at desc);

create index if not exists sanctions_reference_idx
  on public.sanctions (guild_id, member_id, type, status);

create table if not exists public.sanction_events (
  id uuid primary key default gen_random_uuid(),
  guild_id text not null,
  member_id text not null,
  moderator_id text not null,
  action text not null check (action in ('untimeout')),
  reason text not null,
  created_at timestamptz not null default now()
);

create index if not exists sanction_events_member_idx
  on public.sanction_events (guild_id, member_id, created_at desc);