-- Two changes to save_game_state, bundled so it only needs applying once:
--
-- 1) The client used to call save_game_state and then immediately re-read
--    game_saves in full (the whole JSONB state) just to recompute the
--    checksum and confirm the write really took. save_game_state now
--    returns state/state_schema_version/migration_id itself, so the client
--    can verify from the RPC response and drop the extra full-state read.
--    IMPORTANT: this changes the function's return shape, so the client
--    (src/main.js, src/cloud/cloud-service.js) must be deployed together
--    with this migration - the old client still works (it only used
--    revision/checksum/updated_at/replayed), but the new client's
--    verification will fail on every save until this migration is applied.
--
-- 2) The history-trim delete used `NOT IN (subquery ... LIMIT 10)`, which
--    materializes a "keep" list and anti-joins against it. Replaced with a
--    plain `OFFSET 10` over the same (user_id, archived_at desc) index to
--    select the stale rows directly. Same behaviour (keep the 10 most
--    recent recovery points per user), cheaper plan.
--
-- Return type changes are not allowed via CREATE OR REPLACE, so the
-- function is dropped and recreated inside this transaction.

begin;

drop function if exists public.save_game_state(jsonb, integer, bigint, text, uuid, text);

create function public.save_game_state(
  p_state jsonb,
  p_state_schema_version integer,
  p_expected_revision bigint,
  p_checksum text,
  p_migration_id uuid default null,
  p_source_device_id text default null
)
returns table(
  revision bigint,
  checksum text,
  updated_at timestamptz,
  replayed boolean,
  state jsonb,
  state_schema_version integer,
  migration_id uuid
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_current public.game_saves%rowtype;
begin
  if v_user_id is null then raise exception 'authentication required' using errcode = '28000'; end if;
  if p_state is null or jsonb_typeof(p_state) <> 'object' then raise exception 'invalid state' using errcode = '22023'; end if;
  if octet_length(p_state::text) > 4194304 then raise exception 'state too large' using errcode = '22001'; end if;
  if p_state_schema_version < 1 or p_state_schema_version > 1000 then raise exception 'invalid schema version' using errcode = '22023'; end if;
  if p_checksum !~ '^[0-9a-f]{8}$' then raise exception 'invalid checksum' using errcode = '22023'; end if;

  select * into v_current from public.game_saves where user_id = v_user_id for update;

  if found and p_migration_id is not null and v_current.migration_id = p_migration_id then
    return query select
      v_current.revision, v_current.checksum, v_current.updated_at, true,
      v_current.state, v_current.state_schema_version, v_current.migration_id;
    return;
  end if;

  if not found then
    if coalesce(p_expected_revision, 0) <> 0 then raise exception 'save conflict' using errcode = '40001'; end if;
    insert into public.game_saves (user_id,state,state_schema_version,revision,checksum,migration_id,source_device_id,migrated_at)
    values (v_user_id,p_state,p_state_schema_version,1,p_checksum,p_migration_id,p_source_device_id,case when p_migration_id is null then null else now() end)
    returning
      game_saves.revision,game_saves.checksum,game_saves.updated_at,false,
      game_saves.state,game_saves.state_schema_version,game_saves.migration_id
    into revision,checksum,updated_at,replayed,state,state_schema_version,migration_id;
    return next;
    return;
  end if;

  if p_expected_revision is distinct from v_current.revision then raise exception 'save conflict' using errcode = '40001'; end if;

  insert into public.game_save_history (user_id,state,state_schema_version,revision,checksum)
  values (v_current.user_id,v_current.state,v_current.state_schema_version,v_current.revision,v_current.checksum)
  on conflict on constraint game_save_history_user_id_revision_key do nothing;

  update public.game_saves
  set state=p_state,
      state_schema_version=p_state_schema_version,
      revision=v_current.revision+1,
      checksum=p_checksum,
      migration_id=coalesce(p_migration_id,v_current.migration_id),
      source_device_id=coalesce(p_source_device_id,v_current.source_device_id),
      migrated_at=case when p_migration_id is null then v_current.migrated_at else now() end,
      updated_at=now()
  where user_id=v_user_id
  returning
    game_saves.revision,game_saves.checksum,game_saves.updated_at,false,
    game_saves.state,game_saves.state_schema_version,game_saves.migration_id
  into revision,checksum,updated_at,replayed,state,state_schema_version,migration_id;

  delete from public.game_save_history h
  using (
    select id
    from public.game_save_history
    where user_id = v_user_id
    order by archived_at desc, id desc
    offset 10
  ) stale
  where h.id = stale.id;

  return next;
end;
$$;

revoke all on function public.save_game_state(jsonb,integer,bigint,text,uuid,text) from public,anon;
grant execute on function public.save_game_state(jsonb,integer,bigint,text,uuid,text) to authenticated,service_role;

commit;
