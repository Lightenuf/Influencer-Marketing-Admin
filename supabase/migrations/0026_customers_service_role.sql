-- 자료를 옮기는 스크립트(service_role)가 쓸 수 있게 권한을 준다.
-- 0024에서 로그인한 팀원에게만 줬더니, 맥에서 도는 스크립트가 막혔다.

grant select, insert, update, delete on public.customers to service_role;
grant select, insert, update, delete on public.customer_orders to service_role;
