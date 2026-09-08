-- Retire legacy authorization and close the direct Data API mutation boundary.
begin;
alter function public.set_customer_pin(uuid,text) set search_path = '';
alter function public.verify_customer_pin(uuid,text) set search_path = '';
revoke all on function public.set_customer_pin(uuid,text), public.verify_customer_pin(uuid,text) from public, anon, authenticated, service_role;
update public.customer_profiles set pin_hash = null;
alter table public.customer_profiles drop constraint customer_profiles_auth_preference_check;
alter table public.customer_profiles alter column auth_preference set default 'TOTP';
alter table public.customer_profiles add constraint customer_profiles_auth_preference_check check (auth_preference in ('TOTP')) not valid;
update public.customer_profiles set auth_preference = 'TOTP';
alter table public.customer_profiles validate constraint customer_profiles_auth_preference_check;

do $$ declare
  t text;
p record;
begin
 foreach t in array array['customer_profiles','bank_accounts','cards','transactions','chat_sessions','chat_messages','pending_actions','customer_products','bank_documents'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public, anon, authenticated',t);
  execute format('grant select,insert,update,delete on public.%I to service_role',t);
  for p in select policyname from pg_policies where schemaname='public' and tablename=t loop
   execute format('drop policy %I on public.%I',p.policyname,t);
  end loop;
 end loop;
end $$;
grant select(id,user_id,full_name,email,phone,kyc_status,created_at,updated_at,auth_preference) on public.customer_profiles to authenticated;
grant select on public.bank_accounts,public.cards,public.transactions,public.customer_products,public.chat_sessions,public.chat_messages,public.pending_actions to authenticated;
create policy profile_read on public.customer_profiles for select to authenticated using(user_id=(select auth.uid()));
create policy accounts_read on public.bank_accounts for select to authenticated using(customer_id in(select id from public.customer_profiles where user_id=(select auth.uid())));
create policy cards_read on public.cards for select to authenticated using(customer_id in(select id from public.customer_profiles where user_id=(select auth.uid())));
create policy products_read on public.customer_products for select to authenticated using(customer_id in(select id from public.customer_profiles where user_id=(select auth.uid())));
create policy transactions_read on public.transactions for select to authenticated using(account_id in(select id from public.bank_accounts));
create policy sessions_read on public.chat_sessions for select to authenticated using(user_id=(select auth.uid()));
create policy messages_read on public.chat_messages for select to authenticated using(session_id in(select id from public.chat_sessions));
create policy actions_read on public.pending_actions for select to authenticated using(user_id=(select auth.uid()) and customer_id in(select id from public.customer_profiles));

alter table public.pending_actions add column version integer not null default 1 check(version>0), add column expires_at timestamptz not null default now()+interval '15 minutes', add column idempotency_key text, add column result jsonb;
create unique index pending_actions_idempotency on public.pending_actions(customer_id,idempotency_key);
update public.pending_actions set status='EXPIRED' where status not in ('COMPLETED','FAILED','CANCELLED','EXPIRED');
-- Composite owner foreign keys prevent auth/customer identity confusion even for privileged writes.
alter table public.customer_profiles add constraint customer_profiles_owner unique(id,user_id);
alter table public.pending_actions add constraint pending_actions_owner foreign key(customer_id,user_id) references public.customer_profiles(id,user_id);
alter table public.bank_accounts add constraint bank_accounts_owner unique(id,customer_id);
alter table public.cards add constraint cards_owner unique(id,customer_id);
alter table public.customer_products add constraint product_account_owner foreign key(linked_account_id,customer_id) references public.bank_accounts(id,customer_id);
alter table public.customer_products add constraint product_card_owner foreign key(linked_card_id,customer_id) references public.cards(id,customer_id);

create table public.action_mfa_challenges(
  id uuid primary key,
  action_id text not null references public.pending_actions(id) on delete cascade,
  user_id uuid not null,
  customer_id uuid not null,
  session_id uuid not null,
  factor_id uuid not null,
  action_version integer not null,
  expires_at timestamptz not null default now()+interval '5 minutes',
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key(customer_id,user_id) references public.customer_profiles(id,user_id));
create table public.revoked_sessions(
  session_id uuid primary key,
  user_id uuid not null references auth.users(id),
  revoked_at timestamptz not null default now(),
  expires_at timestamptz not null);
create table public.security_audit(
  id bigint generated always as identity primary key,
  user_id uuid not null,
  customer_id uuid not null,
  action_id text,
  event text not null,
  created_at timestamptz not null default now());
create table public.statement_requests(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  customer_id uuid not null,
  action_id text unique references public.pending_actions(id),
  product_id uuid not null references public.customer_products(id),
  account_id uuid not null,
  from_date date not null,
  to_date date not null,
  fee numeric(15,2) not null default 25 check(fee=25),
  currency text not null default 'AED' check(currency='AED'),
  status text not null default 'QUOTED' check(status in('QUOTED','ISSUED')),
  idempotency_key text not null,
  expires_at timestamptz not null default now()+interval '15 minutes',
  issued_at timestamptz,
  transactions_snapshot jsonb,
  created_at timestamptz not null default now(),
  foreign key(customer_id,user_id) references public.customer_profiles(id,user_id),
  foreign key(account_id,customer_id) references public.bank_accounts(id,customer_id),
  unique(customer_id,idempotency_key),
  check(from_date<=to_date));
do $$ declare
  t text;
begin foreach t in array array['action_mfa_challenges','revoked_sessions','security_audit','statement_requests'] loop
execute format('alter table public.%I enable row level security',t);
execute format('revoke all on public.%I from public,anon,authenticated',t);
execute format('grant select,insert,update,delete on public.%I to service_role',t);
end loop;
end $$;
revoke update,delete,truncate on public.security_audit from service_role;
grant usage,select on sequence public.security_audit_id_seq to service_role;
commit;
