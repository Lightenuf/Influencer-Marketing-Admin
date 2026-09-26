-- 슬랙 알림 — 일일 요약·주간 리포트·승인 요청.
--
-- 이상 감지는 이미 돈다. 여기서는 나머지 셋을 켜고 끄는 값과,
-- 같은 것을 두 번 보내지 않기 위한 표시를 둔다.

-- 승인이 필요한 제안을 두 번 알리지 않게 한다
alter table public.action_suggestions
  add column if not exists notified_at timestamptz;

-- 보낸 기록. 같은 날 두 번 보내지 않으려고 둔다.
-- 스케줄러가 두 번 돌거나 사람이 버튼을 또 눌러도 한 번만 간다.
create table if not exists public.notification_log (
  id uuid primary key default gen_random_uuid(),
  -- daily · weekly · approval
  kind text not null,
  -- 하루치면 날짜, 주간이면 그 주 월요일
  period_key text not null,
  sent_at timestamptz not null default now()
);

create unique index if not exists notification_log_once_idx
  on public.notification_log (kind, period_key);

alter table public.notification_log enable row level security;

drop policy if exists notification_log_all on public.notification_log;
create policy notification_log_all on public.notification_log
  for all to authenticated using (true) with check (true);

grant select, insert, update, delete on public.notification_log to authenticated, service_role;

-- ── 알림 설정 (⚙️ 설정 > 알림) ──
insert into public.ops_settings (key, value) values
  ('notifyAlerts', 'true'),
  ('notifyDaily', 'true'),
  ('notifyWeekly', 'true'),
  ('notifyApproval', 'true')
on conflict (key) do nothing;
