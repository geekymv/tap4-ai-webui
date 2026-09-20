-- Run after create_crawler.sql as a database owner. Everything is rolled back.
begin;

do $$
begin
  if not has_table_privilege('anon', 'public.crawl_candidate', 'select') then
    raise exception 'anon must have SELECT on crawl_candidate';
  end if;
  if not has_table_privilege('anon', 'public.crawl_candidate', 'insert') then
    raise exception 'anon must have INSERT on crawl_candidate';
  end if;
  if not has_table_privilege('anon', 'public.crawl_candidate', 'update') then
    raise exception 'anon must have UPDATE on crawl_candidate';
  end if;
  if has_table_privilege('anon', 'public.crawl_candidate', 'delete') then
    raise exception 'anon must not have DELETE on crawl_candidate';
  end if;
  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'crawl_candidate'
      and cmd in ('ALL', 'DELETE')
  ) then
    raise exception 'crawl_candidate must not have an ALL or DELETE policy';
  end if;
end;
$$;

set local role anon;

select count(*) from public.crawl_candidate;

insert into public.crawl_candidate (url, canonical_url, domain, source)
values (
  'https://crawler-permission-test.invalid',
  'https://crawler-permission-test.invalid',
  'crawler-permission-test.invalid',
  'permission_test'
);

update public.crawl_candidate
set status = 'retry'
where canonical_url = 'https://crawler-permission-test.invalid';

do $$
begin
  begin
    delete from public.crawl_candidate
    where canonical_url = 'https://crawler-permission-test.invalid';
    raise exception 'anon DELETE unexpectedly succeeded';
  exception
    when insufficient_privilege then null;
  end;
end;
$$;

reset role;
rollback;
