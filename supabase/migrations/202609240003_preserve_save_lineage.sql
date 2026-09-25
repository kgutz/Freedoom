-- Keep the permanent save lineage when ordinary autosaves do not provide a
-- migration id. The unique constraint on game_saves.migration_id then blocks
-- linking the same local save lineage to a second account.
create or replace function public.save_game_state(
  p_state jsonb,
  p_state_schema_version integer,
  p_expected_revision bigint,
  p_checksum text,
  p_migration_id uuid default null,
  p_source_device_id text default null
)
returns table(revision bigint, checksum text, updated_at timestamptz, replayed boolean)
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
    return query select v_current.revision, v_current.checksum, v_current.updated_at, true;
    return;
  end if;

  if not found then
    if coalesce(p_expected_revision, 0) <> 0 then raise exception 'save conflict' using errcode = '40001'; end if;
    insert into public.game_saves (user_id,state,state_schema_version,revision,checksum,migration_id,source_device_id,migrated_at)
    values (v_user_id,p_state,p_state_schema_version,1,p_checksum,p_migration_id,p_source_device_id,case when p_migration_id is null then null else now() end)
    returning game_saves.revision,game_saves.checksum,game_saves.updated_at,false
    into revision,checksum,updated_at,replayed;
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
  returning game_saves.revision,game_saves.checksum,game_saves.updated_at,false
  into revision,checksum,updated_at,replayed;

  delete from public.game_save_history h
  where h.user_id=v_user_id and h.id not in (
    select kept.id from public.game_save_history kept
    where kept.user_id=v_user_id order by kept.archived_at desc,kept.id desc limit 10
  );
  return next;
end;
$$;

revoke all on function public.save_game_state(jsonb,integer,bigint,text,uuid,text) from public,anon;
grant execute on function public.save_game_state(jsonb,integer,bigint,text,uuid,text) to authenticated,service_role;
