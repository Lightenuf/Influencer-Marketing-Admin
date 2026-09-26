-- 손으로 넣은 번호를 발송 대상으로 다듬는다.
--
-- 고객군으로 보낼 때와 달리 번호를 사람이 직접 넣는다. 그래도 수신거부 거르기는
-- 여기서 해야 한다 — 화면에서만 거르면 실수나 우회로 거부한 분에게 나갈 수 있다.
--
-- 아는 번호면 회원 코드를 붙여 준다. 그래야 나중에 구매 전환을 셀 수 있다.

create or replace function public.check_send_numbers(numbers text[])
returns jsonb
language plpgsql stable as $$
declare
  result jsonb;
begin
  with given as (
    -- 하이픈·공백을 떼고 같은 번호는 하나로 본다
    select distinct regexp_replace(n, '[^0-9]', '', 'g') as digits
    from unnest(coalesce(numbers, '{}')) as n
    where regexp_replace(n, '[^0-9]', '', 'g') <> ''
  ),
  marked as (
    select
      g.digits,
      exists (
        select 1 from public.customer_optouts o
        where regexp_replace(o.callnum, '[^0-9]', '', 'g') = g.digits
      ) as opted_out,
      (
        select c.member_code from public.customers c
        where regexp_replace(c.callnum, '[^0-9]', '', 'g') = g.digits
        limit 1
      ) as member_code,
      (
        select c.name from public.customers c
        where regexp_replace(c.callnum, '[^0-9]', '', 'g') = g.digits
        limit 1
      ) as name
    from given g
  )
  select jsonb_build_object(
    'total', (select count(*) from marked),
    'sendable', (select count(*) from marked where not opted_out),
    'noNumber', 0,
    'optedOut', (select count(*) from marked where opted_out),
    'rows', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'memberCode', coalesce(m.member_code, ''),
        'name', coalesce(m.name, ''),
        'callnum', m.digits
      )), '[]'::jsonb)
      from marked m where not m.opted_out
    )
  ) into result;

  return result;
end;
$$;

grant execute on function public.check_send_numbers(text[]) to authenticated, service_role;
