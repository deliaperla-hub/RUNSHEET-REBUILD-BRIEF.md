-- Runsheet schema.
-- Run this in the Supabase SQL editor (or `supabase db push`) against a fresh
-- project. It is written to be re-runnable.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  plan text not null default 'free' check (plan in ('free', 'pro')),
  billing_ref text,
  renews_at timestamptz,
  invite_code text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.members (
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

create index if not exists members_user_id_idx on public.members (user_id);

-- Every list in the app lives here, differentiated by `kind`. The client
-- mirrors its local rows into this table one-for-one.
create table if not exists public.items (
  household_id uuid not null references public.households (id) on delete cascade,
  id uuid not null,
  kind text not null check (kind in ('person', 'chore', 'event', 'grocery', 'med', 'money')),
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (household_id, id)
);

create index if not exists items_household_idx on public.items (household_id);

-- ---------------------------------------------------------------------------
-- Membership helper
-- ---------------------------------------------------------------------------

-- Security definer so the policies below can ask "is the caller in this
-- household?" without the members policies recursing into themselves.
create or replace function public.is_member(target_household uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.members m
    where m.household_id = target_household
      and m.user_id = auth.uid()
  );
$$;

revoke all on function public.is_member(uuid) from public;
grant execute on function public.is_member(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Row-level security
--
-- A household's data is invisible to anyone who is not in `members` for that
-- household. Nothing here trusts the client to filter by household_id.
-- ---------------------------------------------------------------------------

alter table public.households enable row level security;
alter table public.members enable row level security;
alter table public.items enable row level security;

drop policy if exists households_select on public.households;
create policy households_select on public.households
  for select to authenticated
  using (public.is_member(id));

-- Households are only ever created through create_household(), and only the
-- billing webhook (service role, which bypasses RLS) may change `plan`.
drop policy if exists households_update on public.households;
create policy households_update on public.households
  for update to authenticated
  using (public.is_member(id))
  with check (public.is_member(id));

drop policy if exists members_select on public.members;
create policy members_select on public.members
  for select to authenticated
  using (public.is_member(household_id));

-- Members join through join_household(); leaving is the one thing a member
-- may do to the table directly, and only to their own row.
drop policy if exists members_delete_self on public.members;
create policy members_delete_self on public.members
  for delete to authenticated
  using (user_id = auth.uid());

drop policy if exists items_select on public.items;
create policy items_select on public.items
  for select to authenticated
  using (public.is_member(household_id));

drop policy if exists items_insert on public.items;
create policy items_insert on public.items
  for insert to authenticated
  with check (public.is_member(household_id));

drop policy if exists items_update on public.items;
create policy items_update on public.items
  for update to authenticated
  using (public.is_member(household_id))
  with check (public.is_member(household_id));

drop policy if exists items_delete on public.items;
create policy items_delete on public.items
  for delete to authenticated
  using (public.is_member(household_id));

-- ---------------------------------------------------------------------------
-- The only two ways a household or a membership comes into existence
--
-- Both are security definer, so a household can never exist without an owner
-- and a member row can never be conjured for a household you can't name.
-- ---------------------------------------------------------------------------

create or replace function public.generate_invite_code()
returns text
language plpgsql
volatile
as $$
declare
  -- No 0/O/1/I: these get read aloud across a kitchen.
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  candidate text;
begin
  loop
    candidate := '';
    for i in 1 .. 8 loop
      candidate := candidate || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.households h where h.invite_code = candidate);
  end loop;
  return candidate;
end;
$$;

create or replace function public.create_household(name text)
returns public.households
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  caller uuid := auth.uid();
  created public.households;
begin
  if caller is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  insert into public.households (name, invite_code)
  values (coalesce(nullif(btrim(name), ''), 'Our house'), public.generate_invite_code())
  returning * into created;

  insert into public.members (household_id, user_id, role)
  values (created.id, caller, 'owner');

  return created;
end;
$$;

revoke all on function public.create_household(text) from public;
grant execute on function public.create_household(text) to authenticated;

create or replace function public.join_household(invite_code text)
returns public.households
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  caller uuid := auth.uid();
  target public.households;
begin
  if caller is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select * into target
  from public.households h
  where upper(h.invite_code) = upper(btrim(join_household.invite_code));

  if target.id is null then
    raise exception 'no household with that invite code' using errcode = 'P0002';
  end if;

  -- Re-joining a household you are already in is a no-op, not an error.
  insert into public.members (household_id, user_id, role)
  values (target.id, caller, 'member')
  on conflict (household_id, user_id) do nothing;

  return target;
end;
$$;

revoke all on function public.join_household(text) from public;
grant execute on function public.join_household(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Realtime: one device's edit shows up live on another.
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'items'
  ) then
    alter publication supabase_realtime add table public.items;
  end if;
end
$$;
