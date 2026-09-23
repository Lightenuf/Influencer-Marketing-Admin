-- 마켓은 하루만 여는 것이 아니라 며칠에 걸쳐 열린다.
-- 기존 market_date 는 시작 예정일로 쓰고, 종료 예정일을 따로 적는다.

alter table public.collabs
  add column if not exists market_end_date date;
