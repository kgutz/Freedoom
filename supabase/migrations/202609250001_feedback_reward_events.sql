begin;

create table public.feedback_reward_events (
  id text primary key check (char_length(id) between 8 and 80),
  title text not null check (char_length(title) between 1 and 120),
  reward jsonb not null check (jsonb_typeof(reward) = 'object'),
  reporter_user_id uuid references auth.users(id) on delete set null,
  eligibility_cutoff timestamptz not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.feedback_reward_claims (
  event_id text not null references public.feedback_reward_events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  claimed_at timestamptz not null default now(),
  delivered_at timestamptz,
  primary key (event_id, user_id)
);

alter table public.feedback_reward_events enable row level security;
alter table public.feedback_reward_claims enable row level security;
revoke all on table public.feedback_reward_events from public, anon, authenticated;
revoke all on table public.feedback_reward_claims from public, anon, authenticated;

insert into public.feedback_reward_events (
  id, title, reward, reporter_user_id, eligibility_cutoff
)
select
  'feedback-report-0001',
  'El primer reporte',
  '{"coins":100,"bloodPotions":3,"vigorPotions":3}'::jsonb,
  (select user_id from public.support_tickets order by created_at asc limit 1),
  now()
on conflict (id) do nothing;

create or replace function public.pending_feedback_reward()
returns table(event_id text, title text, reward jsonb, is_reporter boolean, reserved boolean, claimed_at timestamptz)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_created_at timestamptz;
begin
  if v_user_id is null then raise exception 'authentication required' using errcode = '28000'; end if;
  select created_at into v_created_at from auth.users where id = v_user_id;
  return query
  select e.id, e.title, e.reward, e.reporter_user_id = v_user_id,
         c.user_id is not null, c.claimed_at
  from public.feedback_reward_events e
  left join public.feedback_reward_claims c
    on c.event_id = e.id and c.user_id = v_user_id
  where e.active
    and v_created_at <= e.eligibility_cutoff
    and (c.user_id is null or c.delivered_at is null)
  order by e.created_at asc
  limit 1;
end;
$$;

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
  select * into v_claim from public.feedback_reward_claims
  where event_id=v_event.id and user_id=v_user_id for update;
  if v_claim.delivered_at is not null then raise exception 'reward already delivered' using errcode = '23505'; end if;
  return query select v_event.id,v_event.title,v_event.reward,
    v_event.reporter_user_id=v_user_id,true,v_claim.claimed_at;
end;
$$;

create or replace function public.mark_feedback_reward_delivered(p_event_id text)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_has_marker boolean;
begin
  if v_user_id is null then raise exception 'authentication required' using errcode = '28000'; end if;
  select coalesce((state->'game'->'feedbackRewards'->'claimed') ? p_event_id,false)
    into v_has_marker from public.game_saves where user_id=v_user_id;
  if not coalesce(v_has_marker,false) then
    raise exception 'reward save not verified' using errcode = '40001';
  end if;
  update public.feedback_reward_claims
    set delivered_at=coalesce(delivered_at,now())
    where event_id=p_event_id and user_id=v_user_id;
  return found;
end;
$$;

revoke all on function public.pending_feedback_reward() from public,anon;
revoke all on function public.claim_feedback_reward(text) from public,anon;
revoke all on function public.mark_feedback_reward_delivered(text) from public,anon;
grant execute on function public.pending_feedback_reward() to authenticated;
grant execute on function public.claim_feedback_reward(text) to authenticated;
grant execute on function public.mark_feedback_reward_delivered(text) to authenticated;

commit;
