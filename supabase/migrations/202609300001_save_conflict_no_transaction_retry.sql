-- Preserve optimistic revision checks without triggering PostgREST serialization retries.
-- Patch the existing definition only; do not touch player saves, RLS or grants.
begin;
do $patch$
declare
  definition text;
  old_code_count integer;
begin
  select pg_get_functiondef('public.save_game_state(jsonb,integer,bigint,text,uuid,text)'::regprocedure)
    into definition;
  old_code_count := (length(definition) - length(replace(definition, 'errcode = ''40001''', ''))) / length('errcode = ''40001''');
  if old_code_count = 0 and position('errcode = ''PT409''' in definition) > 0 then
    return;
  end if;
  if old_code_count <> 2 then
    raise exception 'Unexpected save_game_state definition: expected two conflict codes, got %', old_code_count;
  end if;
  execute replace(definition, 'errcode = ''40001''', 'errcode = ''PT409''');
end;
$patch$;
commit;
