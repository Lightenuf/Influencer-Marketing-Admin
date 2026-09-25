-- CRM 고객 그룹.
-- 명단이 아니라 '조건'을 저장한다. 볼 때마다 최신 자료로 다시 세기 위함이다.
-- (명단을 저장하면 하루만 지나도 실제와 어긋난다)

create table if not exists public.customer_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  conditions jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.customer_groups enable row level security;

drop policy if exists customer_groups_all on public.customer_groups;
create policy customer_groups_all on public.customer_groups
  for all to authenticated using (true) with check (true);

grant select, insert, update, delete on public.customer_groups to authenticated;

-- 고친 때를 자동으로 적어 둔다.
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists customer_groups_touch on public.customer_groups;
create trigger customer_groups_touch
before update on public.customer_groups
for each row execute function public.touch_updated_at();
