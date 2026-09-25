# Breevo 마케팅 허브 — 작업 안내

브리보(프로바이오틱스 드링크) 마케팅팀이 쓰는 사내 어드민이다.
공동구매 셀러 관리와 메타 광고 운영을 한 곳에서 한다.
쓰는 사람은 마케터다. **개발자가 아닌 사람이 읽고 쓸 화면**이라는 것을 늘 전제로 둔다.

## 무엇이 들어 있나

| 묶음 | 화면 |
|---|---|
| 인플루언서 마케팅 | 대시보드 · 셀러 발굴 · 셀러 리스트 · 협업 파이프라인 · 마켓 관리 · 거절 명단 |
| 퍼포먼스 마케팅 | 광고 대시보드 · 소재 성과 · 광고 관리 · 소재 업로드 |

협업은 파이프라인 단계로 흐른다.
`회신완료 → 테스트중 → 테스트 통과 → 미팅 확정 → 마켓 준비 중 → 마켓 완료`

## 기술 구성

- React 19 + Vite + TypeScript, Tailwind v4, React Router v7
- 서버 상태는 TanStack Query v5, 차트는 Recharts
- DB·로그인은 Supabase (Postgres + Auth + RLS)
- 배포는 GitHub Actions → GitHub Pages

## 데이터는 창구를 거쳐서만

화면은 `repository`(크리에이터 쪽)와 `metaRepository`(광고 쪽)만 안다.
그 뒤가 목업인지 실제인지 모른다.

```
src/data/
  repository.ts       화면이 쓰는 창구(계약)
  mockAdapter.ts      localStorage — 미리보기용
  supabaseAdapter.ts  실제 DB
  metaRepository.ts   광고 쪽 창구
  metaMockAdapter.ts  예시 광고 데이터
  metaApiAdapter.ts   Supabase Edge Function을 거쳐 메타 호출
```

- 화면에서 `localStorage`나 `supabase`를 직접 부르지 않는다
- 필드를 더하면 **목업·Supabase 양쪽 어댑터와 `demoData.ts`를 모두** 고쳐야 한다
- 메타 토큰은 Edge Function(`supabase/functions/meta-proxy`)만 쥔다. 브라우저로 내려보내지 않는다

## 일하는 순서

1. `npx tsc -b --noEmit` — 타입이 깨지지 않았는지
2. **미리보기 모드로 브라우저에서 직접 확인한다**

   ```bash
   VITE_SUPABASE_URL= VITE_SUPABASE_ANON_KEY= npm run dev -- --port 5199
   ```

   실 데이터를 건드리지 않고 화면을 눌러볼 수 있다.
3. 커밋 → 푸시 → 배포된 파일에 바뀐 글자가 들어갔는지 확인

고친 척하고 넘어가지 않는다. **화면에서 눌러 본 것만 됐다고 말한다.**

## DB를 고칠 때

새 칸이 필요하면 `supabase/migrations/` 에 번호를 이어 파일을 만들고,
**사람에게 SQL을 실행해 달라고 반드시 알린다.** 실행 전에는 저장이 실패한다.

- 실행 여부는 이렇게 확인할 수 있다 (없는 칸이면 42703, 있으면 권한 오류 42501)

  ```bash
  curl -s "$URL/rest/v1/collabs?select=새_칸&limit=1" -H "apikey: $KEY" -H "Authorization: Bearer $KEY"
  ```

- 저장이 실패하면 화면 위에 붉은 띠가 뜬다(`SaveErrorBanner`). 조용히 넘어가지 않는다

## 글쓰기

화면 글자, 커밋 메시지, 주석, 문서 모두 **한국어**로 쓴다.

- 마케터가 읽는다. `stage`, `mutation` 같은 말 대신 `단계`, `저장`처럼 쓴다
- 주석은 **왜 그렇게 했는지**를 적는다. 코드를 다시 설명하지 않는다
- 커밋 메시지는 무엇을 왜 바꿨는지 한국어로 적는다

## 조심할 것

- **키는 저장소에 두지 않는다.** `.env.local`은 커밋하지 않고, service_role 키는 프론트에 절대 넣지 않는다
- **고객 정보를 콘솔이나 커밋에 남기지 않는다.** 예시가 필요하면 가린다 (`한*순`, `010-****-9778`)
- **광고 관리와 소재 업로드는 실제 돈이 걸린다.** 새로 만드는 광고는 항상 일시중지 상태로 두고,
  예산을 고칠 때는 누가 함께 영향을 받는지 먼저 알린다
- 메타에서 예산은 광고가 아니라 광고 세트(또는 CBO 캠페인)에 붙는다

## 더 읽을 것

- `docs/메타-광고-연동-준비.md` — 광고 연동 구조, 토큰 설정, 확정된 기본값
- `docs/구글-로그인-설정.md` — 회사 계정 로그인 설정 절차
- `docs/발굴-자동화-지시문.md` — 셀러 발굴을 크롬 자동화로 돌리는 방법
