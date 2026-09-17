-- 거절·연락 금지 사유를 팀원이 직접 관리하는 태그로 바꾼다.
-- 지금까지는 코드에 고정돼 있어 사유를 늘리려면 개발이 필요했다.

create table if not exists public.reason_tags (
  id uuid primary key default gen_random_uuid(),
  label text not null unique,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

alter table public.reason_tags enable row level security;

-- 로그인한 팀원이면 누구나 사유를 보고, 추가하고, 정리할 수 있다.
drop policy if exists reason_tags_all on public.reason_tags;
create policy reason_tags_all on public.reason_tags
  for all to authenticated using (true) with check (true);

grant select, insert, update, delete on public.reason_tags to authenticated;

-- 지금까지 쓰던 사유를 첫 태그로 넣어 둔다.
insert into public.reason_tags (label)
values ('단가 미합의'), ('일정 불가'), ('컨셉 불일치'), ('무응답'),
       ('본인 거절 의사'), ('협업 품질 이슈'), ('기타')
on conflict (label) do nothing;

-- 거절 사유는 여러 개를 고를 수 있으므로 배열로 바꾼다.
alter table public.collabs add column if not exists cancel_reasons text[] not null default '{}';

-- 사유가 하나였던 시절의 기록을 배열로 옮긴다. (기존 cancel_reason 컬럼은 그대로 둔다)
update public.collabs
set cancel_reasons = array[cancel_reason]
where cancel_reason is not null and cancel_reasons = '{}';
