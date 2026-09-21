-- 소재 업로드 프리셋.
-- 자주 쓰는 설정 조합(광고 세트·버튼·문구·파트너십 여부)을 저장해 두고 골라 쓴다.

create table if not exists public.meta_upload_presets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  objective text not null default 'OUTCOME_SALES',
  -- 기존 광고 세트에 붙일 때의 대상. 비어 있으면 업로드할 때 고른다.
  adset_id text,
  cta text not null default 'SHOP_NOW',
  landing_url text not null default '',
  primary_text text not null default '',
  is_partnership boolean not null default false,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

alter table public.meta_upload_presets enable row level security;

drop policy if exists meta_upload_presets_all on public.meta_upload_presets;
create policy meta_upload_presets_all on public.meta_upload_presets
  for all to authenticated using (true) with check (true);

grant select, insert, update, delete on public.meta_upload_presets to authenticated;

-- 영상 소재를 잠시 올려두는 자리.
-- 메타는 URL을 주면 직접 받아가므로, 큰 영상을 함수로 통과시키지 않아도 된다.
insert into storage.buckets (id, name, public)
values ('meta-creatives', 'meta-creatives', false)
on conflict (id) do nothing;

drop policy if exists meta_creatives_rw on storage.objects;
create policy meta_creatives_rw on storage.objects
  for all to authenticated
  using (bucket_id = 'meta-creatives')
  with check (bucket_id = 'meta-creatives');
