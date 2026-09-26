-- 소재 — 에셋·카피·조합.
--
-- 이미지는 AI로 만들지 않는다. 힘스필드에서 만든 검수본만 에셋으로 쓴다.
-- 어드민이 하는 일은 카피를 여러 벌 만들고, 에셋·템플릿과 조합해 올리는 것이다.

-- ── 에셋 (이미지) ──
create table if not exists public.ad_assets (
  id uuid primary key default gen_random_uuid(),
  -- 스토리지 경로. 원본은 버킷에 둔다
  path text not null,
  file_name text not null default '',
  width integer not null default 0,
  height integer not null default 0,

  -- 사과 · 복숭아 · 레몬진저 · 복수
  product text not null default '',
  -- 제품 단독 · 라이프스타일 · 인물
  scene text not null default '',
  tone text not null default '',
  -- 1:1 · 4:5 · 9:16 — 너비÷높이로 자동 판정한 값
  ratio text not null default '',
  -- 힘스필드 · 촬영 · 기타
  origin text not null default '힘스필드',

  -- active(사용 가능) · archived(보관)
  status text not null default 'active',
  memo text not null default '',

  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ad_assets_status_idx on public.ad_assets (status, created_at desc);

drop trigger if exists ad_assets_touch on public.ad_assets;
create trigger ad_assets_touch
before update on public.ad_assets
for each row execute function public.touch_updated_at();

-- ── 카피 ──
create table if not exists public.ad_copies (
  id uuid primary key default gen_random_uuid(),

  headline text not null default '',
  subhead text not null default '',
  badge text not null default '',
  -- 메타 primary text
  body text not null default '',
  -- 메타 headline
  link_title text not null default '',

  segment text not null default '',
  angle text not null default '',
  hook text not null default '',
  offer_type text not null default '없음',
  offer_value text not null default '',

  -- claude(만들어 준 것) · manual(직접 쓴 것)
  source text not null default 'manual',
  -- draft · approved · rejected
  status text not null default 'draft',
  -- 반려 사유 — 모아서 다음 생성에 반영한다
  reject_reason text not null default '',
  -- 자동 검수에서 걸린 것들
  flags jsonb not null default '[]'::jsonb,

  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ad_copies_status_idx on public.ad_copies (status, created_at desc);

drop trigger if exists ad_copies_touch on public.ad_copies;
create trigger ad_copies_touch
before update on public.ad_copies
for each row execute function public.touch_updated_at();

-- ── 조합 (카피 × 에셋 × 템플릿) ──
create table if not exists public.creative_drafts (
  id uuid primary key default gen_random_uuid(),
  copy_id uuid references public.ad_copies (id) on delete cascade,
  asset_id uuid references public.ad_assets (id) on delete cascade,
  -- 템플릿은 코드에 있다. 여기에는 무엇을 썼는지만 적는다
  template_key text not null default '',
  ratio text not null default '',

  -- 만들어진 이미지. 승인한 것만 올려 둔다
  rendered_path text not null default '',

  -- draft · approved · rejected
  status text not null default 'draft',
  reject_reason text not null default '',

  -- 올라간 뒤 메타 광고와 이어 둔다
  uploaded_ad_id text not null default '',
  experiment_id uuid,

  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists creative_drafts_status_idx on public.creative_drafts (status, created_at desc);

drop trigger if exists creative_drafts_touch on public.creative_drafts;
create trigger creative_drafts_touch
before update on public.creative_drafts
for each row execute function public.touch_updated_at();

alter table public.ad_assets enable row level security;
alter table public.ad_copies enable row level security;
alter table public.creative_drafts enable row level security;

drop policy if exists ad_assets_all on public.ad_assets;
create policy ad_assets_all on public.ad_assets
  for all to authenticated using (true) with check (true);

drop policy if exists ad_copies_all on public.ad_copies;
create policy ad_copies_all on public.ad_copies
  for all to authenticated using (true) with check (true);

drop policy if exists creative_drafts_all on public.creative_drafts;
create policy creative_drafts_all on public.creative_drafts
  for all to authenticated using (true) with check (true);

grant select, insert, update, delete on public.ad_assets to authenticated, service_role;
grant select, insert, update, delete on public.ad_copies to authenticated, service_role;
grant select, insert, update, delete on public.creative_drafts to authenticated, service_role;

-- ── 에셋 보관함 ──
insert into storage.buckets (id, name, public)
values ('ad_assets', 'ad_assets', false)
on conflict (id) do nothing;

drop policy if exists ad_assets_rw on storage.objects;
create policy ad_assets_rw on storage.objects
  for all to authenticated
  using (bucket_id = 'ad_assets')
  with check (bucket_id = 'ad_assets');

-- ── 자동 검수 규칙 (8-4) ──
-- 식품표시광고법에 걸리는 표현은 화면에서 늘릴 수 있어야 한다.
insert into public.ops_settings (key, value) values
  ('bannedWords', '["변비 개선","변비 해소","살 빠지","체지방 감소","디톡스","면역력","혈당 조절","화학원료 무첨가","질병","치료","예방","효능","독소 배출","붓기 제거","숙변"]'),
  -- 식이섬유는 4g 만 쓴다. 다른 수치가 보이면 막는다
  ('fiberGram', '4'),
  ('headlineMaxChars', '18'),
  ('subheadMaxChars', '30'),
  ('bodyMaxChars', '125'),
  -- 한 번에 만들 수 있는 조합 수
  ('maxCombos', '30'),
  -- 카피를 만들 때 넘기는 브랜드 사실 (8-3)
  ('brandFacts', '"브리보: 카페인 프리, 저당, 식물성 프리바이오틱 탄산음료, 355ml 캔, 사과·복숭아.\n식물 유래 원료만 사용. 합성감미료(아스파탐·수크랄로스·에리스리톨) 미사용.\n식이섬유 표기는 4g만 허용.\n톤: ''제로/프리프럼''이 아닌 ''더하는 식품(+플러스)'', 원료·원가 투명성, 맛있어서 매일 마시는 음료. 다이어트 제품처럼 보이지 않게."')
on conflict (key) do nothing;
