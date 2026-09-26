-- 캠페인이 실제로 주문을 만들었는지 센다.
--
-- 받은 사람 중에서 발송 뒤 정해진 날(기본 7일) 안에 주문한 사람을 센다.
-- 취소·반품 주문은 애초에 customers/customer_orders로 옮길 때 빠져 있다.

create or replace function public.campaign_conversion(
  campaign uuid,
  window_days integer default 7
)
returns jsonb
language plpgsql stable as $$
declare
  started timestamptz;
  ended   timestamptz;
  result  jsonb;
begin
  select c.sent_at, c.sent_at + make_interval(days => greatest(coalesce(window_days, 7), 1))
    into started, ended
  from public.message_campaigns c where c.id = campaign;

  if started is null then
    return jsonb_build_object('purchaseCount', 0, 'purchaseAmount', 0, 'buyers', 0);
  end if;

  select jsonb_build_object(
    'purchaseCount', count(*),
    'purchaseAmount', coalesce(sum(o.amount), 0),
    'buyers', count(distinct o.member_code)
  ) into result
  from public.campaign_recipients r
  join public.customer_orders o on o.member_code = r.member_code
  where r.campaign_id = campaign
    and o.ordered_at >= started
    and o.ordered_at < ended;

  return coalesce(result, jsonb_build_object('purchaseCount', 0, 'purchaseAmount', 0, 'buyers', 0));
end;
$$;

-- 진정성 콘텐츠처럼 늦게 효과가 나는 것은 30일 재구매율도 본다.
-- 위 함수에 30을 넣으면 같은 계산이라, 따로 두지 않고 화면에서 기간만 바꿔 부른다.

grant execute on function public.campaign_conversion(uuid, integer) to authenticated, service_role;
