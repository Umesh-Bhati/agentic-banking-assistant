begin;
create function public.transition_action(p_action_id text,p_user_id uuid,p_customer_id uuid,p_expected_version int,p_status text,p_metadata jsonb) returns public.pending_actions
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.pending_actions;
begin
select * into a from public.pending_actions where id=p_action_id and user_id=p_user_id and customer_id=p_customer_id for update;
if not found then
  raise exception 'Action unavailable';
end if;
if a.version<>p_expected_version or a.expires_at<=now() then
  raise exception 'Stale or expired action';
end if;
if not ((p_status='CANCELLED' and a.status in('CREATED','PENDING_SELECTION','PENDING_CONFIRMATION','PENDING_AUTHORIZATION','AUTHORIZED')) or (p_status='PENDING_CONFIRMATION' and a.status in('PENDING_SELECTION','PENDING_CONFIRMATION','PENDING_AUTHORIZATION')) or (p_status='PENDING_AUTHORIZATION' and a.status='PENDING_CONFIRMATION')) then
  raise exception 'Invalid transition';
end if;
if p_status='PENDING_CONFIRMATION' and a.action_type<>'BLOCK_CARD' then
  raise exception 'Statement quote details are immutable';
end if;
if p_status='PENDING_CONFIRMATION' and not exists(select 1 from public.cards where id=(p_metadata->>'cardId')::uuid and customer_id=p_customer_id and status='ACTIVE') then
  raise exception 'Card unavailable';
end if;
if p_status='PENDING_AUTHORIZATION' and coalesce(p_metadata,'{}')<> '{}'::jsonb and p_metadata<>a.metadata then
  raise exception 'Confirmation details changed';
end if;
update public.action_mfa_challenges set consumed_at=now() where action_id=a.id and consumed_at is null;
update public.pending_actions set status=p_status,version=version+1,metadata=case when p_status='PENDING_CONFIRMATION' then jsonb_build_object('cardId',p_metadata->>'cardId') else metadata end where id=a.id returning * into a;
insert into public.security_audit(user_id,customer_id,action_id,event) values(p_user_id,p_customer_id,a.id,p_status);
return a;
end $$;

create function public.authorize_action(p_action_id text,p_user_id uuid,p_customer_id uuid,p_session_id uuid,p_challenge_id uuid) returns public.pending_actions
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
if not found or c.consumed_at is not null or c.expires_at<=now() or c.created_at<now()-interval '5 minutes' or c.action_version<>a.version or exists(select 1 from public.revoked_sessions where session_id=p_session_id) then
  raise exception 'Challenge unavailable';
end if;
update public.action_mfa_challenges set consumed_at=now() where id=c.id;
update public.pending_actions set status='AUTHORIZED',version=version+1 where id=a.id returning * into a;
insert into public.security_audit(user_id,customer_id,action_id,event) values(p_user_id,p_customer_id,a.id,'AUTHORIZED');
return a;
end $$;

create function public.execute_card_block(p_action_id text,p_user_id uuid,p_customer_id uuid,p_expected_version int) returns public.pending_actions
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.pending_actions;
begin
select * into a from public.pending_actions where id=p_action_id and user_id=p_user_id and customer_id=p_customer_id for update;
if not found then
  raise exception 'Action unavailable';
end if;
if a.status='COMPLETED' then return a;
end if;
if a.status<>'AUTHORIZED' or a.action_type<>'BLOCK_CARD' or a.version<>p_expected_version or a.expires_at<=now() then
  raise exception 'Action unavailable';
end if;
update public.cards set status='BLOCKED' where id=(a.metadata->>'cardId')::uuid and customer_id=p_customer_id and status in('ACTIVE','BLOCKED');
if not found then
  raise exception 'Card unavailable';
end if;
update public.pending_actions set status='COMPLETED',version=version+1,result='{"success":true,"message":"Card blocked successfully"}'::jsonb where id=a.id returning * into a;
insert into public.security_audit(user_id,customer_id,action_id,event) values(p_user_id,p_customer_id,a.id,'CARD_BLOCKED');
return a;
end $$;

create function public.quote_statement(p_user_id uuid,p_customer_id uuid,p_product_id uuid,p_start_date date,p_end_date date,p_idempotency_key text) returns public.statement_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.statement_requests;
p public.customer_products;
begin
if not exists(select 1 from public.customer_profiles where id=p_customer_id and user_id=p_user_id) then
  raise exception 'Customer unavailable';
end if;
if p_start_date is null or p_end_date is null or p_start_date>p_end_date or p_end_date>current_date or p_end_date-p_start_date>366 or length(p_idempotency_key) not between 1 and 128 then
  raise exception 'Invalid statement request';
end if;
select * into p from public.customer_products where id=p_product_id and customer_id=p_customer_id and status='ACTIVE' and product_type in('CURRENT_ACCOUNT','SAVINGS_ACCOUNT');
if not found or not exists(select 1 from public.bank_accounts where id=p.linked_account_id and customer_id=p_customer_id and status='ACTIVE' and currency='AED') then
  raise exception 'Unsupported statement product';
end if;
insert into public.statement_requests(user_id,customer_id,product_id,account_id,from_date,to_date,idempotency_key) values(p_user_id,p_customer_id,p.id,p.linked_account_id,p_start_date,p_end_date,p_idempotency_key) on conflict(customer_id,idempotency_key) do nothing;
select * into s from public.statement_requests where customer_id=p_customer_id and idempotency_key=p_idempotency_key for update;
if s.user_id<>p_user_id or s.product_id<>p_product_id or s.from_date<>p_start_date or s.to_date<>p_end_date then
  raise exception 'Idempotency key conflict';
end if;
if s.action_id is null then
 insert into public.pending_actions(id,user_id,customer_id,action_type,status,metadata,expires_at)
 values('statement_'||s.id::text,p_user_id,p_customer_id,'GENERATE_STATEMENT','PENDING_CONFIRMATION',jsonb_build_object('statementId',s.id),s.expires_at);
 update public.statement_requests set action_id='statement_'||s.id::text where id=s.id returning * into s;
end if;
return s;
end $$;

create function public.confirm_statement(p_statement_id uuid,p_user_id uuid,p_customer_id uuid) returns public.statement_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.statement_requests;
a public.pending_actions;
begin
select * into s from public.statement_requests where id=p_statement_id and user_id=p_user_id and customer_id=p_customer_id for update;
if not found then
  raise exception 'Statement unavailable';
end if;
if s.status='ISSUED' then return s;
end if;
select * into a from public.pending_actions where id=s.action_id and user_id=p_user_id and customer_id=p_customer_id for update;
if not found or a.status<>'AUTHORIZED' or a.action_type<>'GENERATE_STATEMENT' or a.metadata->>'statementId'<>s.id::text or a.expires_at<=now() then
 raise exception 'Statement authorization required';
end if;
if s.expires_at<=now() then
  raise exception 'Quote expired';
end if;
update public.bank_accounts set balance=balance-s.fee where id=s.account_id and customer_id=p_customer_id and currency=s.currency and status='ACTIVE' and balance>=s.fee;
if not found then
  raise exception 'Insufficient funds or account unavailable';
end if;
insert into public.transactions(account_id,amount,currency,type,category,description) values(s.account_id,-s.fee,s.currency,'DEBIT','FEE','Statement fee');
update public.statement_requests set status='ISSUED',issued_at=now(),transactions_snapshot=(select coalesce(jsonb_agg(to_jsonb(t) order by t.created_at,t.id),'[]'::jsonb) from public.transactions t where t.account_id=s.account_id and t.created_at>=s.from_date::timestamptz and t.created_at<(s.to_date+1)::timestamptz) where id=s.id returning * into s;
insert into public.security_audit(user_id,customer_id,action_id,event) values(p_user_id,p_customer_id,s.action_id,'STATEMENT_ISSUED');
update public.pending_actions set status='COMPLETED',version=version+1,result=jsonb_build_object('success',true,'statementId',s.id) where id=s.action_id;
return s;
end $$;
revoke all on function public.transition_action(text,uuid,uuid,int,text,jsonb),public.authorize_action(text,uuid,uuid,uuid,uuid),public.execute_card_block(text,uuid,uuid,int),public.quote_statement(uuid,uuid,uuid,date,date,text),public.confirm_statement(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.transition_action(text,uuid,uuid,int,text,jsonb),public.authorize_action(text,uuid,uuid,uuid,uuid),public.execute_card_block(text,uuid,uuid,int),public.quote_statement(uuid,uuid,uuid,date,date,text),public.confirm_statement(uuid,uuid,uuid) to service_role;
commit;
