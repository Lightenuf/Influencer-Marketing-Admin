-- 보류 명단.
-- 거절(연락 금지)과 달리, 지금은 진행할 수 없지만 나중에 다시 얘기할 분들.
--   예) 일정이 안 맞음 · 공구를 해본 적이 없어 망설임
-- 단계(stage)는 그대로 두어, 복귀할 때 원래 자리로 돌아가게 한다.

alter table public.collabs add column if not exists is_on_hold boolean not null default false;
alter table public.collabs add column if not exists hold_reason text;
alter table public.collabs add column if not exists hold_detail text not null default '';
alter table public.collabs add column if not exists held_at timestamptz;
alter table public.collabs add column if not exists recontact_at date;

create index if not exists collabs_on_hold_idx on public.collabs (is_on_hold);
