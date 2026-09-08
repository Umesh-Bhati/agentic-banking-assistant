#!/usr/bin/env bash
set -euo pipefail
# TEST_DATABASE_URL must target a NEW disposable database. No application .env is loaded.
: "${TEST_DATABASE_URL:?Set TEST_DATABASE_URL to a fresh disposable PostgreSQL database}"
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/bootstrap.sql
for migration in supabase/migrations/*.sql; do
  psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f "$migration"
done
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/security.sql
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/authorization-preferences.sql
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/concurrency.sql
# Two independent sessions hold/compete for the same quote row lock.
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL' &
begin;
set local role service_role;
select public.confirm_statement(id,user_id,customer_id) from public.statement_requests where idempotency_key='concurrent';
select pg_sleep(1);
commit;
SQL
first_session=$!
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL' &
begin;
set local role service_role;
select public.confirm_statement(id,user_id,customer_id) from public.statement_requests where idempotency_key='concurrent';
commit;
SQL
second_session=$!
wait "$first_session"
wait "$second_session"
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
do $$ begin
 if (select balance from public.bank_accounts where account_number='CONCURRENT')<>75
 or (select count(*) from public.transactions where account_id='31000000-0000-0000-0000-000000000001')<>1
 or (select count(*) from public.security_audit where customer_id='21000000-0000-0000-0000-000000000001' and event='STATEMENT_ISSUED')<>1 then
 raise exception 'Concurrent confirmation charged more than once';
 end if;
end $$;
SQL
