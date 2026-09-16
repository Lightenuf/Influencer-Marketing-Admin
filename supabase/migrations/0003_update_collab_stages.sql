-- 협업 파이프라인 단계를 실제 업무 흐름 5단계로 교체한다.
--   (구) 요청 · 협의중 · 진행중 · 종료
--   (신) 회신완료 · 테스트중 · 미팅 조율중 · 미팅 확정 · 마켓 대기중
--
-- '종료' 칸이 없어졌으므로, 취소된 건은 단계를 옮기지 않고
-- is_cancelled 플래그로만 구분해 보드에서 숨긴다.

alter table public.collabs alter column stage set default '회신완료';

update public.collabs set stage = '회신완료'   where stage = '요청';
update public.collabs set stage = '테스트중'   where stage = '협의중';
update public.collabs set stage = '미팅 확정'  where stage = '진행중';
update public.collabs set stage = '마켓 대기중' where stage = '종료';
