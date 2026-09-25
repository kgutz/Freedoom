begin;

create table if not exists public.support_tickets (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null check (category in ('lost_progress','incorrect_data','access_problem','other')),
  description text not null check (char_length(description) between 10 and 2000),
  save_revision bigint,
  status text not null default 'open' check (status in ('open','in_progress','resolved','closed')),
  consented_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists support_tickets_user_created_idx
  on public.support_tickets(user_id, created_at desc);

alter table public.support_tickets enable row level security;

drop policy if exists "users read own support tickets" on public.support_tickets;
create policy "users read own support tickets"
  on public.support_tickets for select to authenticated
  using (auth.uid() = user_id);

revoke all on public.support_tickets from public, anon;
grant select on public.support_tickets to authenticated;

create or replace function public.create_support_ticket(
  p_category text,
  p_description text,
  p_consent boolean
)
returns table (ticket_code text, status text, save_revision bigint, created_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_ticket public.support_tickets%rowtype;
  v_revision bigint;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  if p_consent is not true then
    raise exception 'consent required' using errcode = '22023';
  end if;
  if p_category not in ('lost_progress','incorrect_data','access_problem','other') then
    raise exception 'invalid category' using errcode = '22023';
  end if;
  if char_length(trim(coalesce(p_description,''))) not between 10 and 2000 then
    raise exception 'invalid description' using errcode = '22023';
  end if;

  select gs.revision into v_revision
  from public.game_saves gs
  where gs.user_id = v_user_id;

  insert into public.support_tickets (
    user_id, category, description, save_revision, consented_at
  ) values (
    v_user_id, p_category, trim(p_description), v_revision, now()
  ) returning * into v_ticket;

  return query select
    'FREEDOM-' || lpad(v_ticket.id::text, 6, '0'),
    v_ticket.status,
    v_ticket.save_revision,
    v_ticket.created_at;
end;
$$;

revoke all on function public.create_support_ticket(text, text, boolean) from public, anon;
grant execute on function public.create_support_ticket(text, text, boolean) to authenticated;

commit;
