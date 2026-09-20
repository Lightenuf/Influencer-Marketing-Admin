-- 발굴 요청 대기열.
-- 어드민에서 '인플루언서 발굴'을 누르면 '대기' 상태로 한 줄 쌓이고,
-- 크롬 자동화(Claude)가 집어가 검색·프로필 확인을 한 뒤 결과를 채워 '완료'로 바꾼다.

create table if not exists public.discovery_requests (
  id uuid primary key default gen_random_uuid(),
  keywords text[] not null default '{}',
  min_followers integer not null default 0,
  wanted integer not null default 0,
  status text not null default '대기' check (status in ('대기', '진행중', '완료', '실패')),
  -- 자동화가 돌려준 결과 원문 (한 줄에 한 명)
  result_raw text not null default '',
  note text not null default '',
  requested_by uuid references public.profiles (id),
  requested_at timestamptz not null default now(),
  finished_at timestamptz
);

create index if not exists discovery_requests_status_idx
  on public.discovery_requests (status, requested_at desc);

alter table public.discovery_requests enable row level security;

drop policy if exists discovery_requests_all on public.discovery_requests;
create policy discovery_requests_all on public.discovery_requests
  for all to authenticated using (true) with check (true);

grant select, insert, update, delete on public.discovery_requests to authenticated;
