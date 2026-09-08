\set ON_ERROR_STOP on
begin;
insert into auth.users(id,email) values ('10000000-0000-0000-0000-000000000001','a@example.test'),('10000000-0000-0000-0000-000000000002','b@example.test');
insert into public.customer_profiles(id,user_id,full_name,email,phone) values
('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','A','a@example.test','synthetic'),
('20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000002','B','b@example.test','synthetic');
insert into public.bank_accounts(id,customer_id,account_number,balance,type) values ('30000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','TEST-A',100,'CURRENT'),('30000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000002','TEST-B',100,'CURRENT');
insert into public.customer_products(id,customer_id,product_type,product_name,product_number,linked_account_id) values('40000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','CURRENT_ACCOUNT','Test','TEST-A','30000000-0000-0000-0000-000000000001');
insert into public.cards(id,customer_id,last_4,network,card_type,expiry_month,expiry_year) values('50000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','1234','VISA','DEBIT',1,2030);
insert into public.chat_sessions(id,user_id) values('60000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001'),('60000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000002');
insert into public.chat_messages(session_id,role,content) values('60000000-0000-0000-0000-000000000001','user','A'),('60000000-0000-0000-0000-000000000002','user','B');
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',true);
select set_config('request.jwt.claims','{"session_id":"80000000-0000-0000-0000-000000000001"}',true);
do $$ begin
 if (select count(*) from public.bank_accounts)<>1 or (select count(*) from public.chat_messages)<>1 then raise exception 'Cross-owner read'; end if;
 if has_table_privilege(current_user,'public.cards','UPDATE') or has_table_privilege(current_user,'public.transactions','INSERT') or has_table_privilege(current_user,'public.pending_actions','UPDATE') then raise exception 'Customer write grant'; end if;
 if has_function_privilege(current_user,'public.set_customer_pin(uuid,text)','EXECUTE') or has_function_privilege(current_user,'public.authorize_action(text,uuid,uuid,uuid,uuid)','EXECUTE') then raise exception 'Credential RPC exposed'; end if;
 if has_column_privilege(current_user,'public.customer_profiles','pin_hash','SELECT') then raise exception 'PIN hash exposed'; end if;
end $$;
do $$ begin
 begin
  insert into public.banking_mfa_factors(factor_id,user_id,customer_id) values('90000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001');
  raise exception 'Customer registered a factor directly';
 exception when insufficient_privilege then null; end;
 if has_table_privilege(current_user,'public.banking_mfa_factors','SELECT') then raise exception 'Factor registry exposed'; end if;
end $$;
reset role;
set local role anon;
do $$ begin
 if has_function_privilege(current_user,(select p.oid from pg_proc p join pg_namespace n on p.pronamespace=n.oid where n.nspname='security_private' and p.proname='active_customer_session'),'EXECUTE') then raise exception 'Anonymous session helper access'; end if;
 if has_table_privilege(current_user,'public.bank_documents','SELECT') or has_table_privilege(current_user,'public.customer_profiles','SELECT') then raise exception 'Anonymous data access'; end if;
end $$;
reset role;
set local role service_role;
do $$ declare s public.statement_requests; a public.pending_actions; begin
 insert into public.banking_mfa_factors(factor_id,user_id,customer_id) values('90000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001');
 begin
  insert into public.banking_mfa_factors(factor_id,user_id,customer_id) values('90000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000001');
  raise exception 'Cross-owner factor registry accepted';
 exception when foreign_key_violation then null; end;

 s:=public.quote_statement('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001',current_date-30,current_date,'once');
 begin
  perform public.confirm_statement(s.id,'10000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000002');
  raise exception 'Cross-owner statement accepted';
 exception when raise_exception then if sqlerrm='Cross-owner statement accepted' then raise; end if; end;
 begin
  perform public.confirm_statement(s.id,s.user_id,s.customer_id);
  raise exception 'Unapproved fee accepted';
 exception when raise_exception then if sqlerrm='Unapproved fee accepted' then raise; end if; end;
 a:=public.transition_action(s.action_id,s.user_id,s.customer_id,1,'PENDING_AUTHORIZATION','{}');
 insert into public.action_mfa_challenges(id,action_id,user_id,customer_id,session_id,factor_id,action_version) values('70000000-0000-0000-0000-000000000002',a.id,s.user_id,s.customer_id,'80000000-0000-0000-0000-000000000001','90000000-0000-0000-0000-000000000001',a.version);
 a:=public.authorize_action(a.id,s.user_id,s.customer_id,'80000000-0000-0000-0000-000000000001','70000000-0000-0000-0000-000000000002');
 s:=public.confirm_statement(s.id,s.user_id,s.customer_id);
 perform public.confirm_statement(s.id,s.user_id,s.customer_id);
 if (select balance from public.bank_accounts where id=s.account_id)<>75 or (select count(*) from public.transactions where account_id=s.account_id)<>1 or s.transactions_snapshot is null then raise exception 'Fee/snapshot invalid'; end if;
 insert into public.pending_actions(id,user_id,customer_id,action_type,status) values('test-action',s.user_id,s.customer_id,'BLOCK_CARD','PENDING_SELECTION');
 a:=public.transition_action('test-action',s.user_id,s.customer_id,1,'PENDING_CONFIRMATION','{"cardId":"50000000-0000-0000-0000-000000000001"}');
 a:=public.transition_action(a.id,s.user_id,s.customer_id,a.version,'PENDING_AUTHORIZATION','{}');
 insert into public.action_mfa_challenges(id,action_id,user_id,customer_id,session_id,factor_id,action_version) values('70000000-0000-0000-0000-000000000001',a.id,s.user_id,s.customer_id,'80000000-0000-0000-0000-000000000001','90000000-0000-0000-0000-000000000001',a.version);
 begin
  perform public.authorize_action(a.id,s.user_id,s.customer_id,'80000000-0000-0000-0000-000000000002','70000000-0000-0000-0000-000000000001');
  raise exception 'Wrong session accepted';
 exception when raise_exception then if sqlerrm='Wrong session accepted' then raise; end if; end;
 update public.action_mfa_challenges set expires_at=now()-interval '1 second' where id='70000000-0000-0000-0000-000000000001';
 begin
  perform public.authorize_action(a.id,s.user_id,s.customer_id,'80000000-0000-0000-0000-000000000001','70000000-0000-0000-0000-000000000001');
  raise exception 'Expired challenge accepted';
 exception when raise_exception then if sqlerrm='Expired challenge accepted' then raise; end if; end;
 update public.action_mfa_challenges set expires_at=now()+interval '5 minutes',action_version=a.version-1 where id='70000000-0000-0000-0000-000000000001';
 begin
  perform public.authorize_action(a.id,s.user_id,s.customer_id,'80000000-0000-0000-0000-000000000001','70000000-0000-0000-0000-000000000001');
  raise exception 'Stale challenge accepted';
 exception when raise_exception then if sqlerrm='Stale challenge accepted' then raise; end if; end;
 update public.action_mfa_challenges set action_version=a.version where id='70000000-0000-0000-0000-000000000001';
 delete from public.banking_mfa_factors where factor_id='90000000-0000-0000-0000-000000000001';
 begin
  perform public.authorize_action(a.id,s.user_id,s.customer_id,'80000000-0000-0000-0000-000000000001','70000000-0000-0000-0000-000000000001');
  raise exception 'Unregistered factor accepted';
 exception when raise_exception then if sqlerrm='Unregistered factor accepted' then raise; end if; end;
 insert into public.banking_mfa_factors(factor_id,user_id,customer_id) values('90000000-0000-0000-0000-000000000001',s.user_id,s.customer_id);

 a:=public.authorize_action(a.id,s.user_id,s.customer_id,'80000000-0000-0000-0000-000000000001','70000000-0000-0000-0000-000000000001');
 begin
  perform public.authorize_action(a.id,s.user_id,s.customer_id,'80000000-0000-0000-0000-000000000001','70000000-0000-0000-0000-000000000001');
  raise exception 'Replay accepted';
 exception when raise_exception then if sqlerrm='Replay accepted' then raise; end if; end;
 a:=public.execute_card_block(a.id,s.user_id,s.customer_id,a.version);
 perform public.execute_card_block(a.id,s.user_id,s.customer_id,a.version);
 if a.status<>'COMPLETED' or (select count(*) from public.security_audit where event='CARD_BLOCKED')<>1 then raise exception 'Execution not idempotent'; end if;
 begin
  update public.customer_products set linked_account_id='30000000-0000-0000-0000-000000000002' where id=s.product_id;
  raise exception 'Cross-owner linked account accepted';
 exception when foreign_key_violation then null; end;
 insert into public.pending_actions(id,user_id,customer_id,action_type,status) values('cancel-action',s.user_id,s.customer_id,'BLOCK_CARD','PENDING_SELECTION');
 a:=public.transition_action('cancel-action',s.user_id,s.customer_id,1,'CANCELLED','{}');
 begin
  perform public.execute_card_block(a.id,s.user_id,s.customer_id,a.version);
  raise exception 'Cancelled action executed';
 exception when raise_exception then if sqlerrm='Cancelled action executed' then raise; end if; end;
 s:=public.quote_statement(s.user_id,s.customer_id,s.product_id,current_date-30,current_date,'insufficient');
 a:=public.transition_action(s.action_id,s.user_id,s.customer_id,1,'PENDING_AUTHORIZATION','{}');
 insert into public.action_mfa_challenges(id,action_id,user_id,customer_id,session_id,factor_id,action_version) values('70000000-0000-0000-0000-000000000003',a.id,s.user_id,s.customer_id,'80000000-0000-0000-0000-000000000001','90000000-0000-0000-0000-000000000001',a.version);
 a:=public.authorize_action(a.id,s.user_id,s.customer_id,'80000000-0000-0000-0000-000000000001','70000000-0000-0000-0000-000000000003');
 update public.bank_accounts set balance=10 where id=s.account_id;
 begin
  perform public.confirm_statement(s.id,s.user_id,s.customer_id);
  raise exception 'Overdraft accepted';
 exception when raise_exception then if sqlerrm='Overdraft accepted' then raise; end if; end;
 if (select balance from public.bank_accounts where id=s.account_id)<>10 or (select count(*) from public.transactions where account_id=s.account_id)<>1 then raise exception 'Failed fee not rolled back'; end if;
 if has_table_privilege(current_user,'public.security_audit','UPDATE') or has_table_privilege(current_user,'public.security_audit','DELETE') then raise exception 'Audit mutable'; end if;
end $$;
reset role;
-- Fixtures now contain records in every readable customer table. Direct Data API
-- reads must disappear after logout, independently of HTTP authentication.
insert into public.revoked_sessions(session_id,user_id,expires_at) values('80000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001',now()+interval '1 hour');
set local role authenticated;
do $$ declare t text; n bigint; begin
 foreach t in array array['customer_profiles','bank_accounts','cards','transactions','customer_products','chat_sessions','chat_messages','pending_actions','statement_requests'] loop
  execute format('select count(id) from public.%I',t) into n;
  if n<>0 then raise exception 'Revoked session read: %', t; end if;
 end loop;
 if security_private.active_customer_session() then raise exception 'Revoked session accepted'; end if;
 if has_table_privilege(current_user,'public.revoked_sessions','SELECT') then raise exception 'Revocation table exposed'; end if;
end $$;
-- A distinct valid session still receives owner-filtered reads.
select set_config('request.jwt.claims','{"session_id":"80000000-0000-0000-0000-000000000002"}',true);
do $$ begin
 if (select count(*) from public.bank_accounts)<>1 or (select count(*) from public.chat_messages)<>1 or (select count(*) from public.statement_requests)<>2 then raise exception 'Valid independent session denied'; end if;
end $$;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000002',true);
do $$ begin
 if (select count(*) from public.statement_requests)<>0 then raise exception 'Cross-owner statement read'; end if;
end $$;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',true);
select set_config('request.jwt.claims','{}',true);
do $$ begin
 if security_private.active_customer_session() or (select count(*) from public.bank_accounts)<>0 then raise exception 'Missing session accepted'; end if;
end $$;
select set_config('request.jwt.claims','{"session_id":"invalid"}',true);
do $$ begin
 if security_private.active_customer_session() or (select count(*) from public.chat_messages)<>0 then raise exception 'Malformed session accepted'; end if;
end $$;
reset role;
rollback;
