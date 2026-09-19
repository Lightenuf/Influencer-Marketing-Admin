-- 파이프라인 단계 이름 변경: '미팅 조율중' → '테스트 통과'
-- 테스트를 통과한 사람을 한 칸에 모아 단계별 지표를 보기 위함.
-- 이미 저장된 카드가 어느 칸에도 안 나타나는 일이 없도록 기존 기록을 옮긴다.

update public.collabs set stage = '테스트 통과' where stage = '미팅 조율중';

alter table public.collabs alter column stage set default '회신완료';
