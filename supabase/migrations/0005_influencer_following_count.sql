-- 팔로워 대비 팔로잉 수를 함께 보기 위한 항목.
alter table public.influencers add column if not exists following_count integer not null default 0;
