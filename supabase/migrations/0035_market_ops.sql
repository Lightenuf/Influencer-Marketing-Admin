-- 공구 기간 광고 운영 기준.
--
-- 공구 기간에는 셀러가 자기 채널로 매출을 만든다. 그때 광고비를 겹쳐 태우면
-- 어차피 살 사람에게 두 번 돈을 쓰는 셈이 된다. 최소로 줄였다가,
-- 공구가 끝나면 그때 만들어진 영상을 파트너십 광고로 돌리며 다시 올린다.
--
-- 공구 일정은 협업 파이프라인(collabs.market_date / market_end_date)에 이미 있다.
-- 따로 적지 않고 그것을 읽는다.

insert into public.ops_settings (key, value) values
  ('marketFloorWon', '20000'),
  ('marketPrepDays', '2'),
  ('marketBoostDays', '7')
on conflict (key) do nothing;
