-- 컨택 리스트에서 '메시지를 보낸 날'을 기록한다.
-- 날짜를 쌓아두고, 최근 발송일은 마지막 값 · 발송 횟수는 개수로 읽는다.
-- (같은 날 두 번 보냈으면 같은 날짜가 두 번 들어간다)

alter table public.influencers
  add column if not exists contacted_dates text[] not null default '{}';
