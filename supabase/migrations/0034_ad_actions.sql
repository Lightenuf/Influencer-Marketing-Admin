-- 오늘의 액션 — 제안과 실행 기록.
--
-- 규칙이 제안을 만들고, 사람이 누를 때만 실행된다. 자동 실행은 없다.
-- 무엇을 왜 했는지 남겨야 나중에 규칙이 맞았는지 따질 수 있다.

create table if not exists public.action_suggestions (
  id uuid primary key default gen_random_uuid(),

  -- increase · decrease · off · promote · scaleTest · replace · fatigue · thinAdSet
  kind text not null,
  -- campaign · adset · ad
  target_level text not null,
  target_id text not null,
  target_name text not null default '',
  account_id text not null default '',

  -- 판단에 쓴 숫자를 그대로 굳혀 둔다.
  -- 나중에 지표가 바뀌어도 '그때 무엇을 보고 제안했나'가 남아야 한다.
  evidence jsonb not null default '{}'::jsonb,
  -- 실행하면 무엇이 어떻게 되는지 (예: 일예산 12만 → 14.4만)
  effect jsonb not null default '{}'::jsonb,
  -- 판단 최소 지출을 넘겼는지
  confident boolean not null default false,

  -- open(그대로) · done(실행) · held(보류) · ignored(무시) · stale(지나감)
  status text not null default 'open',
  reason text not null default '',
  -- 가드레일에 걸려 승인이 필요한지
  needs_approval boolean not null default false,

  computed_at timestamptz not null default now(),
  decided_by uuid references public.profiles (id),
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

-- 같은 대상에 같은 종류의 제안이 여러 번 쌓이지 않게 한다.
-- 다시 계산하면 열려 있던 것을 덮어쓴다.
create unique index if not exists action_suggestions_open_idx
  on public.action_suggestions (kind, target_level, target_id)
  where status = 'open';

create index if not exists action_suggestions_status_idx
  on public.action_suggestions (status, computed_at desc);

-- 실행·보류·무시를 모두 남긴다. 화면 밖에서 바뀐 것도 여기에 적는다.
create table if not exists public.action_logs (
  id uuid primary key default gen_random_uuid(),
  suggestion_id uuid references public.action_suggestions (id) on delete set null,

  kind text not null,
  target_level text not null,
  target_id text not null,
  target_name text not null default '',

  -- executed · held · ignored · external(어드민 밖에서 바뀜)
  action text not null,
  reason text not null default '',
  -- 실행 직전 지표. 7일 뒤와 견주려면 그때 값이 있어야 한다
  before jsonb not null default '{}'::jsonb,
  detail jsonb not null default '{}'::jsonb,

  -- 7일 뒤 다시 재서 채운다
  after jsonb,
  outcome text,
  measured_at timestamptz,

  actor_id uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create index if not exists action_logs_created_idx on public.action_logs (created_at desc);
create index if not exists action_logs_kind_idx on public.action_logs (kind);

alter table public.action_suggestions enable row level security;
alter table public.action_logs enable row level security;

drop policy if exists action_suggestions_all on public.action_suggestions;
create policy action_suggestions_all on public.action_suggestions
  for all to authenticated using (true) with check (true);

drop policy if exists action_logs_all on public.action_logs;
create policy action_logs_all on public.action_logs
  for all to authenticated using (true) with check (true);

grant select, insert, update, delete on public.action_suggestions to authenticated, service_role;
grant select, insert, update, delete on public.action_logs to authenticated, service_role;

-- ── 운영 기준에 더하는 값 ──
insert into public.ops_settings (key, value) values
  -- 메타가 잡는 매출은 실제 자사몰 매출보다 적게 나온다.
  -- 개별 광고는 메타 숫자로만 판단할 수 있으므로, 손익분기를 그만큼 낮춰 잡는다.
  -- 1 이면 보정하지 않는다. 0.67 이면 손익분기 2.15 → 1.44 로 본다.
  ('metaAttributionFactor', '1'),
  -- 한 번에 이 금액 이상 올리면 승인을 받는다
  ('approvalAmountWon', '100000'),
  -- 승인자 (프로필 id 목록). 비어 있으면 아무나 승인할 수 있다
  ('approverIds', '[]'),
  -- 세트에 켜진 광고가 이보다 적으면 '소재 부족'
  ('minAdsPerAdSet', '3'),
  -- 실행 뒤 며칠 있다가 결과를 재는지
  ('measureAfterDays', '7')
on conflict (key) do nothing;
