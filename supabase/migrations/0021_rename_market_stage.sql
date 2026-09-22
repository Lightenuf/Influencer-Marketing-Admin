-- '마켓 대기중'을 '마켓 준비 중'으로 바꾼다.
-- 기다리는 것이 아니라 준비하는 단계라, 하는 일에 맞는 이름으로 옮긴다.

update public.collabs
   set stage = '마켓 준비 중'
 where stage = '마켓 대기중';
