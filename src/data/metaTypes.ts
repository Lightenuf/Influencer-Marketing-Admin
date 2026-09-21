/**
 * 메타(Facebook·Instagram) 광고 도메인.
 *
 * 메타 구조를 그대로 따른다 — 캠페인 > 광고 세트 > 광고.
 * 예산은 광고에 없고 광고 세트(또는 캠페인 예산 최적화면 캠페인)에 붙는다.
 */

export const META_LEVELS = ['account', 'campaign', 'adset', 'ad'] as const
export type MetaLevel = (typeof META_LEVELS)[number]

export const META_LEVEL_LABELS: Record<MetaLevel, string> = {
  account: '계정 전체',
  campaign: '캠페인',
  adset: '광고 세트',
  ad: '광고',
}

/** 메타가 쓰는 값 그대로 — 켜짐 / 일시중지 */
export type MetaStatus = 'ACTIVE' | 'PAUSED'

export interface MetaCampaign {
  id: string
  name: string
  status: MetaStatus
  /** 오브젝티브 (예: OUTCOME_SALES) */
  objective: string
  /** 캠페인 예산 최적화(CBO)면 예산이 캠페인에 붙는다 */
  isCbo: boolean
  /** 원 단위. CBO가 아니면 null */
  dailyBudget: number | null
  lifetimeBudget: number | null
}

export interface MetaAdSet {
  id: string
  campaignId: string
  name: string
  status: MetaStatus
  /** 원 단위. 캠페인이 CBO면 null */
  dailyBudget: number | null
  lifetimeBudget: number | null
  /** 일정 — 광고 세트 단위로만 있다 */
  startDate: string
  endDate: string | null
}

export interface MetaAd {
  id: string
  adsetId: string
  name: string
  status: MetaStatus
  /** 표준 크리에이티브만 쓴다. 카탈로그(DPA)는 만들지 않는다. */
  creativeType: 'image' | 'video'
  thumbnailUrl: string | null
  /** 파트너십 광고(구 브랜디드 콘텐츠)로 돌고 있는지 */
  isPartnership: boolean
  createdAt: string
}

/**
 * 한 노드의 기간 집계.
 * 메타 insights 응답에서 필요한 값만 추린 모양이다.
 */
export interface MetaInsight {
  level: Exclude<MetaLevel, 'account'>
  /** 캠페인·광고 세트·광고 중 하나의 id */
  id: string
  /** 광고비 (원) */
  spend: number
  /** 전환 값 = 매출 (원) */
  revenue: number
  /** 결과 수 (구매 등 목표 이벤트) */
  results: number
  reach: number
  impressions: number
  linkClicks: number
}

/** 추세선 한 점 — 광고 하나의 한 주 */
export interface MetaWeekPoint {
  adId: string
  /** 그 주의 월요일 (YYYY-MM-DD) */
  weekStart: string
  roas: number
  spend: number
  revenue: number
}

/** 나눗셈은 한 곳에서만 — 0으로 나누는 실수를 막는다 */
export const metaRoas = (insight: { revenue: number; spend: number }) =>
  insight.spend > 0 ? insight.revenue / insight.spend : 0
export const metaCpc = (insight: { spend: number; linkClicks: number }) =>
  insight.linkClicks > 0 ? insight.spend / insight.linkClicks : 0
export const metaCtr = (insight: { linkClicks: number; impressions: number }) =>
  insight.impressions > 0 ? (insight.linkClicks / insight.impressions) * 100 : 0
/** 전환율 = 결과 / 링크 클릭 */
export const metaConversionRate = (insight: { results: number; linkClicks: number }) =>
  insight.linkClicks > 0 ? (insight.results / insight.linkClicks) * 100 : 0
export const metaCostPerResult = (insight: { spend: number; results: number }) =>
  insight.results > 0 ? insight.spend / insight.results : 0

/** 여러 노드의 집계를 하나로 합친다 (계정 전체·상위 노드 값) */
export function sumInsights(list: MetaInsight[]): Omit<MetaInsight, 'level' | 'id'> {
  return list.reduce(
    (sum, item) => ({
      spend: sum.spend + item.spend,
      revenue: sum.revenue + item.revenue,
      results: sum.results + item.results,
      // 도달은 사람 수라 더하면 중복이 생긴다. 참고값으로만 쓴다.
      reach: sum.reach + item.reach,
      impressions: sum.impressions + item.impressions,
      linkClicks: sum.linkClicks + item.linkClicks,
    }),
    { spend: 0, revenue: 0, results: 0, reach: 0, impressions: 0, linkClicks: 0 },
  )
}

/**
 * 캠페인 목표.
 * 기본은 판매다 — 성과를 ROAS로 보기 때문. 다만 트래픽·참여로 돌릴 때도 있어 고를 수 있게 둔다.
 */
export const META_OBJECTIVES = [
  {
    value: 'OUTCOME_SALES',
    label: '판매',
    hint: '결제할 사람을 찾는다',
    /** 판매만 전환 이벤트(구매 등)를 정해야 한다 */
    needsConversionEvent: true,
  },
  {
    value: 'OUTCOME_TRAFFIC',
    label: '트래픽',
    hint: '링크를 누를 사람을 찾는다',
    needsConversionEvent: false,
  },
  {
    value: 'OUTCOME_ENGAGEMENT',
    label: '참여',
    hint: '좋아요·댓글·메시지를 남길 사람을 찾는다',
    needsConversionEvent: false,
  },
] as const

export type MetaObjective = (typeof META_OBJECTIVES)[number]['value']

/** 새 캠페인을 만들 때 미리 골라두는 값 */
export const DEFAULT_OBJECTIVE: MetaObjective = 'OUTCOME_SALES'

/** 목표에 따라 어울리는 버튼이 다르다. 업로드 화면에서 이 값으로 시작하고 바꿀 수 있게 한다. */
export const DEFAULT_CTA: Record<MetaObjective, { value: string; label: string }> = {
  OUTCOME_SALES: { value: 'SHOP_NOW', label: '지금 구매하기' },
  OUTCOME_TRAFFIC: { value: 'LEARN_MORE', label: '더 알아보기' },
  OUTCOME_ENGAGEMENT: { value: 'LEARN_MORE', label: '더 알아보기' },
}
