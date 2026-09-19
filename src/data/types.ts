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
  '마켓 대기중',
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
  /** 마켓 대기중 — 마켓 여는 날짜 */
  marketDate: string | null
  /** 마켓 완료 — 그 마켓으로 일으킨 매출(원) */
  marketRevenue: number
  /** 마켓 완료 — 판매 수량 */
  marketUnits: number
  /** 마켓 완료 — 정산까지 끝났는지 */
  isSettled: boolean
  /** 잘 터진 콘텐츠 링크 모음 — 다음 협업 때 참고한다 */
  contentLinks: string[]
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

export interface CommunicationLog {
  id: string
  influencerId: string
  authorId: string
  note: string
  loggedAt: string
}
