-- 이상 감지.
--
-- 9월 16일에 광고가 멈췄는데 열흘 동안 아무도 몰랐다. 그런 일이 되풀이되지 않게
-- 신호를 잡아 기록하고 슬랙으로 알린다.
--
-- 같은 문제로 매일 알림이 오면 사람이 무시하게 된다. 그래서 한 번 알린 것은
-- 잠잠해질 때까지 다시 알리지 않는다.

create table if not exists public.ad_alerts (
  id uuid primary key default gen_random_uuid(),

  -- spendStopped · spendSpike · roasDrop · accountIssue · adRejected · tokenExpiring
  kind text not null,
  -- info · warn · critical
  level text not null default 'warn',
  title text not null,
  detail text not null default '',
  evidence jsonb not null default '{}'::jsonb,

  -- 같은 문제를 알아보는 열쇠. 이것이 같으면 이미 알린 것으로 본다
  fingerprint text not null,

  notified_at timestamptz,
  -- 사람이 확인했다고 표시하면 닫힌다
  resolved_at timestamptz,
  resolved_by uuid references public.profiles (id),

  created_at timestamptz not null default now()
);

-- 열려 있는 같은 문제는 하나만 둔다
create unique index if not exists ad_alerts_open_idx
  on public.ad_alerts (fingerprint)
  where resolved_at is null;

create index if not exists ad_alerts_created_idx on public.ad_alerts (created_at desc);

alter table public.ad_alerts enable row level security;

drop policy if exists ad_alerts_all on public.ad_alerts;
create policy ad_alerts_all on public.ad_alerts
  for all to authenticated using (true) with check (true);

grant select, insert, update, delete on public.ad_alerts to authenticated, service_role;

-- ── 감지 기준 ──
insert into public.ops_settings (key, value) values
  -- 어제 지출이 이 비율 아래로 떨어지면 '멈췄다'로 본다 (직전 7일 평균 대비)
  ('spendStopRatio', '0.1'),
  -- 전주 같은 요일 대비 이 비율 이상 뛰면 '급증'
  ('spendSpikeRatio', '1.5'),
  -- 직전 기간 대비 ROAS가 이 비율 아래로 떨어지면 '급락'
  ('roasDropRatio', '0.6'),
  -- 토큰 만료가 이 날짜 안으로 다가오면 알린다
  ('tokenWarnDays', '14')
on conflict (key) do nothing;
