\set ON_ERROR_STOP off
\pset pager off

-- Two people, two devices.
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'owner@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'partner@example.com'),
  ('33333333-3333-3333-3333-333333333333', 'stranger@example.com')
on conflict do nothing;

\echo '--- owner creates a household ---'
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select id, name, plan, length(invite_code) as code_len from public.create_household('Perla house');

\echo '--- owner writes items ---'
insert into public.items (household_id, id, kind, data)
select h.id, gen_random_uuid(), 'chore', '{"title":"Dishes"}'::jsonb from public.households h;
insert into public.items (household_id, id, kind, data)
select h.id, gen_random_uuid(), 'med', '{"name":"Vitamin D"}'::jsonb from public.households h;
select count(*) as owner_sees_items from public.items;

\echo '--- a stranger sees nothing ---'
set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
select count(*) as stranger_sees_households from public.households;
select count(*) as stranger_sees_items from public.items;
select count(*) as stranger_sees_members from public.members;

\echo '--- stranger cannot insert into someone else''s household ---'
insert into public.items (household_id, id, kind, data)
values ((select id from public.households limit 1), gen_random_uuid(), 'chore', '{"title":"hack"}'::jsonb);

\echo '--- stranger cannot forge a member row ---'
insert into public.members (household_id, user_id, role)
values ('00000000-0000-0000-0000-000000000000', '33333333-3333-3333-3333-333333333333', 'owner');

\echo '--- stranger cannot guess a household by id ---'
select count(*) as stranger_sees_by_id from public.households
where id = (select household_id from public.items limit 1);

\echo '--- bad invite code is rejected ---'
select public.join_household('NOPENOPE');

\echo '--- reset: check owner still sees exactly their rows ---'
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select count(*) as owner_items from public.items;
select count(*) as owner_members from public.members;
reset role;
