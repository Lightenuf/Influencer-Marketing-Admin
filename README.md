# 인플루언서 관리 어드민 (Influencer Marketing Admin)

Breevo 마케팅팀이 인플루언서 협업 관계를 직접 관리하기 위한 사내 어드민입니다.
ZVZO 같은 외부 플랫폼이 보여주지 못하는 **자사 기준의 크리에이터 현황**과,
**취소·거절 의사를 밝힌 크리에이터에게 다시 제안이 나가지 않도록 막는 연락 금지 관리**가 핵심입니다.

## 주요 기능

| 화면 | 내용 |
|---|---|
| 대시보드 | 전체 인원, 연락 금지 수, 진행중 협업, 취소율, 샘플→협업 전환율, 15일 이상 정체된 협업 알림 |
| 인플루언서 | 검색·필터(상태/플랫폼/카테고리/연락 가능 여부), 등록·수정, 엑셀(CSV) 다운로드 |
| 인플루언서 상세 | 프로필, 협업 이력, 출고 내역, 커뮤니케이션 기록, 연락 금지 이력 |
| 협업 파이프라인 | 요청 → 협의중 → 진행중 → 종료 칸반, 단계 체류일수, 취소 시 연락 금지 연동 |
| **연락 금지 관리** | 사유·담당자·일시 기록, 해제, **발송 전 명단 대조**(붙여넣기로 금지 대상 검출) |
| 출고 관리 | 샘플·마켓 상품 발송 상태, 송장 관리 |
| 캘린더 | 협업 기간·샘플 발송일·콘텐츠 마감일 월간 뷰 |

### 연락 금지(Do-Not-Contact) 동작 방식

- 등록·해제 모두 **사유와 담당자가 감사 로그에 영구 기록**됩니다. 기록은 수정·삭제되지 않습니다.
- 인플루언서 목록에서 `연락 가능만 보기`로 거른 뒤 엑셀을 내려받으면 그대로 발송 대상 명단이 됩니다.
- 보낼 명단을 `연락 금지 관리` 화면에 붙여넣으면 금지 대상이 섞였는지 즉시 확인할 수 있습니다.
- 협업을 취소 처리할 때 "연락 금지로 함께 등록" 옵션을 제공합니다.

## 실행 방법

```bash
npm install
npm run dev
```

http://localhost:5173 접속 → 팀원을 선택해 로그인 → 빈 화면에서 시작하거나 `예시 데이터 넣기`로 둘러보기.

## 현재 상태: 미리보기(목업) 모드

지금은 데이터가 **브라우저 localStorage에만** 저장됩니다. 기기·브라우저가 바뀌면 데이터가 보이지 않고,
팀원 간 공유도 되지 않습니다. 화면과 업무 흐름을 먼저 확정하기 위한 단계입니다.

## Supabase 연결 (다음 단계)

모든 데이터 접근은 `src/data/repository.ts`의 `DataRepository` 인터페이스 뒤에 숨겨져 있어,
어댑터만 교체하면 화면 코드 수정 없이 실제 DB로 전환됩니다.

1. [supabase.com](https://supabase.com)에서 프로젝트 생성
2. 테이블 생성 (마이그레이션 SQL은 연결 단계에서 `supabase/migrations/`에 추가 예정)
   - `profiles`, `influencers`, `dnc_audit_log`, `collabs`, `shipments`, `communication_logs`
3. `.env.local` 작성 (`.env.example` 참고)
   ```
   VITE_SUPABASE_URL=...
   VITE_SUPABASE_ANON_KEY=...
   ```
4. `src/data/supabaseAdapter.ts` 구현 후 `src/data/index.ts`에서 어댑터 분기
5. Supabase Auth에서 **public signup 비활성화**, 팀원은 관리자 초대로만 추가
6. RLS 정책: 로그인한 팀원은 전체 조회/수정 가능, `dnc_audit_log`는 INSERT·SELECT만 허용(이력 위변조 방지)

> `service_role` 키는 절대 프론트엔드나 저장소에 넣지 않습니다.

## 기술 스택

React 19 · Vite · TypeScript · Tailwind CSS v4 · React Router · TanStack Query · React Hook Form + Zod · Recharts

## 폴더 구조

```
src/
  data/          # 도메인 타입과 데이터 어댑터 (여기만 바꾸면 백엔드 교체 가능)
  auth/          # 로그인·세션·라우트 보호
  hooks/         # react-query 훅
  components/    # 공통 UI, 레이아웃, 배지
  features/
    dashboard/ influencers/ dnc/ pipeline/ shipments/ calendar/ communication/
  utils/         # 날짜·숫자 포맷, CSV 내보내기
```
