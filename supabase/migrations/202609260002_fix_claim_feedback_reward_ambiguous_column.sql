-- claim_feedback_reward declares `returns table(event_id text, ...)`, which makes
-- `event_id` a PL/pgSQL variable (an implicit OUT parameter) inside the function
-- body. The re-read of feedback_reward_claims right after the insert used a bare
-- `event_id` in its WHERE clause, which Postgres cannot resolve between that
-- variable and the feedback_reward_claims.event_id column - it fails every call
-- with error 42702 ("column reference \"event_id\" is ambiguous"), observed live
-- on 2026-09-26. Because the actual reward is already applied to the player's
-- local state before this RPC runs, players still received their reward; only
-- the server-side "already delivered" bookkeeping silently failed.
--
-- Fix: qualify the column with the table's alias. No signature change, so this
-- is a plain CREATE OR REPLACE (no drop needed).

create or replace function public.claim_feedback_reward(p_event_id text)
returns table(event_id text, title text, reward jsonb, is_reporter boolean, reserved boolean, claimed_at timestamptz)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_created_at timestamptz;
  v_event public.feedback_reward_events%rowtype;
  v_claim public.feedback_reward_claims%rowtype;
begin
  if v_user_id is null then raise exception 'authentication required' using errcode = '28000'; end if;
  select created_at into v_created_at from auth.users where id = v_user_id;
  select * into v_event from public.feedback_reward_events where id = p_event_id and active for update;
  if not found or v_created_at > v_event.eligibility_cutoff then
    raise exception 'reward unavailable' using errcode = '42501';
  end if;
  insert into public.feedback_reward_claims(event_id,user_id)
  values(v_event.id,v_user_id)
  on conflict(event_id,user_id) do nothing;
  select * into v_claim from public.feedback_reward_claims c
  where c.event_id=v_event.id and c.user_id=v_user_id for update;
  if v_claim.delivered_at is not null then raise exception 'reward already delivered' using errcode = '23505'; end if;
  return query select v_event.id,v_event.title,v_event.reward,
    v_event.reporter_user_id=v_user_id,true,v_claim.claimed_at;
end;
$$;

revoke all on function public.claim_feedback_reward(text) from public,anon;
grant execute on function public.claim_feedback_reward(text) to authenticated;
