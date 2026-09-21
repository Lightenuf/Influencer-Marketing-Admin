-- 파이프라인 카드 메모.
-- 특이 요청사항처럼 그 사람과 일할 때 기억해야 할 것을 카드에 바로 적어둔다.

alter table public.collabs
  add column if not exists memo text not null default '';
