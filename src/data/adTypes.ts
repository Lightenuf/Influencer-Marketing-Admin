/**
 * 퍼포먼스 마케팅 태그·운영 기준.
 *
 * 메타에 있는 광고 이름은 건드리지 않는다. 태그는 ad_id 에 붙여 여기에 둔다.
 */

/** 태그 차원 — 설정 > 태그 사전에서 선택지를 늘린다 */
export const TAG_DIMENSIONS = ['source', 'format', 'angle', 'hook', 'segment', 'offer'] as const
export type TagDimension = (typeof TAG_DIMENSIONS)[number]

export const TAG_DIMENSION_LABELS: Record<TagDimension, string> = {
  source: '제작 출처',
  format: '포맷',
  angle: '앵글',
  hook: '훅',
  segment: '세그먼트',
  offer: '오퍼',
}

export interface TagOption {
  id: string
  dimension: TagDimension
  label: string
  sortOrder: number
  active: boolean
}

/** 옛 이름의 토막을 태그로 옮기는 사전 */
export interface NameAlias {
  id: string
  dimension: string
  token: string
  label: string
}

/** 이름에서 읽어낸 태그 후보 — 아직 저장 전이다 */
export interface AdTagDraft {
  source: string
  format: string
  angle: string
  hook: string
  segment: string
  offer: string
  /** UGC일 때 크리에이터로 보이는 토막. 사람이 확인해서 셀러와 잇는다 */
  creatorHint: string
  /** YYMMDD */
  date: string
}

/** 저장된 광고 태그 */
export interface AdTags {
  adId: string
  accountId: string
  creativeKey: string
  source: string
  format: string
  angle: string
  hook: string
  segment: string
  offer: string
  landing: string
  creatorId: string | null
  assetId: string | null
  copyId: string | null
  templateId: string | null
  experimentId: string | null
  /** parser(이름에서 읽음) · manual(사람이 붙임) */
  taggedFrom: string
  updatedAt: string
}

export type AdTagsInput = Partial<Omit<AdTags, 'adId' | 'updatedAt'>>

/** 5-5 운영 기준 */
export interface OpsSettings {
  breakEvenRoas: number
  /** firstPurchase(첫 구매 기준) · ltv(LTV 보정) */
  roasBasis: 'firstPurchase' | 'ltv'
  repurchaseRate: number
  repurchaseDays: number
  /** auto(최근 30일 매출 ÷ 전환) · manual */
  aovMode: 'auto' | 'manual'
  aovManual: number
  judgeDays: number
  /** 판단 최소 지출 = 손익분기 CPA × 이 값 */
  minSpendMultiplier: number
  increaseStep: number
  increaseIntervalDays: number
  decreaseStep: number
  /** 하루 누적 예산 증가율 상한 */
  dailyIncreaseCap: number
  testAdSetIds: string[]
  /** 목록 기본 필터를 '기간 내 지출 > 0'으로 둘지 (5-6) */
  spentOnlyByDefault: boolean

  /**
   * 메타가 잡는 매출은 실제 자사몰 매출보다 적게 나온다.
   * 개별 광고는 메타 숫자로만 판단할 수 있으므로, 손익분기를 그만큼 낮춰 잡는다.
   * 1이면 보정하지 않는다.
   */
  metaAttributionFactor: number
  /** 한 번에 이 금액 이상 올리면 승인을 받는다 */
  approvalAmountWon: number
  approverIds: string[]
  /** 세트에 켜진 광고가 이보다 적으면 '소재 부족' */
  minAdsPerAdSet: number
  /** 실행 뒤 며칠 있다가 결과를 재는지 */
  measureAfterDays: number

  // ── 공구 기간 운영 ──
  /** 공구 중에 유지할 최소 일예산 */
  marketFloorWon: number
  /** 공구 시작 며칠 전부터 예산을 줄일지 */
  marketPrepDays: number
  /** 공구가 끝난 뒤 며칠 동안 '올릴 때'로 볼지 */
  marketBoostDays: number

  // ── 카피 자동 검수 (8-4) ──
  /** 식품표시광고법에 걸리는 표현. 설정에서 늘린다 */
  bannedWords: string[]
  /** 식이섬유는 이 수치로만 적을 수 있다 */
  fiberGram: number
  headlineMaxChars: number
  subheadMaxChars: number
  bodyMaxChars: number
  /** 한 번에 만들 수 있는 조합 수 */
  maxCombos: number
  /** 카피를 만들 때 넘기는 브랜드 사실 */
  brandFacts: string

  // ── 슬랙 알림 (⚙️ 설정 > 알림) ──
  notifyAlerts: boolean
  notifyDaily: boolean
  notifyWeekly: boolean
  notifyApproval: boolean
}

export const DEFAULT_OPS: OpsSettings = {
  breakEvenRoas: 2.15,
  roasBasis: 'firstPurchase',
  repurchaseRate: 0.19,
  repurchaseDays: 40,
  aovMode: 'auto',
  aovManual: 0,
  judgeDays: 7,
  minSpendMultiplier: 2,
  increaseStep: 0.2,
  increaseIntervalDays: 3,
  decreaseStep: 0.2,
  dailyIncreaseCap: 0.3,
  testAdSetIds: [],
  spentOnlyByDefault: true,
  metaAttributionFactor: 1,
  approvalAmountWon: 100_000,
  approverIds: [],
  minAdsPerAdSet: 3,
  measureAfterDays: 7,
  marketFloorWon: 20_000,
  marketPrepDays: 2,
  marketBoostDays: 7,
  // SQL(0036)의 초깃값과 같아야 한다
  bannedWords: [
    '변비 개선',
    '변비 해소',
    '살 빠지',
    '체지방 감소',
    '디톡스',
    '면역력',
    '혈당 조절',
    '화학원료 무첨가',
    '질병',
    '치료',
    '예방',
    '효능',
    '독소 배출',
    '붓기 제거',
    '숙변',
  ],
  fiberGram: 4,
  headlineMaxChars: 18,
  subheadMaxChars: 30,
  bodyMaxChars: 125,
  maxCombos: 30,
  notifyAlerts: true,
  notifyDaily: true,
  notifyWeekly: true,
  notifyApproval: true,
  brandFacts:
    '브리보: 카페인 프리, 저당, 식물성 프리바이오틱 탄산음료, 355ml 캔, 사과·복숭아.\n식물 유래 원료만 사용. 합성감미료(아스파탐·수크랄로스·에리스리톨) 미사용.\n식이섬유 표기는 4g만 허용.\n톤: 제로/프리프럼이 아닌 더하는 식품(+플러스), 원료·원가 투명성, 맛있어서 매일 마시는 음료. 다이어트 제품처럼 보이지 않게.',
}

/**
 * 객단가 → 손익분기 CPA → 판단 최소 지출.
 * 셋이 이어져 있어 한 군데서 낸다. 화면마다 다시 계산하면 값이 어긋난다.
 */
export function derivedOps(ops: OpsSettings, revenue30d: number, results30d: number) {
  const aov =
    ops.aovMode === 'manual'
      ? ops.aovManual
      : results30d > 0
        ? Math.round(revenue30d / results30d)
        : 0

  // LTV 보정을 켜면 한 명이 재구매까지 가져다주는 값을 얹어 본다
  const ltvAdjusted =
    ops.roasBasis === 'ltv' ? ops.breakEvenRoas / (1 + ops.repurchaseRate) : ops.breakEvenRoas

  // 메타 집계 보정 — 개별 광고를 메타 숫자로 판단할 때 쓰는 손익분기
  const effectiveRoas = ltvAdjusted * (ops.metaAttributionFactor || 1)

  const breakEvenCpa = effectiveRoas > 0 ? Math.round(aov / effectiveRoas) : 0
  const minSpend = Math.round(breakEvenCpa * ops.minSpendMultiplier)

  return { aov, effectiveRoas, breakEvenCpa, minSpend }
}

/** 5-2 상태 배지 — 판단 기준은 전부 운영 기준에서 읽는다 */
export type AdBadge = 'noData' | 'aboveBreakEven' | 'belowBreakEven' | 'fatigue'

export const AD_BADGE_LABELS: Record<AdBadge, string> = {
  noData: '데이터 부족',
  aboveBreakEven: '손익분기 이상',
  belowBreakEven: '손익분기 미만',
  fatigue: '피로도 의심',
}

export function badgeOf(spend: number, roas: number, minSpend: number, breakEven: number): AdBadge {
  if (spend < minSpend) return 'noData'
  return roas >= breakEven ? 'aboveBreakEven' : 'belowBreakEven'
}

/** 광고 계정 — 두 개를 오간다 (원칙 10) */
export interface AdAccount {
  id: string
  name: string
}
