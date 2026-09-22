-- 마켓을 마친 뒤 크리에이터에게 준 정산액(수수료 포함).
-- 정산 여부만으로는 얼마가 나갔는지 알 수 없어 금액을 따로 적는다.

alter table public.collabs
  add column if not exists settlement_amount bigint not null default 0;
