-- 마케팅 수신 동의로 고객을 거르지 않는다.
--
-- 동의 여부는 '보낼 수 있는가'의 문제이지 '누가 해당되는가'의 문제가 아니다.
-- 게다가 지금 아임웹 회원은 전원 '아니오'라, 이걸로 거르면 어떤 조건을 걸어도 0명이 된다.
-- 동의자 수는 따로 세어 같이 돌려주므로, 발송 대상은 그 숫자로 판단한다.

create or replace function public.preview_customer_group(conditions jsonb, row_limit integer default 200)
returns jsonb
language plpgsql stable as $$
declare
  profile   jsonb  := coalesce(conditions->'profile', '{}'::jsonb);
  behaviors jsonb  := coalesce(conditions->'behaviors', '[]'::jsonb);
  grades    text[] := array(select jsonb_array_elements_text(coalesce(profile->'grades', '[]'::jsonb)));
  genders   text[] := array(select jsonb_array_elements_text(coalesce(profile->'genders', '[]'::jsonb)));
  bands     text[] := array(select jsonb_array_elements_text(coalesce(profile->'ageBands', '[]'::jsonb)));
  joined_f  text   := nullif(profile->>'joinedFrom', '');
  joined_t  text   := nullif(profile->>'joinedTo', '');
  took      integer := greatest(coalesce(row_limit, 200), 0);
  result    jsonb;
begin
  with hit as (
    select c.*
    from public.customers c
    where
      (cardinality(grades) = 0 or c.member_grade = any (grades))
      and (cardinality(genders) = 0 or (
        ('M' = any (genders) and c.gender = 'M')
        or ('F' = any (genders) and c.gender = 'F')
        or ('unknown' = any (genders) and c.gender not in ('M', 'F'))
      ))
      and (cardinality(bands) = 0 or public.crm_age_band(c.birth) = any (bands))
      and (joined_f is null or c.joined_at >= joined_f::timestamptz)
      and (joined_t is null or c.joined_at < joined_t::timestamptz + interval '1 day')
      -- 행동 조건은 모두 만족해야 한다
      and not exists (
        select 1 from jsonb_array_elements(behaviors) r
        where not public.crm_matches_rule(c, r.value)
      )
  )
  select jsonb_build_object(
    'total', (select count(*) from hit),
    'smsAgreed', (select count(*) from hit where marketing_agree_sms),
    'rows', (
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'memberCode', p.member_code,
          'name', p.name,
          'callnum', p.callnum,
          'email', p.email,
          'marketingAgreeSms', p.marketing_agree_sms,
          'memberGrade', p.member_grade,
          'orderCount', p.order_count,
          'totalSpent', p.total_spent,
          'lastOrderedAt', p.last_ordered_at
        )
      ), '[]'::jsonb)
      from (
        select * from hit
        order by last_ordered_at desc nulls last, member_code
        limit took
      ) p
    ),
    'syncedAt', (select max(synced_at) from public.customers)
  )
  into result;

  return result;
end;
$$;

-- 고객군 조건은 개인정보가 아니라 '조건'만 들어 있다.
-- 왜 0명이 나오는지 확인하려면 조건을 읽을 수 있어야 해서 읽기 권한을 준다.
grant select on public.customer_groups to service_role;
