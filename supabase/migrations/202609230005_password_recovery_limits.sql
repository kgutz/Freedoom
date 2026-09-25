begin;

create table if not exists public.password_recovery_attempts (
  id bigint generated always as identity primary key,
  email_hash text not null check (email_hash ~ '^[0-9a-f]{64}$'),
  attempted_at timestamptz not null default now()
);

create index if not exists password_recovery_attempts_email_time_idx
  on public.password_recovery_attempts(email_hash, attempted_at desc);

alter table public.password_recovery_attempts enable row level security;
revoke all on public.password_recovery_attempts from public, anon, authenticated;

commit;
