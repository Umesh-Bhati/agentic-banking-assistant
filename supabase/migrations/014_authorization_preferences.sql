begin;
alter table public.customer_profiles drop constraint customer_profiles_auth_preference_check;
alter table public.customer_profiles add constraint customer_profiles_auth_preference_check check(auth_preference in ('PIN','BIOMETRIC','TOTP'));

create table public.banking_authorization_settings (
 customer_id uuid primary key,
 user_id uuid not null,
 version integer not null default 1,
 pin_hash text,
 public_key text,
 failed_attempts integer not null default 0,
 locked_until timestamptz,
 foreign key(customer_id,user_id) references public.customer_profiles(id,user_id) on delete cascade
);
create table public.banking_authorization_challenges (
 id uuid primary key,
 action_id text not null references public.pending_actions(id) on delete cascade,
 user_id uuid not null,
 customer_id uuid not null,
 session_id uuid not null,
 method text not null check(method in ('PIN','BIOMETRIC')),
 settings_version integer not null,
 action_version integer not null,
 payload text not null,
 expires_at timestamptz not null,
 consumed_at timestamptz,
 foreign key(customer_id,user_id) references public.customer_profiles(id,user_id) on delete cascade
);
alter table public.banking_authorization_settings enable row level security;
alter table public.banking_authorization_challenges enable row level security;
revoke all on public.banking_authorization_settings,public.banking_authorization_challenges from public,anon,authenticated;
grant select on public.banking_authorization_settings to service_role;
grant select,insert on public.banking_authorization_challenges to service_role;

-- Supabase installs pgcrypto in extensions; plain PostgreSQL may use public.
-- Resolve its trusted extension namespace rather than relying on search_path.
create function security_private.hash_authorization_pin(p_pin text,p_salt text default null) returns text
language plpgsql security definer set search_path='' as $$
declare extension_schema text; result text;
begin
 select n.nspname into extension_schema from pg_catalog.pg_extension e join pg_catalog.pg_namespace n on n.oid=e.extnamespace where e.extname='pgcrypto';
 if extension_schema is null then raise exception 'PIN hashing unavailable'; end if;
 execute format('select %I.crypt($1,coalesce($2,%I.gen_salt(''bf'',12)))',extension_schema,extension_schema) into result using p_pin,p_salt;
 return result;
end $$;
revoke all on function security_private.hash_authorization_pin(text,text) from public,anon,authenticated,service_role;

-- Called only after fresh password verification by the authenticated backend.
create function public.set_banking_authorization(p_user_id uuid,p_customer_id uuid,p_method text,p_pin text default null,p_public_key text default null) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.customer_profiles where id=p_customer_id and user_id=p_user_id for update;
 if not found or p_method not in ('PIN','BIOMETRIC','TOTP') then raise exception 'Invalid preference'; end if;
 if p_method='PIN' and (p_pin is null or p_pin !~ '^[0-9]{6}$') then raise exception 'Six-digit banking PIN required'; end if;
 if p_method='BIOMETRIC' and (p_public_key is null or p_public_key !~ '^[0-9a-f]{64}$') then raise exception 'Device key required'; end if;
 if p_method='TOTP' and not exists(select 1 from public.banking_mfa_factors b join auth.mfa_factors f on f.id=b.factor_id where b.user_id=p_user_id and b.customer_id=p_customer_id and f.status='verified') then raise exception 'Verified authenticator required'; end if;
 insert into public.banking_authorization_settings(customer_id,user_id,pin_hash,public_key)
 values(p_customer_id,p_user_id,case when p_method='PIN' then security_private.hash_authorization_pin(p_pin) end,case when p_method='BIOMETRIC' then p_public_key end)
 on conflict(customer_id) do update set version=banking_authorization_settings.version+1,
 pin_hash=excluded.pin_hash,public_key=excluded.public_key,failed_attempts=0,locked_until=null;
 update public.customer_profiles set auth_preference=p_method where id=p_customer_id;
 -- A preference change invalidates previously issued TOTP challenges too.
 update public.action_mfa_challenges set consumed_at=now() where customer_id=p_customer_id and consumed_at is null;
 insert into public.security_audit(user_id,customer_id,event) values(p_user_id,p_customer_id,'AUTHORIZATION_PREFERENCE_CHANGED');
end $$;

-- PIN check, lockout, proof consumption and state transition share one transaction.
-- Invalid PIN returns false rather than raising, so the failed attempt is committed.
create function public.authorize_preferred_action(p_action_id text,p_user_id uuid,p_customer_id uuid,p_session_id uuid,p_challenge_id uuid,p_pin text default null,p_signature_verified boolean default false) returns boolean
language plpgsql security definer set search_path='' as $$
declare a public.pending_actions; c public.banking_authorization_challenges; s public.banking_authorization_settings; preference text;
begin
 select auth_preference into preference from public.customer_profiles where id=p_customer_id and user_id=p_user_id for update;
 select * into s from public.banking_authorization_settings where customer_id=p_customer_id and user_id=p_user_id for update;
 if not found then raise exception 'Authorization not configured'; end if;
 select * into a from public.pending_actions where id=p_action_id and customer_id=p_customer_id and user_id=p_user_id for update;
 if not found or a.status<>'PENDING_AUTHORIZATION' or a.expires_at<=now() then raise exception 'Action unavailable'; end if;
 select * into c from public.banking_authorization_challenges where id=p_challenge_id and action_id=a.id and customer_id=p_customer_id and user_id=p_user_id and session_id=p_session_id for update;
 if not found or c.consumed_at is not null or c.expires_at<=now() or c.action_version<>a.version or c.settings_version<>s.version or c.method<>preference or exists(select 1 from public.revoked_sessions where session_id=p_session_id) then raise exception 'Challenge unavailable'; end if;
 update public.banking_authorization_challenges set consumed_at=now() where id=c.id;
 if s.locked_until>now() then return false; end if;
 if c.method='PIN' and (p_pin is null or p_pin !~ '^[0-9]{6}$' or s.pin_hash is null or security_private.hash_authorization_pin(p_pin,s.pin_hash)<>s.pin_hash) then
   if s.locked_until is not null then s.failed_attempts:=0; end if;
   update public.banking_authorization_settings set failed_attempts=s.failed_attempts+1,locked_until=case when s.failed_attempts+1>=5 then now()+interval '15 minutes' end where customer_id=p_customer_id;
   insert into public.security_audit(user_id,customer_id,action_id,event) values(p_user_id,p_customer_id,a.id,'PIN_AUTHORIZATION_FAILED');
   return false;
 end if;
 if c.method='BIOMETRIC' and (p_signature_verified is distinct from true or s.public_key is null) then return false; end if;
 update public.banking_authorization_settings set failed_attempts=0,locked_until=null where customer_id=p_customer_id;
 update public.pending_actions set status='AUTHORIZED',version=version+1 where id=a.id;
 insert into public.security_audit(user_id,customer_id,action_id,event) values(p_user_id,p_customer_id,a.id,'AUTHORIZED');
 return true;
end $$;
revoke all on function public.set_banking_authorization(uuid,uuid,text,text,text),public.authorize_preferred_action(text,uuid,uuid,uuid,uuid,text,boolean) from public,anon,authenticated;
grant execute on function public.set_banking_authorization(uuid,uuid,text,text,text),public.authorize_preferred_action(text,uuid,uuid,uuid,uuid,text,boolean) to service_role;

-- Keep the existing TOTP proof boundary, while enforcing the selected method.
create or replace function public.authorize_action(p_action_id text,p_user_id uuid,p_customer_id uuid,p_session_id uuid,p_challenge_id uuid) returns public.pending_actions
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.pending_actions;
c public.action_mfa_challenges;
begin
perform 1 from public.customer_profiles where id=p_customer_id and user_id=p_user_id and auth_preference='TOTP' for update;
if not found then raise exception 'Selected authorization method required'; end if;
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
