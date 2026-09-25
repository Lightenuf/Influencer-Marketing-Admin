-- 아임웹에서 받아 온 고객 자료.
-- 어드민이 직접 아임웹을 부르지 않고 여기를 본다. 아임웹은 호출 제한이 빡빡하고,
-- 조건으로 고객을 세려면 자료가 한곳에 모여 있어야 하기 때문이다.
--
-- 회원(m...)뿐 아니라 비회원 주문자(gu...)도 담는다.
-- 주문의 4분의 3이 비회원이라, 빼 두면 실제 고객 대부분이 보이지 않는다.

create table if not exists public.customers (
  member_code text primary key,
  is_member boolean not null default true,
  name text not null default '',
  callnum text not null default '',
  email text not null default '',
  gender text not null default '',
  birth text not null default '',
  member_grade text not null default '',
  marketing_agree_sms boolean not null default false,
  marketing_agree_email boolean not null default false,
  joined_at timestamptz,
  point_amount bigint not null default 0,
  -- 주문에서 미리 계산해 둔다. 볼 때마다 2천 건을 다시 더하지 않기 위함이다
  order_count integer not null default 0,
  total_spent bigint not null default 0,
  first_ordered_at timestamptz,
  last_ordered_at timestamptz,
  prod_nos text[] not null default '{}',
  coupon_codes text[] not null default '{}',
  synced_at timestamptz not null default now()
);

create index if not exists customers_last_ordered_idx on public.customers (last_ordered_at desc);
create index if not exists customers_grade_idx on public.customers (member_grade);

-- '그 기간에 샀는지'를 따지려면 주문 하나하나의 날짜가 필요하다.
create table if not exists public.customer_orders (
  order_no text primary key,
  member_code text not null,
  ordered_at timestamptz,
  amount bigint not null default 0,
  synced_at timestamptz not null default now()
);

create index if not exists customer_orders_member_idx on public.customer_orders (member_code, ordered_at desc);

alter table public.customers enable row level security;
alter table public.customer_orders enable row level security;

drop policy if exists customers_all on public.customers;
create policy customers_all on public.customers
  for all to authenticated using (true) with check (true);

drop policy if exists customer_orders_all on public.customer_orders;
create policy customer_orders_all on public.customer_orders
  for all to authenticated using (true) with check (true);

grant select, insert, update, delete on public.customers to authenticated;
grant select, insert, update, delete on public.customer_orders to authenticated;
