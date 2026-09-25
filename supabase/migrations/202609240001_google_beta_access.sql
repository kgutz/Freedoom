begin;

create table public.beta_access (
  user_id uuid primary key references auth.users(id) on delete cascade,
  granted_at timestamptz not null default now(),
  grant_method text not null default 'legacy' check (grant_method in ('legacy','code'))
);

insert into public.beta_access (user_id, grant_method)
select id, 'legacy' from auth.users
on conflict (user_id) do nothing;

alter table public.beta_access enable row level security;
revoke all on table public.beta_access from public, anon, authenticated;
grant select on table public.beta_access to authenticated;

create policy beta_access_select_own
  on public.beta_access for select to authenticated
  using ((select auth.uid()) = user_id);

commit;
