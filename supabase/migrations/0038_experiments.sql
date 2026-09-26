-- 실험.
--
-- 한 라운드에 변수 하나만 바꾼다. 둘을 같이 바꾸면 무엇이 효과를 냈는지 알 수 없다.
-- 권장 순서는 앵글 → 훅 → 비주얼 → 오퍼.

create table if not exists public.experiments (
  id uuid primary key default gen_random_uuid(),
  name text not null default '',
  hypothesis text not null default '',

  -- 바꾸는 것 — 태그 차원 하나 (angle · hook · format · offer · segment)
  variable text not null default 'angle',
  -- 견줄 값 2~4개
  variants text[] not null default '{}',
  -- 나머지는 고정한다. 무엇을 고정했는지 적어 둔다
  fixed jsonb not null default '{}'::jsonb,

  adset_id text not null default '',
  adset_name text not null default '',
  daily_budget integer not null default 0,
  planned_days integer not null default 7,

  -- cpa 또는 roas
  metric text not null default 'roas',
  -- 이 값을 넘으면 이긴 것으로 본다. 비우면 값끼리 견주기만 한다
  target numeric,
  -- 값마다 이만큼은 써봐야 판단한다. 비우면 운영 기준의 판단 최소 지출을 쓴다
  min_spend integer not null default 0,

  -- draft(준비) · running(도는 중) · done(끝) · canceled
  status text not null default 'draft',
  started_at timestamptz,
  ended_at timestamptz,

  -- win · lose · inconclusive
  verdict text not null default '',
  -- 판정 당시 값별 집계를 굳혀 둔다. 나중에 지표가 바뀌어도 그때 판단 근거가 남아야 한다
  result jsonb not null default '{}'::jsonb,
  -- 사람이 한두 줄로 적는다. 다음 실험의 출발점이 된다
  learning text not null default '',

  -- imweb_import 처럼, 예전 기록을 가져온 것인지
  source text not null default 'admin',

  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists experiments_status_idx on public.experiments (status, created_at desc);

drop trigger if exists experiments_touch on public.experiments;
create trigger experiments_touch
before update on public.experiments
for each row execute function public.touch_updated_at();

alter table public.experiments enable row level security;

drop policy if exists experiments_all on public.experiments;
create policy experiments_all on public.experiments
  for all to authenticated using (true) with check (true);

grant select, insert, update, delete on public.experiments to authenticated, service_role;

-- 광고에 실험을 매단다. ad_tags 에 이미 experiment_id 칸이 있어 그것을 쓴다.
-- 여기서는 참조만 걸어 둔다 — 실험을 지워도 태그는 남아야 한다.
alter table public.ad_tags
  drop constraint if exists ad_tags_experiment_id_fkey;
alter table public.ad_tags
  add constraint ad_tags_experiment_id_fkey
  foreign key (experiment_id) references public.experiments (id) on delete set null;
