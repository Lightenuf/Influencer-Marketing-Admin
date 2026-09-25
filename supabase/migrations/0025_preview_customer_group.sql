-- 고객군 조건으로 실제 고객을 세고 명단을 뽑는다.
--
-- 어드민이 조건을 SQL로 번역해서 보내지 않고, 조건 그대로(jsonb) 넘긴다.
-- 세는 규칙을 한곳에 두어야 화면과 결과가 어긋나지 않기 때문이다.

-- 생일에서 연령대를 낸다. 비어 있거나 읽을 수 없으면 '모름'.
create or replace function public.crm_age_band(birth text)
returns text
language plpgsql immutable as $$
declare
  age_years integer;
begin
  if coalesce(birth, '') = '' then
    return 'unknown';
  end if;
  begin
    age_years := extract(year from age(birth::date))::integer;
  exception when others then
    return 'unknown';
  end;
  if age_years < 20 then return 'under20';
  elsif age_years < 30 then return '20s';
  elsif age_years < 40 then return '30s';
  elsif age_years < 50 then return '40s';
  else return 'over50';
  end if;
end;
$$;

-- 기간 고르기를 시작·끝 시각으로 바꾼다.
create or replace function public.crm_period_bounds(p jsonb)
returns table (from_ts timestamptz, to_ts timestamptz)
language sql stable as $$
  select
    case
      when p->>'kind' = 'range' then nullif(p->>'from', '')::timestamptz
      else now() - make_interval(days => coalesce((p->>'days')::int, 30))
    end,
    case
      when p->>'kind' = 'range' then nullif(p->>'to', '')::timestamptz + interval '1 day'
      else now()
    end;
$$;

-- 행동 조건 하나를 이 고객이 만족하는지.
create or replace function public.crm_matches_rule(c public.customers, r jsonb)
returns boolean
language plpgsql stable as $$
declare
  kind text := r->>'kind';
  lo   numeric;
  hi   numeric;
  hit  boolean;
  f    timestamptz;
  t    timestamptz;
begin
  if kind = 'purchased' then
    select b.from_ts, b.to_ts into f, t from public.crm_period_bounds(r->'period') b;
    hit := exists (
      select 1 from public.customer_orders o
      where o.member_code = c.member_code
        and o.ordered_at >= f and o.ordered_at < t
    );
    return hit = coalesce((r->>'has')::boolean, true);

  elsif kind = 'sinceLastPurchase' then
    if c.last_ordered_at is null then
      return false;
    end if;
    lo := nullif(r->>'minDays', '')::numeric;
    hi := nullif(r->>'maxDays', '')::numeric;
    return (lo is null or c.last_ordered_at <= now() - make_interval(days => lo::int))
       and (hi is null or c.last_ordered_at >  now() - make_interval(days => hi::int));

  elsif kind = 'orderCount' then
    lo := nullif(r->>'min', '')::numeric;
    hi := nullif(r->>'max', '')::numeric;
    return (lo is null or c.order_count >= lo) and (hi is null or c.order_count <= hi);

  elsif kind = 'totalSpent' then
    lo := nullif(r->>'min', '')::numeric;
    hi := nullif(r->>'max', '')::numeric;
    return (lo is null or c.total_spent >= lo) and (hi is null or c.total_spent <= hi);

  elsif kind = 'boughtProduct' then
    -- 고른 상품이 없으면 이 조건은 따지지 않는다
    if jsonb_array_length(coalesce(r->'prodNos', '[]'::jsonb)) = 0 then
      return true;
    end if;
    hit := c.prod_nos && array(select jsonb_array_elements_text(r->'prodNos'));
    return hit = coalesce((r->>'has')::boolean, true);

  elsif kind = 'couponUsed' then
    if coalesce(r->>'couponCode', '') = '' then
      hit := coalesce(array_length(c.coupon_codes, 1), 0) > 0;
    else
      hit := (r->>'couponCode') = any (c.coupon_codes);
    end if;
    return hit = coalesce((r->>'used')::boolean, true);

  end if;

  -- 아직 자료가 없는 조건(유입 경로 등)은 따지지 않고 넘어간다
  return true;
end;
$$;

create or replace function public.preview_customer_group(conditions jsonb, row_limit integer default 200)
returns jsonb
language plpgsql stable as $$
declare
  profile   jsonb  := coalesce(conditions->'profile', '{}'::jsonb);
  behaviors jsonb  := coalesce(conditions->'behaviors', '[]'::jsonb);
  agrees    text[] := array(select jsonb_array_elements_text(coalesce(profile->'marketingAgrees', '[]'::jsonb)));
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
      -- 마케팅 수신 동의. 비워 두면 따지지 않는다
      (cardinality(agrees) = 0 or (
        ('sms' = any (agrees) and c.marketing_agree_sms)
        or ('email' = any (agrees) and c.marketing_agree_email)
        or ('none' = any (agrees) and not c.marketing_agree_sms and not c.marketing_agree_email)
      ))
      and (cardinality(grades) = 0 or c.member_grade = any (grades))
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

grant execute on function public.preview_customer_group(jsonb, integer) to authenticated;
