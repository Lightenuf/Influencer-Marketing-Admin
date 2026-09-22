-- 예상 소요량을 맛별로 적는다. (사과 · 복숭아 …)
-- 맛이 늘어도 컬럼을 더하지 않도록 한 칸에 모아 둔다.

alter table public.collabs
  add column if not exists planned_units_by_product jsonb not null default '{}'::jsonb;

-- 숫자 하나로 적던 시절의 값은 첫 맛(사과)으로 옮긴다.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'collabs' and column_name = 'planned_units'
  ) then
    update public.collabs
       set planned_units_by_product = jsonb_build_object('사과', planned_units)
     where planned_units > 0
       and planned_units_by_product = '{}'::jsonb;

    alter table public.collabs drop column planned_units;
  end if;
end $$;
