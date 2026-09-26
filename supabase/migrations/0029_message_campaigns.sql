-- 캠페인.
--
-- 어드민에서 보낸 것과, 예전에 아임웹에서 보내고 CSV로 올린 것을 한 표에 담는다.
-- 갈라 두면 "어떤 메시지가 반응이 좋았나"를 비교할 수 없다.
--
-- 성공률·클릭률·전환율은 저장하지 않는다. 세는 수만 두고 볼 때 계산한다 —
-- 저장해 두면 원수가 고쳐졌을 때 비율만 옛날 값으로 남는다.

drop table if exists public.message_receipts;
drop table if exists public.message_sends;

create table if not exists public.message_campaigns (
  id uuid primary key default gen_random_uuid(),

  -- sms · brand_message
  channel text not null default 'sms',
  -- draft(임시저장) · pending(발송 대기) · sent(발송 완료) · failed(발송 실패) · canceled(발송 취소)
  status text not null default 'draft',
  sent_at timestamptz,
  -- SMS · LMS · MMS · 기본 · 이미지 · 와이드 · 캐러셀
  message_type text not null default '',
  title text not null default '',

  target_count integer not null default 0,
  success_count integer not null default 0,
  click_count integer not null default 0,
  unsubscribe_count integer not null default 0,
  visit_count integer not null default 0,
  purchase_count integer not null default 0,
  purchase_amount bigint not null default 0,
  cost_won integer not null default 0,

  -- 고객 행동 관리의 고객군. 조건도 같이 둔다 — 그룹이 나중에 바뀌어도
  -- 이 캠페인이 누구에게 갔는지는 그대로 남아야 한다.
  segment_id uuid references public.customer_groups (id) on delete set null,
  segment_name text not null default '',
  conditions jsonb not null default '{}'::jsonb,

  -- 발송 당시 원문. 나중에 문안을 고쳐도 보낸 것은 그대로 남는다.
  message_body text not null default '',
  image_url text not null default '',
  is_ad boolean not null default false,

  -- imweb_import(CSV로 올림) · admin_send(어드민에서 보냄) · manual(손으로 적음)
  source text not null default 'manual',
  raw jsonb not null default '{}'::jsonb,

  -- 왜 보냈나 — 나중에 비교하려고 남긴다
  purpose text not null default '',
  concepts text[] not null default '{}',
  offer_type text not null default '없음',
  offer_value text not null default '',
  hypothesis text not null default '',
  retrospective text not null default '',

  error text not null default '',
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 같은 채널·발송 일시·메시지 유형이면 같은 캠페인으로 본다. CSV를 두 번 올려도 늘지 않는다.
create unique index if not exists message_campaigns_dedupe_idx
  on public.message_campaigns (channel, sent_at, message_type)
  where sent_at is not null;

create index if not exists message_campaigns_sent_idx on public.message_campaigns (sent_at desc);
create index if not exists message_campaigns_purpose_idx on public.message_campaigns (purpose);

drop trigger if exists message_campaigns_touch on public.message_campaigns;
create trigger message_campaigns_touch
before update on public.message_campaigns
for each row execute function public.touch_updated_at();

-- 누구에게 갔는지. 구매 전환을 세려면 사람 단위가 필요하다.
create table if not exists public.campaign_recipients (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.message_campaigns (id) on delete cascade,
  member_code text not null default '',
  callnum text not null,
  status text not null default 'sent',
  created_at timestamptz not null default now()
);

create index if not exists campaign_recipients_campaign_idx
  on public.campaign_recipients (campaign_id);

-- 목적·컨셉·오퍼 선택지. 화면에서 늘릴 수 있어야 해서 표로 둔다.
create table if not exists public.campaign_options (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  label text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create unique index if not exists campaign_options_unique_idx
  on public.campaign_options (kind, label);

insert into public.campaign_options (kind, label, sort_order) values
  ('purpose', '재구매 유도', 1),
  ('purpose', '신규 첫 구매', 2),
  ('purpose', '휴면 복귀', 3),
  ('purpose', '신제품 알림', 4),
  ('purpose', '관계 형성', 5),
  ('purpose', '기타', 99),
  ('concept', '할인', 1),
  ('concept', '진정성 콘텐츠', 2),
  ('concept', '제품 교육', 3),
  ('concept', '후기', 4),
  ('concept', '시즌', 5),
  ('concept', '기타', 99),
  ('offer_type', '없음', 1),
  ('offer_type', '% 할인', 2),
  ('offer_type', '금액 쿠폰', 3),
  ('offer_type', '무료배송', 4),
  ('offer_type', '증정', 5)
on conflict (kind, label) do nothing;

alter table public.message_campaigns enable row level security;
alter table public.campaign_recipients enable row level security;
alter table public.campaign_options enable row level security;

drop policy if exists message_campaigns_all on public.message_campaigns;
create policy message_campaigns_all on public.message_campaigns
  for all to authenticated using (true) with check (true);

drop policy if exists campaign_recipients_all on public.campaign_recipients;
create policy campaign_recipients_all on public.campaign_recipients
  for all to authenticated using (true) with check (true);

drop policy if exists campaign_options_all on public.campaign_options;
create policy campaign_options_all on public.campaign_options
  for all to authenticated using (true) with check (true);

grant select, insert, update, delete on public.message_campaigns to authenticated, service_role;
grant select, insert, update, delete on public.campaign_recipients to authenticated, service_role;
grant select, insert, update, delete on public.campaign_options to authenticated, service_role;
