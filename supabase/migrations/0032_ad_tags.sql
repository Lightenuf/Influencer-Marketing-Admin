-- 퍼포먼스 마케팅 태그·네이밍·운영 기준.
--
-- 메타에 있는 광고 이름은 건드리지 않는다. 태그는 여기에 ad_id 로 붙여 둔다.
-- 이름은 보조 수단일 뿐이고, 분석은 전부 이 표 위에서 돈다.

-- ── 태그 사전 ──
-- 선택지를 코드에 박아 두면 새 앵글이 생길 때마다 개발자를 불러야 한다.
create table if not exists public.ad_tag_options (
  id uuid primary key default gen_random_uuid(),
  -- source · format · angle · hook · segment · offer
  dimension text not null,
  label text not null,
  sort_order integer not null default 50,
  -- 지운 것을 되살릴 일이 있어 지우지 않고 끈다. 이미 붙은 태그도 남아야 한다.
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index if not exists ad_tag_options_unique_idx
  on public.ad_tag_options (dimension, label);

-- ── 레거시 이름 매핑 ──
-- '성분' → 원료·성분(투명성) 처럼, 옛 이름의 토막을 태그로 옮기는 사전.
-- 파서가 이 표를 읽으므로 새 표현이 나오면 화면에서 더하면 된다.
create table if not exists public.ad_name_aliases (
  id uuid primary key default gen_random_uuid(),
  dimension text not null,
  token text not null,
  label text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists ad_name_aliases_unique_idx
  on public.ad_name_aliases (dimension, token);

-- ── 광고별 태그 ──
create table if not exists public.ad_tags (
  ad_id text primary key,
  account_id text not null default '',
  -- 같은 소재가 여러 세트에 복제돼 있다. 합산은 이 키로 한다 (5-4)
  creative_key text not null default '',

  source text not null default '',
  format text not null default '',
  angle text not null default '',
  hook text not null default '',
  segment text not null default '',
  offer text not null default '',
  landing text not null default '',

  -- UGC일 때만. 인플루언서 섹션의 셀러와 잇는다
  creator_id uuid references public.influencers (id) on delete set null,

  -- 소재·실험 메뉴에서 자동으로 채운다 (Phase 4·5)
  asset_id uuid,
  copy_id uuid,
  template_id uuid,
  experiment_id uuid,

  -- parser(이름에서 읽음) · manual(사람이 붙임)
  tagged_from text not null default 'manual',
  tagged_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ad_tags_creative_key_idx on public.ad_tags (creative_key);
create index if not exists ad_tags_angle_idx on public.ad_tags (angle);
create index if not exists ad_tags_account_idx on public.ad_tags (account_id);

drop trigger if exists ad_tags_touch on public.ad_tags;
create trigger ad_tags_touch
before update on public.ad_tags
for each row execute function public.touch_updated_at();

-- ── 운영 기준 ──
-- 제안 규칙과 상태 배지가 전부 여기서 숫자를 읽는다. 코드에 박지 않는다.
create table if not exists public.ops_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.ad_tag_options enable row level security;
alter table public.ad_name_aliases enable row level security;
alter table public.ad_tags enable row level security;
alter table public.ops_settings enable row level security;

drop policy if exists ad_tag_options_all on public.ad_tag_options;
create policy ad_tag_options_all on public.ad_tag_options
  for all to authenticated using (true) with check (true);

drop policy if exists ad_name_aliases_all on public.ad_name_aliases;
create policy ad_name_aliases_all on public.ad_name_aliases
  for all to authenticated using (true) with check (true);

drop policy if exists ad_tags_all on public.ad_tags;
create policy ad_tags_all on public.ad_tags
  for all to authenticated using (true) with check (true);

drop policy if exists ops_settings_all on public.ops_settings;
create policy ops_settings_all on public.ops_settings
  for all to authenticated using (true) with check (true);

grant select, insert, update, delete on public.ad_tag_options to authenticated, service_role;
grant select, insert, update, delete on public.ad_name_aliases to authenticated, service_role;
grant select, insert, update, delete on public.ad_tags to authenticated, service_role;
grant select, insert, update, delete on public.ops_settings to authenticated, service_role;

-- ── 태그 초깃값 (5-1) ──
insert into public.ad_tag_options (dimension, label, sort_order) values
  ('source', 'DA(자체 제작)', 1),
  ('source', 'UGC(파트너십)', 2),
  ('source', 'UGC(일반)', 3),

  ('format', '지면', 1),
  ('format', '영상', 2),
  ('format', '반반', 3),
  ('format', '캐러셀', 4),

  ('angle', '원료·성분(투명성)', 1),
  ('angle', '식이섬유', 2),
  ('angle', '맛', 3),
  ('angle', '할인·오퍼', 4),
  ('angle', '권위(유통·입점)', 5),
  ('angle', '상황·고민', 6),
  ('angle', '다이어트', 7),
  ('angle', '가족', 8),
  ('angle', '창업자·브랜드', 9),
  ('angle', '트렌드', 10),
  ('angle', '제품 소개', 11),

  ('hook', '질문', 1),
  ('hook', '숫자', 2),
  ('hook', '반전', 3),
  ('hook', '고백', 4),
  ('hook', '비교', 5),

  ('segment', '결혼·출산', 1),
  ('segment', '육아', 2),
  ('segment', '다이어트', 3),
  ('segment', '40대 중후반', 4),
  ('segment', '전체', 5),

  ('offer', '없음', 1),
  ('offer', '% 할인', 2),
  ('offer', '쿠폰팩', 3),
  ('offer', '무료배송', 4),
  ('offer', '기타', 5)
on conflict (dimension, label) do nothing;

-- ── 레거시 이름 매핑 초깃값 (5-3) ──
-- 실제 광고 306개를 훑어 나온 표현들이다.
insert into public.ad_name_aliases (dimension, token, label) values
  ('angle', '원료', '원료·성분(투명성)'),
  ('angle', '성분', '원료·성분(투명성)'),
  ('angle', '클린성분', '원료·성분(투명성)'),
  ('angle', '식이섬유', '식이섬유'),
  ('angle', '맛', '맛'),
  ('angle', '할인', '할인·오퍼'),
  ('angle', '오퍼', '할인·오퍼'),
  ('angle', '쿠폰', '할인·오퍼'),
  ('angle', '국내최초', '권위(유통·입점)'),
  ('angle', '권위', '권위(유통·입점)'),
  ('angle', '입점', '권위(유통·입점)'),
  ('angle', '유통', '권위(유통·입점)'),
  ('angle', '약국', '권위(유통·입점)'),
  ('angle', '상황', '상황·고민'),
  ('angle', '고민', '상황·고민'),
  ('angle', '다이어트', '다이어트'),
  ('angle', '식단', '다이어트'),
  ('angle', '가족', '가족'),
  ('angle', '엄마', '가족'),
  ('angle', '육아', '가족'),
  ('angle', '창업자', '창업자·브랜드'),
  ('angle', '브랜드', '창업자·브랜드'),
  ('angle', '트렌드', '트렌드'),
  ('angle', '세대', '트렌드'),
  ('angle', '제품소개', '제품 소개'),
  ('angle', '스팩소개', '제품 소개'),
  ('angle', '레시피', '제품 소개'),

  ('format', '지면', '지면'),
  ('format', '영상', '영상'),
  ('format', '반반', '반반'),
  ('format', '캐러셀', '캐러셀'),

  ('hook', '질문', '질문'),
  ('hook', '숫자', '숫자'),
  ('hook', '반전', '반전'),
  ('hook', '고백', '고백'),
  ('hook', '비교', '비교')
on conflict (dimension, token) do nothing;

-- ── 운영 기준 초깃값 (5-5) ──
insert into public.ops_settings (key, value) values
  ('breakEvenRoas', '2.15'),
  ('roasBasis', '"firstPurchase"'),
  ('repurchaseRate', '0.19'),
  ('repurchaseDays', '40'),
  ('aovMode', '"auto"'),
  ('aovManual', '0'),
  ('judgeDays', '7'),
  ('minSpendMultiplier', '2'),
  ('increaseStep', '0.2'),
  ('increaseIntervalDays', '3'),
  ('decreaseStep', '0.2'),
  ('dailyIncreaseCap', '0.3'),
  ('testAdSetIds', '[]'),
  ('spentOnlyByDefault', 'true')
on conflict (key) do nothing;
