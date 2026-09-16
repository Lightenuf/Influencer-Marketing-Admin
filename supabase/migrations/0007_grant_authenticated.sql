-- 로그인한 팀원(authenticated)에게 테이블 접근 권한을 부여한다.
--
-- 0001에서 RLS 정책은 만들었지만 GRANT가 빠져 있어, 로그인해도
--   "permission denied for table collabs" (42501)
-- 로 막혔다. RLS는 "들어와서 무엇을 할 수 있는지"를 정하고,
-- GRANT는 "테이블에 접근할 자격이 있는지"를 정한다. 둘 다 필요하다.
--
-- 실제 행 단위 제어는 0001의 RLS 정책이 계속 담당한다.

grant usage on schema public to authenticated;

grant select, insert, update, delete on
  public.influencers,
  public.collabs,
  public.shipments,
  public.communication_logs
to authenticated;

-- 프로필은 조회와 본인 수정만 (0001 정책과 맞춤)
grant select, update on public.profiles to authenticated;

-- 연락 금지 이력은 위변조 방지를 위해 조회·추가만. 수정·삭제 불가.
grant select, insert on public.dnc_audit_log to authenticated;

grant usage, select on all sequences in schema public to authenticated;
