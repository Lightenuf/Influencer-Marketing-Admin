-- 마켓을 열기 전에 잡아두는 목표.
-- 끝난 뒤 실제 매출과 견주기 위해 카드에 적어둔다.

alter table public.collabs
  add column if not exists target_revenue bigint not null default 0,
  add column if not exists planned_budget bigint not null default 0;
