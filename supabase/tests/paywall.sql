\set ON_ERROR_STOP off
\pset pager off

delete from public.members;
delete from public.items;
delete from public.households;
insert into auth.users (id, email) values
  ('44444444-4444-4444-4444-444444444444', 'third@example.com')
on conflict do nothing;

set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select id, plan, invite_code from public.create_household('Perla house') \gset hh_
\echo '--- free household created, owner seated ---'
select count(*)::int as seats, :'hh_plan' as plan from public.members;

-- The invite code is read out loud across a kitchen, so the joiner types it;
-- they never get to SELECT the households table.
\echo '--- a second person joining a FREE household is refused by the trigger ---'
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select public.join_household(:'hh_invite_code');

\echo '--- lowercase / padded codes still reach the same refusal, not a lookup miss ---'
select public.join_household(lower('  ' || :'hh_invite_code' || '  '));

\echo '--- ...and no seat was taken ---'
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select count(*)::int as seats_after_refusal from public.members;

\echo '--- the owner re-joining their own household is a no-op, not a seat error ---'
select id = :'hh_id' as same_household from public.join_household(:'hh_invite_code');

\echo '--- a member cannot promote the household to Pro by editing the client ---'
update public.households set plan = 'pro' where id = :'hh_id';
\echo '--- nor change the invite code or billing ref ---'
update public.households set invite_code = 'AAAAAAAA' where id = :'hh_id';
update public.households set billing_ref = 'fake' where id = :'hh_id';
\echo '--- but renaming the house is fine ---'
update public.households set name = 'The Perlas' where id = :'hh_id';
select name, plan from public.households where id = :'hh_id';

\echo '--- the webhook (service role) flips the plan ---'
reset role;
set role service_role;
update public.households set plan = 'pro', billing_ref = 'ls_order_123', renews_at = now() + interval '1 month'
where id = :'hh_id';
select plan, billing_ref is not null as has_ref from public.households where id = :'hh_id';

\echo '--- now a second and third person can join ---'
set role authenticated;
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select name from public.join_household(:'hh_invite_code');
set request.jwt.claim.sub = '44444444-4444-4444-4444-444444444444';
select name from public.join_household(lower(:'hh_invite_code'));
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select count(*)::int as seats_on_pro from public.members;

\echo '--- a member leaving removes only their own row ---'
set request.jwt.claim.sub = '44444444-4444-4444-4444-444444444444';
delete from public.members where user_id = '22222222-2222-2222-2222-222222222222';
delete from public.members where user_id = '44444444-4444-4444-4444-444444444444';
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select count(*)::int as seats_after_leave from public.members;

\echo '--- downgrade to free: the extra seats already taken are left alone ---'
reset role;
set role service_role;
update public.households set plan = 'free' where id = :'hh_id';
set role authenticated;
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select public.join_household(:'hh_invite_code');
reset role;
