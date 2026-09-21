-- 같은 단계 안에서 카드를 위아래로 옮길 수 있게 순서를 저장한다.
-- 값이 같으면(기존 기록은 모두 0) 원래 보이던 순서를 그대로 지킨다.

alter table public.collabs
  add column if not exists sort_order integer not null default 0;

create index if not exists collabs_stage_sort_idx
  on public.collabs (stage, sort_order);
