-- 자사몰 실매출 — MER과 신규 구매 비중에 쓴다.
--
-- 메타가 말하는 매출은 메타가 자기 광고 덕이라고 본 것이다.
-- 그것만 보면 실제로 얼마를 벌었는지 알 수 없다. 아임웹 주문에서 직접 센다.
--
-- customer_orders 에는 취소·반품이 애초에 빠져 있다 (아임웹에서 옮길 때 걸렀다).

create or replace function public.shop_revenue(from_day date, to_day date)
returns jsonb
language plpgsql stable as $$
declare
  started timestamptz := from_day::timestamptz;
  ended   timestamptz := to_day::timestamptz + interval '1 day';
  result  jsonb;
begin
  select jsonb_build_object(
    'revenue', coalesce(sum(o.amount), 0),
    'orders', count(*),
    'buyers', count(distinct o.member_code),
    -- 이 기간에 처음 산 사람의 주문 = 신규. 나머지는 재구매.
    'newOrders', count(*) filter (where c.first_ordered_at >= started),
    'newRevenue', coalesce(sum(o.amount) filter (where c.first_ordered_at >= started), 0),
    'syncedAt', (select max(synced_at) from public.customers)
  ) into result
  from public.customer_orders o
  left join public.customers c on c.member_code = o.member_code
  where o.ordered_at >= started and o.ordered_at < ended;

  return result;
end;
$$;

grant execute on function public.shop_revenue(date, date) to authenticated, service_role;
