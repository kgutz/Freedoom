begin;

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text check (display_name is null or char_length(display_name) between 1 and 64),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.game_saves (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null,
  state_schema_version integer not null check (state_schema_version between 1 and 1000),
  revision bigint not null default 1 check (revision > 0),
  checksum text not null check (checksum ~ '^[0-9a-f]{8}$'),
  migration_id uuid unique,
  source_device_id text check (source_device_id is null or char_length(source_device_id) between 8 and 128),
  migrated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint game_save_size_limit check (octet_length(state::text) <= 4194304)
);

create table public.game_save_history (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  state jsonb not null,
  state_schema_version integer not null,
  revision bigint not null,
  checksum text not null,
  archived_at timestamptz not null default now(),
  unique (user_id, revision),
  constraint game_save_history_size_limit check (octet_length(state::text) <= 4194304)
);

create index game_save_history_user_archived_idx
  on public.game_save_history (user_id, archived_at desc);

-- Server-only audit used by the public beta invitation function. Raw access codes
-- are never stored in the database or frontend repository.
create table public.beta_invite_attempts (
  id bigint generated always as identity primary key,
  email_hash text not null check (email_hash ~ '^[0-9a-f]{64}$'),
  accepted boolean not null default false,
  attempted_at timestamptz not null default now()
);

create index beta_invite_attempts_email_time_idx
  on public.beta_invite_attempts (email_hash, attempted_at desc);

alter table public.profiles enable row level security;
alter table public.game_saves enable row level security;
alter table public.game_save_history enable row level security;
alter table public.beta_invite_attempts enable row level security;

revoke all on table public.profiles from anon, authenticated;
revoke all on table public.game_saves from anon, authenticated;
revoke all on table public.game_save_history from anon, authenticated;
revoke all on table public.beta_invite_attempts from anon, authenticated;

grant select, update (display_name) on table public.profiles to authenticated;
grant select on table public.game_saves to authenticated;
grant select on table public.game_save_history to authenticated;

create policy profiles_select_own
  on public.profiles for select to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy profiles_update_own
  on public.profiles for update to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
  with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy game_saves_select_own
  on public.game_saves for select to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy game_save_history_select_own
  on public.game_save_history for select to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id) values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

revoke all on function public.create_profile_for_new_user() from public, anon, authenticated;

create trigger create_profile_after_signup
  after insert on auth.users
  for each row execute function public.create_profile_for_new_user();

create or replace function public.save_game_state(
  p_state jsonb,
  p_state_schema_version integer,
  p_expected_revision bigint,
  p_checksum text,
  p_migration_id uuid default null,
  p_source_device_id text default null
)
returns table (revision bigint, checksum text, updated_at timestamptz, replayed boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_current public.game_saves%rowtype;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  if p_state is null or jsonb_typeof(p_state) <> 'object' then
    raise exception 'invalid state' using errcode = '22023';
  end if;
  if octet_length(p_state::text) > 4194304 then
    raise exception 'state too large' using errcode = '22001';
  end if;
  if p_state_schema_version < 1 or p_state_schema_version > 1000 then
    raise exception 'invalid schema version' using errcode = '22023';
  end if;
  if p_checksum !~ '^[0-9a-f]{8}$' then
    raise exception 'invalid checksum' using errcode = '22023';
  end if;

  select * into v_current
  from public.game_saves
  where user_id = v_user_id
  for update;

  if found and p_migration_id is not null and v_current.migration_id = p_migration_id then
    return query select v_current.revision, v_current.checksum, v_current.updated_at, true;
    return;
  end if;

  if not found then
    if coalesce(p_expected_revision, 0) <> 0 then
      raise exception 'save conflict' using errcode = '40001';
    end if;
    insert into public.game_saves (
      user_id, state, state_schema_version, revision, checksum,
      migration_id, source_device_id, migrated_at
    ) values (
      v_user_id, p_state, p_state_schema_version, 1, p_checksum,
      p_migration_id, p_source_device_id,
      case when p_migration_id is null then null else now() end
    )
    returning game_saves.revision, game_saves.checksum, game_saves.updated_at, false
    into revision, checksum, updated_at, replayed;
    return next;
    return;
  end if;

  if p_expected_revision is distinct from v_current.revision then
    raise exception 'save conflict' using errcode = '40001';
  end if;

  insert into public.game_save_history (
    user_id, state, state_schema_version, revision, checksum
  ) values (
    v_current.user_id, v_current.state, v_current.state_schema_version,
    v_current.revision, v_current.checksum
  ) on conflict on constraint game_save_history_user_id_revision_key do nothing;

  update public.game_saves
  set state = p_state,
      state_schema_version = p_state_schema_version,
      revision = v_current.revision + 1,
      checksum = p_checksum,
      migration_id = p_migration_id,
      source_device_id = p_source_device_id,
      migrated_at = case when p_migration_id is null then migrated_at else now() end,
      updated_at = now()
  where user_id = v_user_id
  returning game_saves.revision, game_saves.checksum, game_saves.updated_at, false
  into revision, checksum, updated_at, replayed;

  -- Keep ten verified recovery points per user.
  delete from public.game_save_history h
  where h.user_id = v_user_id
    and h.id not in (
      select kept.id from public.game_save_history kept
      where kept.user_id = v_user_id
      order by kept.archived_at desc, kept.id desc
      limit 10
    );

  return next;
end;
$$;

revoke all on function public.save_game_state(jsonb, integer, bigint, text, uuid, text)
  from public, anon;
grant execute on function public.save_game_state(jsonb, integer, bigint, text, uuid, text)
  to authenticated;

commit;
