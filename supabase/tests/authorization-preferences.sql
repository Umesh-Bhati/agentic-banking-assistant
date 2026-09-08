begin;
insert into auth.users(id,email) values('18000000-0000-0000-0000-000000000001','authorization-test@example.test');
insert into public.customer_profiles(id,user_id,full_name,email,phone) values('28000000-0000-0000-0000-000000000001','18000000-0000-0000-0000-000000000001','Authorization Test','authorization-test@example.test','+971500000018');
set local role service_role;
select public.set_banking_authorization('18000000-0000-0000-0000-000000000001','28000000-0000-0000-0000-000000000001','PIN','654321',null);
insert into public.pending_actions(id,user_id,customer_id,action_type,status,metadata,idempotency_key) values('preferences-test','18000000-0000-0000-0000-000000000001','28000000-0000-0000-0000-000000000001','BLOCK_CARD','PENDING_AUTHORIZATION','{}','preferences-test');
do $$
declare challenge uuid; accepted boolean; v integer; sv integer;
begin
 select version into v from public.pending_actions where id='preferences-test';
 select version into sv from public.banking_authorization_settings where customer_id='28000000-0000-0000-0000-000000000001';
 for i in 1..6 loop
  challenge:=gen_random_uuid();
  insert into public.banking_authorization_challenges(id,action_id,user_id,customer_id,session_id,method,settings_version,action_version,payload,expires_at)
  values(challenge,'preferences-test','18000000-0000-0000-0000-000000000001','28000000-0000-0000-0000-000000000001','38000000-0000-0000-0000-000000000001','PIN',sv,v,'test',now()+interval '5 minutes');
  accepted:=public.authorize_preferred_action('preferences-test','18000000-0000-0000-0000-000000000001','28000000-0000-0000-0000-000000000001','38000000-0000-0000-0000-000000000001',challenge,case when i=6 then '654321' else '000000' end,false);
  if accepted then raise exception 'Incorrect PIN or locked PIN accepted'; end if;
 end loop;
 if (select failed_attempts from public.banking_authorization_settings where customer_id='28000000-0000-0000-0000-000000000001')<>5 then raise exception 'Attempts did not persist'; end if;
end $$;
-- A password-confirmed preference change creates a new credential version.
select public.set_banking_authorization('18000000-0000-0000-0000-000000000001','28000000-0000-0000-0000-000000000001','PIN','654321',null);
do $$
declare challenge uuid:=gen_random_uuid(); v integer; sv integer;
begin
 select version into v from public.pending_actions where id='preferences-test';
 select version into sv from public.banking_authorization_settings where customer_id='28000000-0000-0000-0000-000000000001';
 insert into public.banking_authorization_challenges(id,action_id,user_id,customer_id,session_id,method,settings_version,action_version,payload,expires_at)
 values(challenge,'preferences-test','18000000-0000-0000-0000-000000000001','28000000-0000-0000-0000-000000000001','38000000-0000-0000-0000-000000000001','PIN',sv,v,'test',now()+interval '5 minutes');
 begin
  perform public.authorize_preferred_action('preferences-test','18000000-0000-0000-0000-000000000001','28000000-0000-0000-0000-000000000001','38000000-0000-0000-0000-000000000002',challenge,'654321',false);
  raise exception 'Wrong session accepted';
 exception when others then if sqlerrm='Wrong session accepted' then raise; end if; end;
 if not public.authorize_preferred_action('preferences-test','18000000-0000-0000-0000-000000000001','28000000-0000-0000-0000-000000000001','38000000-0000-0000-0000-000000000001',challenge,'654321',false) then raise exception 'Valid PIN rejected'; end if;
 if (select status from public.pending_actions where id='preferences-test')<>'AUTHORIZED' then raise exception 'Missing authorization'; end if;
 begin
  perform public.authorize_preferred_action('preferences-test','18000000-0000-0000-0000-000000000001','28000000-0000-0000-0000-000000000001','38000000-0000-0000-0000-000000000001',challenge,'654321',false);
  raise exception 'Replay accepted';
 exception when others then if sqlerrm='Replay accepted' then raise; end if; end;
end $$;
reset role;
set local role authenticated;
do $$ begin
 if has_table_privilege(current_user,'public.banking_authorization_settings','SELECT') or has_function_privilege(current_user,'public.authorize_preferred_action(text,uuid,uuid,uuid,uuid,text,boolean)','EXECUTE') then raise exception 'Authorization boundary exposed'; end if;
end $$;
rollback;
