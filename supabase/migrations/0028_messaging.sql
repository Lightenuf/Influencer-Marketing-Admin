-- 문자·알림톡 발송.
--
-- 보내는 일은 실제 돈이 나가고 되돌릴 수 없다. 그래서 두 가지를 남긴다.
--   1) 수신거부 명단 — 한 번 거부한 사람에게 다시 가지 않게
--   2) 발송 이력 — 누구에게 무엇을 언제 보냈는지

-- 수신거부. 채널톡에서 거부한 것도 여기로 모은다.
-- 창구가 갈라져도 거부 명단은 하나여야 한다.
create table if not exists public.customer_optouts (
  callnum text primary key,
  member_code text,
  channel text not null default 'sms',
  reason text not null default '',
  source text not null default 'admin',
  opted_out_at timestamptz not null default now()
);

-- 발송 한 건(캠페인). 보낸 문안과 대상 조건을 그대로 남긴다.
create table if not exists public.message_sends (
  id uuid primary key default gen_random_uuid(),
  title text not null default '',
  body text not null,
  channel text not null default 'sms',
  is_ad boolean not null default false,
  group_id uuid references public.customer_groups (id) on delete set null,
  group_name text not null default '',
  conditions jsonb not null default '{}'::jsonb,
  target_count integer not null default 0,
  sent_count integer not null default 0,
  failed_count integer not null default 0,
  cost_won integer not null default 0,
  status text not null default 'draft',
  provider_group_id text not null default '',
  error text not null default '',
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create index if not exists message_sends_created_idx on public.message_sends (created_at desc);

-- 한 사람에게 간 한 건. 누구에게 갔는지 따지려면 사람 단위가 필요하다.
create table if not exists public.message_receipts (
  id uuid primary key default gen_random_uuid(),
  send_id uuid not null references public.message_sends (id) on delete cascade,
  member_code text not null default '',
  callnum text not null,
  status text not null default 'pending',
  error text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists message_receipts_send_idx on public.message_receipts (send_id);

alter table public.customer_optouts enable row level security;
alter table public.message_sends enable row level security;
alter table public.message_receipts enable row level security;

drop policy if exists customer_optouts_all on public.customer_optouts;
create policy customer_optouts_all on public.customer_optouts
  for all to authenticated using (true) with check (true);

drop policy if exists message_sends_all on public.message_sends;
create policy message_sends_all on public.message_sends
  for all to authenticated using (true) with check (true);

drop policy if exists message_receipts_all on public.message_receipts;
create policy message_receipts_all on public.message_receipts
  for all to authenticated using (true) with check (true);

grant select, insert, update, delete on public.customer_optouts to authenticated, service_role;
grant select, insert, update, delete on public.message_sends to authenticated, service_role;
grant select, insert, update, delete on public.message_receipts to authenticated, service_role;

-- 실제로 보낼 수 있는 사람만 추린다.
-- 조건에 맞아도 번호가 없거나 수신거부한 분은 뺀다. 이 함수가 유일한 발송 대상 기준이다.
create or replace function public.list_send_targets(conditions jsonb, row_limit integer default 5000)
returns jsonb
language plpgsql stable as $$
declare
  hit_codes text[];
  result    jsonb;
begin
  -- 조건 판단은 미리보기와 같은 함수를 쓴다. 두 곳에서 다르게 세면 안 된다.
  select array(
    select jsonb_array_elements(r->'rows')->>'memberCode'
    from public.preview_customer_group(conditions, 100000) r
  ) into hit_codes;

  select jsonb_build_object(
    'total', (select count(*) from public.customers c where c.member_code = any (hit_codes)),
    'sendable', (
      select count(*) from public.customers c
      where c.member_code = any (hit_codes)
        and c.callnum <> ''
        and not exists (select 1 from public.customer_optouts o where o.callnum = c.callnum)
    ),
    'noNumber', (
      select count(*) from public.customers c
      where c.member_code = any (hit_codes) and c.callnum = ''
    ),
    'optedOut', (
      select count(*) from public.customers c
      where c.member_code = any (hit_codes)
        and c.callnum <> ''
        and exists (select 1 from public.customer_optouts o where o.callnum = c.callnum)
    ),
    'rows', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'memberCode', p.member_code, 'name', p.name, 'callnum', p.callnum
      )), '[]'::jsonb)
      from (
        select c.member_code, c.name, c.callnum
        from public.customers c
        where c.member_code = any (hit_codes)
          and c.callnum <> ''
          and not exists (select 1 from public.customer_optouts o where o.callnum = c.callnum)
        order by c.last_ordered_at desc nulls last, c.member_code
        limit greatest(coalesce(row_limit, 5000), 0)
      ) p
    )
  ) into result;

  return result;
end;
$$;

grant execute on function public.list_send_targets(jsonb, integer) to authenticated, service_role;
