-- 인플루언서 관리 어드민 초기 스키마
-- Supabase 대시보드 → SQL Editor 에 전체를 붙여넣고 한 번 실행하세요.

-- ─────────────────────────────────────────────
-- 1. 팀원 프로필 (auth.users 확장)
-- ─────────────────────────────────────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  display_name text,
  role text not null default 'member' check (role in ('member', 'admin')),
  created_at timestamptz not null default now()
);

-- 계정이 만들어지면 프로필 행을 자동 생성한다.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ─────────────────────────────────────────────
-- 2. 인플루언서 마스터
-- ─────────────────────────────────────────────
create table if not exists public.influencers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sns_platform text not null default 'instagram',
  sns_handle text not null default '',
  sns_url text not null default '',
  follower_count integer not null default 0,
  categories text[] not null default '{}',
  avg_revenue_band text not null default '미확인',
  contact_email text not null default '',
  contact_phone text not null default '',
  contact_etc text not null default '',
  status text not null default '제안중',
  memo text not null default '',
  -- 조회용 캐시. 진실의 원천은 dnc_audit_log 이며 아래 트리거가 동기화한다.
  do_not_contact boolean not null default false,
  dnc_reason text,
  dnc_set_by uuid references public.profiles (id),
  dnc_set_at timestamptz,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists influencers_status_idx on public.influencers (status);
create index if not exists influencers_dnc_idx on public.influencers (do_not_contact);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists influencers_touch on public.influencers;
create trigger influencers_touch before update on public.influencers
for each row execute function public.touch_updated_at();

-- ─────────────────────────────────────────────
-- 3. 연락 금지 이력 (추가 전용 — 수정·삭제 불가)
-- ─────────────────────────────────────────────
create table if not exists public.dnc_audit_log (
  id uuid primary key default gen_random_uuid(),
  influencer_id uuid not null references public.influencers (id) on delete cascade,
  action text not null check (action in ('set', 'unset')),
  reason text not null,
  reason_detail text not null default '',
  set_by uuid not null references public.profiles (id),
  set_at timestamptz not null default now()
);

create index if not exists dnc_audit_influencer_idx on public.dnc_audit_log (influencer_id, set_at desc);

-- 이력이 쌓이면 인플루언서의 현재 상태를 맞춰준다.
create or replace function public.sync_dnc_state()
returns trigger language plpgsql as $$
begin
  update public.influencers set
    do_not_contact = (new.action = 'set'),
    dnc_reason     = case when new.action = 'set' then new.reason else null end,
    dnc_set_by     = case when new.action = 'set' then new.set_by else null end,
    dnc_set_at     = case when new.action = 'set' then new.set_at else null end,
    status         = case when new.action = 'set' then '취소' else status end
  where id = new.influencer_id;
  return new;
end;
$$;

drop trigger if exists dnc_audit_sync on public.dnc_audit_log;
create trigger dnc_audit_sync after insert on public.dnc_audit_log
for each row execute function public.sync_dnc_state();

-- ─────────────────────────────────────────────
-- 4. 협업 파이프라인
-- ─────────────────────────────────────────────
create table if not exists public.collabs (
  id uuid primary key default gen_random_uuid(),
  influencer_id uuid not null references public.influencers (id) on delete cascade,
  title text not null default '',
  collab_type text not null default '마켓',
  stage text not null default '회신완료',
  stage_entered_at timestamptz not null default now(),
  start_date date,
  end_date date,
  sample_ship_date date,
  content_due_date date,
  fee integer not null default 0,
  is_cancelled boolean not null default false,
  cancel_reason text,
  cancel_reason_detail text not null default '',
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists collabs_stage_idx on public.collabs (stage);

-- 단계가 바뀐 시점을 기록해 '며칠째 대기 중'을 계산한다.
create or replace function public.track_stage_change()
returns trigger language plpgsql as $$
begin
  if new.stage is distinct from old.stage then
    new.stage_entered_at = now();
  end if;
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists collabs_stage_track on public.collabs;
create trigger collabs_stage_track before update on public.collabs
for each row execute function public.track_stage_change();

-- ─────────────────────────────────────────────
-- 5. 샘플·제품 출고
-- ─────────────────────────────────────────────
create table if not exists public.shipments (
  id uuid primary key default gen_random_uuid(),
  influencer_id uuid not null references public.influencers (id) on delete cascade,
  collab_id uuid references public.collabs (id) on delete set null,
  status text not null default '배송준비중',
  collab_type text not null default '샘플',
  product_name text not null default '',
  quantity integer not null default 1,
  carrier text not null default '',
  tracking_number text not null default '',
  requested_at timestamptz not null default now(),
  shipped_at date,
  delivered_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists shipments_touch on public.shipments;
create trigger shipments_touch before update on public.shipments
for each row execute function public.touch_updated_at();

-- ─────────────────────────────────────────────
-- 6. 커뮤니케이션 기록
-- ─────────────────────────────────────────────
create table if not exists public.communication_logs (
  id uuid primary key default gen_random_uuid(),
  influencer_id uuid not null references public.influencers (id) on delete cascade,
  author_id uuid not null references public.profiles (id),
  note text not null,
  logged_at timestamptz not null default now()
);

create index if not exists communication_logs_influencer_idx
  on public.communication_logs (influencer_id, logged_at desc);

-- ─────────────────────────────────────────────
-- 7. RLS — 로그인한 팀원만 접근 가능
-- ─────────────────────────────────────────────
alter table public.profiles enable row level security;
alter table public.influencers enable row level security;
alter table public.dnc_audit_log enable row level security;
alter table public.collabs enable row level security;
alter table public.shipments enable row level security;
alter table public.communication_logs enable row level security;

-- 프로필: 전체 조회 가능, 본인 것만 수정 가능
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated using (true);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- 업무 데이터: 로그인한 팀원은 모두 읽고 쓸 수 있다
do $$
declare t text;
begin
  foreach t in array array['influencers', 'collabs', 'shipments', 'communication_logs']
  loop
    execute format('drop policy if exists %I_all on public.%I', t, t);
    execute format(
      'create policy %I_all on public.%I for all to authenticated using (true) with check (true)',
      t, t
    );
  end loop;
end;
$$;

-- 연락 금지 이력: 읽기와 추가만 허용. 수정·삭제 정책이 없으므로 이력 위변조가 불가능하다.
drop policy if exists dnc_audit_select on public.dnc_audit_log;
create policy dnc_audit_select on public.dnc_audit_log
  for select to authenticated using (true);

drop policy if exists dnc_audit_insert on public.dnc_audit_log;
create policy dnc_audit_insert on public.dnc_audit_log
  for insert to authenticated with check (auth.uid() = set_by);
