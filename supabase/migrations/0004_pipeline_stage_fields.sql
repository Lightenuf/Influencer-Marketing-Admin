-- 파이프라인 단계별로 기록하는 값들.
--   테스트중     → test_feedback (음료 반응)
--   미팅 조율중  → last_contacted_at (마지막 연락일)
--   미팅 확정    → meeting_at (미팅 날짜)
--   마켓 대기중  → market_date (마켓 여는 날짜)
-- '회신완료' 날짜는 카드가 만들어진 날(created_at)을 그대로 쓴다.

alter table public.collabs add column if not exists test_feedback text;
alter table public.collabs add column if not exists last_contacted_at date;
alter table public.collabs add column if not exists meeting_at date;
alter table public.collabs add column if not exists market_date date;
