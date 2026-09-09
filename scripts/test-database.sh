#!/usr/bin/env bash
set -euo pipefail

: "${TEST_DATABASE_URL:?Set TEST_DATABASE_URL to a fresh database on a disposable PostgreSQL cluster}"
: "${BOIT_DISPOSABLE_TEST_CLUSTER:?Acknowledge cluster-global test mutations}"
if [[ "$BOIT_DISPOSABLE_TEST_CLUSTER" != I_ACKNOWLEDGE_THIS_CLUSTER_IS_DISPOSABLE ]]; then
  echo "Refusing database test: disposable-cluster acknowledgement is invalid." >&2
  exit 2
fi
case "$TEST_DATABASE_URL" in postgresql://*|postgres://*) ;; *) echo "Refusing database test: expected a PostgreSQL URL." >&2; exit 2;; esac
case "$TEST_DATABASE_URL" in *\?*|*\#*) echo "Refusing database test: URL options and fragments are not allowed." >&2; exit 2;; esac

url_without_scheme=${TEST_DATABASE_URL#*://}
authority=${url_without_scheme%%/*}
if [[ "$authority" == "$url_without_scheme" || "$authority" != *@* ]]; then
  echo "Refusing database test: URL must contain synthetic credentials and a database." >&2; exit 2
fi
credentials=${authority%@*}
host_and_port=${authority##*@}
if [[ "$credentials" != *:* ]]; then echo "Refusing database test: synthetic password required." >&2; exit 2; fi
connection_user=${credentials%%:*}
connection_password=${credentials#*:}
if [[ ! "$connection_user" =~ ^[A-Za-z0-9._-]+$ || ! "$connection_password" =~ ^[A-Za-z0-9._-]+$ ]]; then
  echo "Refusing database test: use simple synthetic test credentials only." >&2; exit 2
fi
if [[ ! "$host_and_port" =~ ^localhost(:[0-9]+)?$ && ! "$host_and_port" =~ ^127\.0\.0\.1(:[0-9]+)?$ ]]; then
  echo "Refusing database test: only one loopback target is allowed." >&2; exit 2
fi
connection_host=${host_and_port%:*}
connection_port=${host_and_port##*:}
if [[ "$host_and_port" != *:* ]]; then
  connection_host=$host_and_port; connection_port=5432
fi
database_name=${url_without_scheme#*/}
case "$database_name" in ''|postgres|template0|template1) echo "Refusing database test: use a named disposable database." >&2; exit 2;; esac
if [[ ! "$database_name" =~ ^[A-Za-z0-9_-]+$ ]]; then echo "Refusing database test: unsupported database name." >&2; exit 2; fi
if ! command -v psql >/dev/null 2>&1; then echo "Database test requires PostgreSQL 17 psql." >&2; exit 127; fi
psql_version=$(psql --version)
if [[ ! "$psql_version" =~ \(PostgreSQL\)[[:space:]]17\. ]]; then
  echo "Database test requires PostgreSQL 17 psql; found: $psql_version" >&2; exit 2
fi

script_directory=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
repository_root=$(cd "$script_directory/.." && pwd)
cd "$repository_root"
export LC_ALL=C
psql_test=(psql --no-psqlrc --no-password --set=ON_ERROR_STOP=1)
run_psql() {
  PGAPPNAME=boit-disposable-database-test PGHOST="$connection_host" PGPORT="$connection_port" \
  PGDATABASE="$database_name" PGUSER="$connection_user" PGPASSFILE="$passfile" "${psql_test[@]}" "$@"
}

roles_may_have_been_created=false
cleanup() {
  cleanup_status=${1:-$?}
  trap - EXIT INT TERM
  if [[ "$roles_may_have_been_created" == true ]]; then
    run_psql --quiet <<'SQL' || cleanup_status=1
do $$ declare r text; begin
 foreach r in array array['anon','authenticated','service_role','authenticator','knowledge_ingestor'] loop
  if exists(select 1 from pg_roles where rolname=r) then execute format('drop owned by %I',r); end if;
 end loop;
end $$;
drop role if exists anon, authenticated, service_role, authenticator, knowledge_ingestor;
SQL
  fi
  rm -f "$passfile"
  exit "$cleanup_status"
}
passfile=$(mktemp "${TMPDIR:-/tmp}/boit-test-pgpass.XXXXXX")
trap 'cleanup $?' EXIT
trap 'cleanup 130' INT
trap 'cleanup 143' TERM
chmod 600 "$passfile"
printf '%s:%s:%s:%s:%s\n' "$connection_host" "$connection_port" "$database_name" "$connection_user" "$connection_password" > "$passfile"
unset TEST_DATABASE_URL connection_password credentials url_without_scheme authority host_and_port

preflight=$(run_psql --tuples-only --no-align --field-separator='|' <<'SQL'
select current_database(), current_setting('server_version_num')::integer,
 exists(select 1 from pg_available_extensions where name='vector'),
 exists(select 1 from pg_extension where extname='vector'),
 exists(select 1 from pg_roles where rolname in ('anon','authenticated','service_role','authenticator','knowledge_ingestor')),
 (select count(*) from pg_extension where extname<>'plpgsql')
 +(select count(*) from pg_namespace where nspname not in ('public','information_schema') and nspname !~ '^pg_')
 +(select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname<>'information_schema' and n.nspname !~ '^pg_' and c.relkind in ('r','p','v','m','S','f'))
 +(select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname<>'information_schema' and n.nspname !~ '^pg_')
 +(select count(*) from pg_type t join pg_namespace n on n.oid=t.typnamespace where n.nspname<>'information_schema' and n.nspname !~ '^pg_');
SQL
)
IFS='|' read -r actual_database server_version vector_available vector_installed protected_roles_exist unsafe_object_count <<< "$preflight"
case "$actual_database" in ''|postgres|template0|template1) echo "Refusing database test: protected or unknown database." >&2; exit 2;; esac
if (( server_version < 170000 || server_version >= 180000 )); then echo "Refusing database test: PostgreSQL 17 required." >&2; exit 2; fi
if [[ "$vector_available" != t || "$vector_installed" != f ]]; then echo "Refusing database test: pgvector must be available but uninstalled." >&2; exit 2; fi
if [[ "$protected_roles_exist" != f ]]; then echo "Refusing database test: test roles already exist in this cluster." >&2; exit 2; fi
if [[ "$unsafe_object_count" != 0 ]]; then echo "Refusing database test: nonstandard database objects exist." >&2; exit 2; fi

shopt -s nullglob
migrations=(supabase/migrations/[0-9][0-9][0-9]_*.sql)
all_migration_sql=(supabase/migrations/*.sql)
sql_tests=(supabase/tests/*.sql)
if (( ${#migrations[@]} == 0 || ${#sql_tests[@]} == 0 || ${#migrations[@]} != ${#all_migration_sql[@]} )); then
  echo "Database test requires only numbered migrations and known SQL tests." >&2; exit 1
fi
for sql_test in "${sql_tests[@]}"; do
  case "${sql_test##*/}" in bootstrap.sql|security.sql|concurrency.sql|*-preferences.sql) ;; *) echo "Unexpected SQL test: $sql_test" >&2; exit 1;; esac
done

run_psql <<'SQL'
begin;
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create role authenticator nologin;
create role knowledge_ingestor nologin;
commit;
SQL
roles_may_have_been_created=true
run_psql --file=supabase/tests/bootstrap.sql
for migration in "${migrations[@]}"; do run_psql --file="$migration"; done
for sql_test in "${sql_tests[@]}"; do [[ "$sql_test" == supabase/tests/bootstrap.sql ]] || run_psql --file="$sql_test"; done

run_psql <<'SQL' &
begin; set local role service_role;
select public.confirm_statement(id,user_id,customer_id) from public.statement_requests where idempotency_key='concurrent';
select pg_sleep(1); commit;
SQL
first_session=$!
run_psql <<'SQL' &
begin; set local role service_role;
select public.confirm_statement(id,user_id,customer_id) from public.statement_requests where idempotency_key='concurrent';
commit;
SQL
second_session=$!
first_status=0; second_status=0
wait "$first_session" || first_status=$?
wait "$second_session" || second_status=$?
if (( first_status != 0 || second_status != 0 )); then echo "Concurrent database test session failed." >&2; exit 1; fi
run_psql <<'SQL'
do $$ begin
 if (select balance from public.bank_accounts where account_number='CONCURRENT')<>75
 or (select count(*) from public.transactions where account_id='31000000-0000-0000-0000-000000000001')<>1
 or (select count(*) from public.security_audit where customer_id='21000000-0000-0000-0000-000000000001' and event='STATEMENT_ISSUED')<>1 then
 raise exception 'Concurrent confirmation charged more than once'; end if;
end $$;
SQL
