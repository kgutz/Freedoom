create or replace function public.claim_beta_access(access_code text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  normalized_code text := btrim(normalize(coalesce(access_code, ''), NFKC));
  expected_fingerprint text := 'ea73c2bc99125ecf3e6c0e8be42b4708bcca6566448a137d64ba63f6b5767215';
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if encode(digest(convert_to(normalized_code, 'UTF8'), 'sha256'), 'hex') <> expected_fingerprint then
    return false;
  end if;

  insert into public.beta_access (user_id, grant_method)
  values (auth.uid(), 'code')
  on conflict (user_id) do update
    set grant_method = excluded.grant_method;

  return true;
end;
$$;

revoke all on function public.claim_beta_access(text) from public, anon;
grant execute on function public.claim_beta_access(text) to authenticated;
