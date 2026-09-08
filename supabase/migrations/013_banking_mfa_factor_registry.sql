-- Supabase Auth enrollment is also directly reachable. Only factors registered
-- through the bank's fresh-password enrollment boundary can authorize banking.
begin;
create table public.banking_mfa_factors (
  factor_id uuid primary key,
  user_id uuid not null,
  customer_id uuid not null,
  created_at timestamptz not null default now(),
  foreign key(customer_id,user_id) references public.customer_profiles(id,user_id) on delete cascade
);
alter table public.banking_mfa_factors enable row level security;
revoke all on public.banking_mfa_factors from public, anon, authenticated;
grant select,insert,delete on public.banking_mfa_factors to service_role;
create or replace function public.authorize_action(p_action_id text,p_user_id uuid,p_customer_id uuid,p_session_id uuid,p_challenge_id uuid) returns public.pending_actions
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.pending_actions;
c public.action_mfa_challenges;
begin
select * into a from public.pending_actions where id=p_action_id and user_id=p_user_id and customer_id=p_customer_id for update;
if not found or a.status<>'PENDING_AUTHORIZATION' or a.expires_at<=now() then
  raise exception 'Action unavailable';
end if;
select * into c from public.action_mfa_challenges where id=p_challenge_id and action_id=a.id and user_id=p_user_id and customer_id=p_customer_id and session_id=p_session_id for update;
if not found or c.consumed_at is not null or c.expires_at<=now() or c.created_at<now()-interval '5 minutes' or c.action_version<>a.version or exists(select 1 from public.revoked_sessions where session_id=p_session_id) or not exists(select 1 from public.banking_mfa_factors where factor_id=c.factor_id and user_id=p_user_id and customer_id=p_customer_id) then
  raise exception 'Challenge unavailable';
end if;
update public.action_mfa_challenges set consumed_at=now() where id=c.id;
update public.pending_actions set status='AUTHORIZED',version=version+1 where id=a.id returning * into a;
insert into public.security_audit(user_id,customer_id,action_id,event) values(p_user_id,p_customer_id,a.id,'AUTHORIZED');
return a;
end $$;
commit;
