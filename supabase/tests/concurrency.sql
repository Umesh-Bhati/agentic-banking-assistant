-- Fixture creation runs only in the disposable database, as its administrator.
insert into auth.users(id,email) values('11000000-0000-0000-0000-000000000001','concurrent@example.test');
insert into public.customer_profiles(id,user_id,full_name,email,phone) values('21000000-0000-0000-0000-000000000001','11000000-0000-0000-0000-000000000001','Test','concurrent@example.test','synthetic');
insert into public.bank_accounts(id,customer_id,account_number,balance,type) values('31000000-0000-0000-0000-000000000001','21000000-0000-0000-0000-000000000001','CONCURRENT',100,'CURRENT');
insert into public.customer_products(id,customer_id,product_type,product_name,product_number,linked_account_id) values('41000000-0000-0000-0000-000000000001','21000000-0000-0000-0000-000000000001','CURRENT_ACCOUNT','Test','CONCURRENT','31000000-0000-0000-0000-000000000001');
select public.quote_statement('11000000-0000-0000-0000-000000000001','21000000-0000-0000-0000-000000000001','41000000-0000-0000-0000-000000000001',current_date-30,current_date,'concurrent');
-- Provider verification and MFA replay are tested separately; seed authorized state for lock contention.
update public.pending_actions set status='AUTHORIZED' where customer_id='21000000-0000-0000-0000-000000000001';
