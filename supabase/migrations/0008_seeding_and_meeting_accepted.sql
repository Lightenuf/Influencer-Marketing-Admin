-- 회신완료 · 테스트중 단계에서 확인하는 수락 여부.
--   회신완료   → seeding_accepted (씨딩 수락 여부). 수락하면 sample_ship_date 에 배송 날짜를 넣는다.
--   테스트중   → meeting_accepted (미팅 수락 여부). 수락하면 '미팅 조율중'으로 넘어간다.
-- null = 아직 확인 전, true = 수락, false = 거절.
-- 거절이어도 자동으로 취소하지 않는다 — 카드에 표시만 하고 취소·보류는 담당자가 고른다.

alter table public.collabs add column if not exists seeding_accepted boolean;
alter table public.collabs add column if not exists meeting_accepted boolean;
