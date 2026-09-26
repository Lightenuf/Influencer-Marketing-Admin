export const SNS_PLATFORMS = ['instagram', 'youtube', 'tiktok', 'blog', 'other'] as const
export type SnsPlatform = (typeof SNS_PLATFORMS)[number]

export const SNS_PLATFORM_LABELS: Record<SnsPlatform, string> = {
  instagram: '인스타그램',
  youtube: '유튜브',
  tiktok: '틱톡',
  blog: '블로그',
  other: '기타',
}

export const INFLUENCER_STATUSES = [
  '제안중',
  '협의중',
  '진행중',
  '완료',
  '취소',
  '재협업대상',
] as const
export type InfluencerStatus = (typeof INFLUENCER_STATUSES)[number]

export const REVENUE_BANDS = [
  '미확인',
  '~500만',
  '500~1,000만',
  '1,000~3,000만',
  '3,000~5,000만',
  '5,000만+',
] as const
export type RevenueBand = (typeof REVENUE_BANDS)[number]

export const CATEGORIES = [
  '뷰티',
  '푸드',
  '헬스/건강',
  '패션',
  '라이프스타일',
  '육아',
  '운동',
  '기타',
] as const

/** 처음 프로젝트를 시작할 때 채워 넣는 기본 사유. 이후에는 팀원이 태그를 직접 추가한다. */
export const DEFAULT_REASON_TAGS = [
  '단가 미합의',
  '일정 불가',
  '컨셉 불일치',
  '무응답',
  '본인 거절 의사',
  '협업 품질 이슈',
  '기타',
] as const

/**
 * 이 사유로 거절한 분은 시기가 맞으면 다시 제안해볼 수 있다.
 * 거절 명단에서 '추후 연락'으로 따로 모아, 연락 금지와 헷갈리지 않게 한다.
 */
export const LATER_CONTACT_REASONS: readonly string[] = ['일정 불가']

/** 마켓에 나가는 제품. 맛이 늘면 여기에 더한다. */
export const PRODUCTS = ['사과', '복숭아'] as const

/** 맛별 수량을 다 더한 값 */
export const totalUnits = (units: Record<string, number>) =>
  Object.values(units ?? {}).reduce((sum, count) => sum + (count || 0), 0)

/** 팀원이 직접 만들고 지우는 거절·연락 금지 사유 태그 */
export interface ReasonTag {
  id: string
  label: string
  createdBy: string | null
  createdAt: string
}

export const COLLAB_TYPES = ['마켓', '샘플', '유가광고'] as const
export type CollabType = (typeof COLLAB_TYPES)[number]

export const HOLD_REASONS = [
  '일정 불가',
  '공구 경험 없음',
  '단가 조율 필요',
  '제품은 좋으나 시기 안 맞음',
  '기타',
] as const
export type HoldReason = (typeof HOLD_REASONS)[number]

export const TEST_FEEDBACKS = ['긍정', '부정'] as const
export type TestFeedback = (typeof TEST_FEEDBACKS)[number]

export const COLLAB_STAGES = [
  '회신완료',
  '테스트중',
  '테스트 통과',
  '미팅 확정',
  '마켓 준비 중',
  '마켓 완료',
] as const
export type CollabStage = (typeof COLLAB_STAGES)[number]

export const SHIPMENT_STATUSES = ['배송준비중', '배송중', '완료', '취소요청', '취소'] as const
export type ShipmentStatus = (typeof SHIPMENT_STATUSES)[number]

export interface TeamMember {
  id: string
  email: string
  displayName: string
  role: 'admin' | 'member'
}

export interface Influencer {
  id: string
  name: string
  snsPlatform: SnsPlatform
  snsHandle: string
  snsUrl: string
  followerCount: number
  followingCount: number
  categories: string[]
  avgRevenueBand: RevenueBand
  contactEmail: string
  contactPhone: string
  contactEtc: string
  status: InfluencerStatus
  memo: string
  /**
   * 메시지를 보낸 날들(YYYY-MM-DD). 최근 발송일과 발송 횟수를 여기서 읽는다.
   * 같은 날 두 번 보냈으면 두 번 쌓인다.
   */
  contactedDates: string[]
  /** 조회 성능용 캐시값. 진실의 원천은 dncAuditLog 이다. */
  doNotContact: boolean
  dncReason: string | null
  dncSetBy: string | null
  dncSetAt: string | null
  createdBy: string
  createdAt: string
  updatedAt: string
}

export interface DncAuditEntry {
  id: string
  influencerId: string
  action: 'set' | 'unset'
  reason: string
  reasonDetail: string
  setBy: string
  setAt: string
}

export interface Collab {
  id: string
  influencerId: string
  title: string
  collabType: CollabType
  stage: CollabStage
  stageEnteredAt: string
  startDate: string | null
  endDate: string | null
  sampleShipDate: string | null
  contentDueDate: string | null
  fee: number
  /** 회신완료 — 씨딩(음료 받아보기) 수락 여부. null이면 아직 확인 전 */
  seedingAccepted: boolean | null
  /** 테스트중 — 음료를 받아본 반응 */
  testFeedback: TestFeedback | null
  /** 테스트중 — 미팅 수락 여부. 수락하면 '테스트 통과'로 넘어간다. null이면 아직 확인 전 */
  meetingAccepted: boolean | null
  /** (예전 '미팅 조율중'에서 쓰던 값 — 지금은 화면에서 쓰지 않는다) */
  lastContactedAt: string | null
  /** 미팅 확정 — 미팅 날짜 */
  meetingAt: string | null
  /** 마켓 준비 중 — 마켓 시작 예정일. 마켓을 마치면 실제 진행일이 된다. */
  marketDate: string | null
  /** 마켓 준비 중 — 마켓 종료 예정일 */
  marketEndDate: string | null
  /** 마켓 준비 중 — 이 마켓에서 내려는 매출(원). 끝나면 실제와 견준다. */
  targetRevenue: number
  /**
   * 마켓 준비 중 — 이 마켓에 나갈 것으로 보는 제품 수량(개).
   * 맛마다 따로 적는다. 늘어나는 맛은 PRODUCTS 에만 더하면 된다.
   */
  plannedUnits: Record<string, number>
  /** 마켓 완료 — 그 마켓으로 일으킨 매출(원) */
  marketRevenue: number
  /** 마켓 완료 — 판매 수량 */
  marketUnits: number
  /** 마켓 완료 — 정산까지 끝났는지 */
  isSettled: boolean
  /** 마켓 완료 — 크리에이터에게 준 정산액(수수료 포함, 원) */
  settlementAmount: number
  /** 잘 터진 콘텐츠 링크 모음 — 다음 협업 때 참고한다 */
  contentLinks: string[]
  /** 카드 메모 — 특이 요청사항처럼 이 사람과 일할 때 기억해야 할 것 */
  memo: string
  /** 같은 단계 안에서의 카드 순서. 작을수록 위. */
  sortOrder: number
  /** 보류 — 거절은 아니지만 지금은 진행할 수 없는 상태. 나중에 다시 연락한다. */
  isOnHold: boolean
  holdReason: HoldReason | null
  holdDetail: string
  heldAt: string | null
  /** 다시 연락하기로 한 날 */
  recontactAt: string | null
  isCancelled: boolean
  cancelReasons: string[]
  cancelReasonDetail: string
  cancelledAt: string | null
  createdAt: string
  updatedAt: string
}

export interface Shipment {
  id: string
  influencerId: string
  collabId: string | null
  status: ShipmentStatus
  collabType: CollabType
  productName: string
  quantity: number
  carrier: string
  trackingNumber: string
  requestedAt: string
  shippedAt: string | null
  deliveredAt: string | null
  createdAt: string
  updatedAt: string
}

export const DISCOVERY_STATUSES = ['대기', '진행중', '완료', '실패'] as const
export type DiscoveryStatus = (typeof DISCOVERY_STATUSES)[number]

/**
 * 발굴 요청 한 건. 어드민이 '대기'로 남겨두면 크롬 자동화가 집어가 처리하고
 * 결과(resultRaw)를 채워 '완료'로 바꾼다.
 */
export interface DiscoveryRequest {
  id: string
  keywords: string[]
  minFollowers: number
  wanted: number
  status: DiscoveryStatus
  /** 자동화가 돌려준 결과 원문 — 한 줄에 한 명 */
  resultRaw: string
  note: string
  requestedBy: string | null
  requestedAt: string
  finishedAt: string | null
}

export interface MessageTemplate {
  id: string
  name: string
  body: string
  sortOrder: number
  updatedBy: string | null
  updatedAt: string
  createdAt: string
}

export interface CommunicationLog {
  id: string
  influencerId: string
  authorId: string
  note: string
  loggedAt: string
}

/**
 * CRM — 고객 그룹.
 *
 * 명단을 저장하지 않고 '조건'만 저장한다. 볼 때마다 최신 자료로 다시 세므로,
 * 어제 만든 그룹도 오늘 기준으로 맞는 사람을 가리킨다.
 * 나중에 채널톡 발송을 붙일 때 이 그룹을 그대로 보낼 대상으로 쓴다.
 */

export const MARKETING_AGREES = ['sms', 'email', 'none'] as const
export type MarketingAgree = (typeof MARKETING_AGREES)[number]
export const MARKETING_AGREE_LABELS: Record<MarketingAgree, string> = {
  sms: 'SMS 수신 동의',
  email: '이메일 수신 동의',
  none: '동의 안 함',
}

export const GENDERS = ['M', 'F', 'unknown'] as const
export type GenderFilter = (typeof GENDERS)[number]
export const GENDER_LABELS: Record<GenderFilter, string> = {
  M: '남',
  F: '여',
  unknown: '미입력',
}

export const AGE_BANDS = ['under20', '20s', '30s', '40s', 'over50', 'unknown'] as const
export type AgeBand = (typeof AGE_BANDS)[number]
export const AGE_BAND_LABELS: Record<AgeBand, string> = {
  under20: '20대 미만',
  '20s': '20대',
  '30s': '30대',
  '40s': '40대',
  over50: '50대 이상',
  unknown: '미입력',
}

export const KAKAO_STATES = ['friend', 'not_friend', 'unknown'] as const
export type KakaoState = (typeof KAKAO_STATES)[number]
export const KAKAO_STATE_LABELS: Record<KakaoState, string> = {
  friend: '친구',
  not_friend: '친구 아님',
  unknown: '미확인',
}

/** 고객 정보로 거르는 조건 — 비워 두면 그 항목은 따지지 않는다 */
export interface ProfileFilter {
  marketingAgrees: MarketingAgree[]
  grades: string[]
  genders: GenderFilter[]
  ageBands: AgeBand[]
  joinedFrom: string | null
  joinedTo: string | null
  kakao: KakaoState | null
}

/** 기간을 고르는 방법 — 프리셋이거나, 직접 고른 날짜거나, 'N일 전부터 오늘까지' */
export interface PeriodPick {
  kind: 'preset' | 'range' | 'lastDays'
  /** preset: 7 · 14 · 30 */
  days?: number
  from?: string | null
  to?: string | null
}

export type BehaviorRule =
  /** 그 기간에 산 적이 있다 / 없다 */
  | { kind: 'purchased'; has: boolean; period: PeriodPick }
  /** 마지막 구매 후 며칠 지났는지 (min 이상 max 미만) */
  | { kind: 'sinceLastPurchase'; minDays: number | null; maxDays: number | null }
  /** 구매 횟수 */
  | { kind: 'orderCount'; min: number | null; max: number | null }
  /** 누적 구매 금액(원) */
  | { kind: 'totalSpent'; min: number | null; max: number | null }
  /** 특정 상품을 샀는지 */
  | { kind: 'boughtProduct'; prodNos: string[]; has: boolean }
  /** 쿠폰을 받고 썼는지 */
  | { kind: 'couponUsed'; couponCode: string | null; used: boolean }
  /** 첫 구매가 어디서 들어왔는지 (추천인 코드·UTM) */
  | { kind: 'firstChannel'; codes: string[] }

export interface GroupConditions {
  profile: ProfileFilter
  behaviors: BehaviorRule[]
}

export interface CustomerGroup {
  id: string
  name: string
  conditions: GroupConditions
  createdBy: string | null
  createdAt: string
  updatedAt: string
}

export type CustomerGroupInput = Pick<CustomerGroup, 'name' | 'conditions'>

export const emptyConditions = (): GroupConditions => ({
  profile: {
    marketingAgrees: [],
    grades: [],
    genders: [],
    ageBands: [],
    joinedFrom: null,
    joinedTo: null,
    kakao: null,
  },
  behaviors: [],
})

/** 목록에서 한 줄로 보여줄 조건 요약 */
export function summarizeConditions(conditions: GroupConditions): string {
  const parts: string[] = []
  const { profile, behaviors } = conditions

  if (profile.grades.length) parts.push(`등급 ${profile.grades.join('·')}`)
  if (profile.genders.length) parts.push(profile.genders.map((g) => GENDER_LABELS[g]).join('·'))
  if (profile.ageBands.length) parts.push(profile.ageBands.map((b) => AGE_BAND_LABELS[b]).join('·'))
  if (profile.joinedFrom || profile.joinedTo)
    parts.push(`가입 ${profile.joinedFrom ?? ''}~${profile.joinedTo ?? ''}`)
  if (profile.kakao) parts.push(`카카오 ${KAKAO_STATE_LABELS[profile.kakao]}`)

  for (const rule of behaviors) {
    if (rule.kind === 'purchased') parts.push(rule.has ? '기간 내 구매' : '기간 내 구매 없음')
    if (rule.kind === 'sinceLastPurchase')
      parts.push(`마지막 구매 ${rule.minDays ?? 0}~${rule.maxDays ?? '∞'}일 경과`)
    if (rule.kind === 'orderCount') parts.push(`구매 ${rule.min ?? 0}~${rule.max ?? '∞'}회`)
    if (rule.kind === 'totalSpent') parts.push('누적 구매액 조건')
    if (rule.kind === 'boughtProduct')
      parts.push(rule.has ? `상품 ${rule.prodNos.length}개 구매` : '해당 상품 미구매')
    if (rule.kind === 'couponUsed') parts.push(rule.used ? '쿠폰 사용' : '쿠폰 미사용')
    if (rule.kind === 'firstChannel') parts.push(`유입 ${rule.codes.join('·')}`)
  }

  return parts.length ? parts.join(' · ') : '조건 없음 (전체 고객)'
}

/** 조건에 맞는 고객 한 명 — 명단 화면에서 쓴다 */
export interface CustomerPreviewRow {
  memberCode: string
  name: string
  callnum: string
  email: string
  marketingAgreeSms: boolean
  memberGrade: string
  orderCount: number
  totalSpent: number
  /** 마지막 구매일 (YYYY-MM-DD). 산 적이 없으면 null */
  lastOrderedAt: string | null
}

export interface CustomerPreview {
  /** 조건에 맞는 전체 인원 */
  total: number
  /** 그중 SMS 수신동의 인원 */
  smsAgreed: number
  /** 화면에 보여줄 명단 (요청한 수만큼) */
  rows: CustomerPreviewRow[]
  /** 자료를 마지막으로 받아온 때. 없으면 아직 연결 전이다 */
  syncedAt: string | null
}

// ── 캠페인 (문자·브랜드 메시지) ──

export const CHANNELS = ['sms', 'brand_message'] as const
export type Channel = (typeof CHANNELS)[number]
export const CHANNEL_LABELS: Record<Channel, string> = {
  sms: '문자',
  brand_message: '브랜드 메시지',
}

/** 통로마다 고를 수 있는 메시지 유형이 다르다 */
export const MESSAGE_TYPES: Record<Channel, readonly string[]> = {
  sms: ['SMS', 'LMS', 'MMS'],
  brand_message: ['기본', '이미지', '와이드', '캐러셀'],
}

export const CAMPAIGN_STATUSES = ['draft', 'pending', 'sent', 'failed', 'canceled'] as const
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number]
export const CAMPAIGN_STATUS_LABELS: Record<CampaignStatus, string> = {
  draft: '임시저장',
  pending: '발송 대기',
  sent: '발송 완료',
  failed: '발송 실패',
  canceled: '발송 취소',
}

/** 어디서 들어온 기록인지 */
export const CAMPAIGN_SOURCES = ['admin_send', 'imweb_import', 'manual'] as const
export type CampaignSource = (typeof CAMPAIGN_SOURCES)[number]
export const CAMPAIGN_SOURCE_LABELS: Record<CampaignSource, string> = {
  admin_send: '어드민 발송',
  imweb_import: '아임웹 기록',
  manual: '직접 입력',
}

/** 목적·컨셉·오퍼 선택지 — 화면에서 늘릴 수 있다 */
export const OPTION_KINDS = ['purpose', 'concept', 'offer_type'] as const
export type OptionKind = (typeof OPTION_KINDS)[number]
export const OPTION_KIND_LABELS: Record<OptionKind, string> = {
  purpose: '목적',
  concept: '컨셉',
  offer_type: '오퍼 유형',
}

/** 처음 쓸 때 들어 있는 선택지. SQL의 것과 같아야 한다 — 화면에서 늘릴 수 있다. */
export const DEFAULT_CAMPAIGN_OPTIONS: { kind: OptionKind; label: string; sortOrder: number }[] = [
  { kind: 'purpose', label: '재구매 유도', sortOrder: 1 },
  { kind: 'purpose', label: '신규 첫 구매', sortOrder: 2 },
  { kind: 'purpose', label: '휴면 복귀', sortOrder: 3 },
  { kind: 'purpose', label: '신제품 알림', sortOrder: 4 },
  { kind: 'purpose', label: '관계 형성', sortOrder: 5 },
  { kind: 'purpose', label: '기타', sortOrder: 99 },
  { kind: 'concept', label: '할인', sortOrder: 1 },
  { kind: 'concept', label: '진정성 콘텐츠', sortOrder: 2 },
  { kind: 'concept', label: '제품 교육', sortOrder: 3 },
  { kind: 'concept', label: '후기', sortOrder: 4 },
  { kind: 'concept', label: '시즌', sortOrder: 5 },
  { kind: 'concept', label: '기타', sortOrder: 99 },
  { kind: 'offer_type', label: '없음', sortOrder: 1 },
  { kind: 'offer_type', label: '% 할인', sortOrder: 2 },
  { kind: 'offer_type', label: '금액 쿠폰', sortOrder: 3 },
  { kind: 'offer_type', label: '무료배송', sortOrder: 4 },
  { kind: 'offer_type', label: '증정', sortOrder: 5 },
]

export interface CampaignOption {
  id: string
  kind: OptionKind
  label: string
  sortOrder: number
}

export interface Campaign {
  id: string
  channel: Channel
  status: CampaignStatus
  sentAt: string | null
  messageType: string
  title: string

  targetCount: number
  successCount: number
  clickCount: number
  unsubscribeCount: number
  visitCount: number
  purchaseCount: number
  purchaseAmount: number
  costWon: number

  segmentId: string | null
  segmentName: string
  conditions: GroupConditions

  messageBody: string
  imageUrl: string
  isAd: boolean

  source: CampaignSource

  purpose: string
  concepts: string[]
  offerType: string
  offerValue: string
  hypothesis: string
  retrospective: string

  error: string
  createdAt: string
  updatedAt: string
}

/** 대상을 어떻게 정하나 */
export const TARGET_MODES = ['segment', 'numbers'] as const
export type TargetMode = (typeof TARGET_MODES)[number]
export const TARGET_MODE_LABELS: Record<TargetMode, string> = {
  segment: '고객군에게 발송',
  numbers: '번호 입력하여 발송',
}

/** 새로 보낼 캠페인 */
export interface CampaignSendInput {
  title: string
  messageBody: string
  channel: Channel
  messageType: string
  isAd: boolean
  targetMode: TargetMode
  segmentId: string | null
  segmentName: string
  conditions: GroupConditions
  /** 번호로 보낼 때만 쓴다 */
  numbers: string[]
  purpose: string
  concepts: string[]
  offerType: string
  offerValue: string
  hypothesis: string
  /** 참이면 보내지 않고 임시저장만 한다 */
  draftOnly?: boolean
}

/** 캠페인에서 나중에 고치는 것 — 사후 태깅과 성과 숫자 */
export interface CampaignPatch {
  title?: string
  purpose?: string
  concepts?: string[]
  offerType?: string
  offerValue?: string
  hypothesis?: string
  retrospective?: string
  status?: CampaignStatus
  sentAt?: string | null
  targetCount?: number
  successCount?: number
  clickCount?: number
  unsubscribeCount?: number
  visitCount?: number
  purchaseCount?: number
  purchaseAmount?: number
}

/** CSV로 올리는 예전 캠페인 한 줄 */
export interface CampaignImportRow {
  channel: Channel
  status: CampaignStatus
  sentAt: string | null
  messageType: string
  title: string
  targetCount: number
  successCount: number
  visitCount: number
  purchaseAmount: number
}

/** 구매 전환 — 받은 사람 중 정해진 날 안에 주문한 것 */
export interface CampaignConversion {
  purchaseCount: number
  purchaseAmount: number
  buyers: number
}

// ── 볼 때 계산하는 비율 ──
// 저장해 두면 원수가 고쳐졌을 때 비율만 옛날 값으로 남는다.

const ratio = (top: number, bottom: number) => (bottom > 0 ? top / bottom : 0)

export const successRate = (c: Campaign) => ratio(c.successCount, c.targetCount)
export const clickRate = (c: Campaign) => ratio(c.clickCount, c.successCount)
export const purchaseRate = (c: Campaign) => ratio(c.purchaseCount, c.successCount)
export const unsubscribeRate = (c: Campaign) => ratio(c.unsubscribeCount, c.successCount)
export const visitRate = (c: Campaign) => ratio(c.visitCount, c.successCount)

/** 목적·컨셉이 비어 있으면 나중에 비교할 수 없다 — 화면에서 짚어 준다 */
export const needsTagging = (c: Campaign) => !c.purpose || c.concepts.length === 0

// ── 문자 길이 ──

/** 문자 한 건에 담기는 바이트. 한글은 2바이트로 센다. */
export function messageBytes(text: string): number {
  let bytes = 0
  for (const ch of text) bytes += ch.charCodeAt(0) > 0x7f ? 2 : 1
  return bytes
}

export const SMS_BYTE_LIMIT = 90
export const LMS_BYTE_LIMIT = 2000

/** 90바이트를 넘으면 LMS로 바뀌고 요금이 오른다 */
export const smsKindOf = (text: string): string =>
  messageBytes(text) > SMS_BYTE_LIMIT ? 'LMS' : 'SMS'

/** 건당 요금(원). 발송사 단가가 바뀌면 여기만 고친다. */
export const UNIT_COST: Record<string, number> = {
  SMS: 20,
  LMS: 50,
  MMS: 100,
  brand_message: 15,
}

/**
 * 광고 문자에 법으로 붙여야 하는 것.
 * 앞에 (광고), 뒤에 무료 수신거부 번호. 빠지면 과태료 대상이라 사람이 잊지 않게 자동으로 붙인다.
 */
export const AD_PREFIX = '(광고) '
export const buildAdBody = (body: string, optoutNumber: string) =>
  `${AD_PREFIX}${body}\n무료수신거부 ${optoutNumber}`

// ── 전화번호 다루기 ──

/** 하이픈·공백을 떼고 숫자만 남긴다 */
export const onlyDigits = (text: string) => (text ?? '').replace(/[^0-9]/g, '')

/**
 * 문자를 보낼 수 있는 번호인지.
 * 휴대폰(01x)만 받는다 — 유선번호로는 문자가 가지 않는다.
 */
export const isSendableNumber = (text: string) => /^01[016789][0-9]{7,8}$/.test(onlyDigits(text))

/** 한 줄 안에 여러 번호가 띄어쓰기로 붙어 있을 때 찾아낸다 */
const PHONE_IN_TEXT = /01[016789][\s.-]?\d{3,4}[\s.-]?\d{4}/g

/**
 * 붙여넣은 덩어리에서 번호를 뽑는다.
 *
 * 줄바꿈·쉼표·탭으로 먼저 나눈다. 공백으로는 나누지 않는다 —
 * '010 2222 3333'처럼 띄어 쓴 번호 하나를 세 조각으로 쪼개면 안 되기 때문이다.
 * 한 조각이 번호 하나로 읽히지 않으면, 그 안에서 번호 모양을 찾아본다.
 */
export function parseNumbers(text: string): {
  valid: string[]
  invalid: string[]
  duplicates: number
} {
  const pieces = (text ?? '')
    .split(/[\n\r,;\t]+/)
    .map((piece) => piece.trim())
    .filter(Boolean)

  const valid: string[] = []
  const invalid: string[] = []
  const seen = new Set<string>()
  let duplicates = 0

  const take = (digits: string) => {
    if (seen.has(digits)) {
      duplicates++
      return
    }
    seen.add(digits)
    valid.push(digits)
  }

  for (const piece of pieces) {
    const digits = onlyDigits(piece)
    if (isSendableNumber(digits)) {
      take(digits)
      continue
    }

    // 한 줄에 번호를 여러 개 띄어 쓴 경우
    const found = piece.match(PHONE_IN_TEXT) ?? []
    if (found.length > 0) {
      for (const one of found) take(onlyDigits(one))
      continue
    }

    invalid.push(piece)
  }

  return { valid, invalid, duplicates }
}

/** 01012349778 → 010-1234-9778 */
export function formatPhone(text: string): string {
  const digits = onlyDigits(text)
  if (digits.length === 11) return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
  if (digits.length === 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`
  return text
}

// ── 발송 대상 ──

/** 보낼 수 있는 사람 한 명 — 이름과 번호만. 발송에 필요 없는 것은 받지 않는다. */
export interface SendTarget {
  memberCode: string
  name: string
  callnum: string
}

/**
 * 조건에 맞는 사람 중 실제로 보낼 수 있는 사람.
 * 번호가 없거나 수신거부한 분은 빠진다 — 왜 줄었는지 보이게 각각 센다.
 */
export interface SendTargets {
  total: number
  sendable: number
  noNumber: number
  optedOut: number
  rows: SendTarget[]
}

/** 수신거부한 사람 */
export interface CustomerOptout {
  callnum: string
  memberCode: string | null
  channel: string
  reason: string
  source: string
  optedOutAt: string
}

// ── 개인정보 가리기 ──
// 화면에도 로그에도 그대로 두지 않는다.

/** 한복순 → 한*순 */
export function maskName(name: string): string {
  if (!name) return '-'
  if (name.length === 1) return name
  if (name.length === 2) return `${name[0]}*`
  return `${name[0]}${'*'.repeat(name.length - 2)}${name[name.length - 1]}`
}

/** 010-1234-9778 → 010-****-9778 */
export function maskPhone(phone: string): string {
  const digits = (phone ?? '').replace(/[^0-9]/g, '')
  if (digits.length < 7) return phone || '-'
  return `${digits.slice(0, 3)}-****-${digits.slice(-4)}`
}

/** abcdef@domain.com → ab***@domain.com */
export function maskEmail(email: string): string {
  const [id, domain] = (email ?? '').split('@')
  if (!domain) return email || '-'
  return `${id.slice(0, 2)}***@${domain}`
}
