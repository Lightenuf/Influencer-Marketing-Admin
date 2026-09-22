-- 마켓을 열기 전에 잡아두는 목표.
-- 끝난 뒤 실제 매출·판매 수량과 견주기 위해 카드에 적어둔다.

alter table public.collabs
  add column if not exists target_revenue bigint not null default 0;

-- 처음에는 '예산(원)'으로 잘못 넣었던 칸을 수량으로 고친다.
-- (이미 planned_budget 으로 만든 경우에만 이름을 바꾼다)
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'collabs' and column_name = 'planned_budget'
  ) then
    alter table public.collabs rename column planned_budget to planned_units;
  end if;
end $$;

alter table public.collabs
  add column if not exists planned_units integer not null default 0;
