-- 마켓 완료 단계에서 남기는 성과.
-- 어느 크리에이터가 실제로 매출을 일으켰는지 쌓아, 다음 시딩 대상을 고르는 근거로 쓴다.

alter table public.collabs add column if not exists market_revenue bigint not null default 0;
alter table public.collabs add column if not exists market_units integer not null default 0;
alter table public.collabs add column if not exists is_settled boolean not null default false;
-- 잘 터진 콘텐츠 링크 모음
alter table public.collabs add column if not exists content_links text[] not null default '{}';
