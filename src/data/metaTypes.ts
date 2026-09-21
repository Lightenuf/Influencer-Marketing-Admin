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

/**
 * 광고 버튼(CTA).
 *
 * 문구를 마음대로 쓸 수 없다 — 메타가 정해둔 값 중에서만 고를 수 있고,
 * 실제로 보이는 글자는 메타가 사용자 언어에 맞춰 알아서 넣는다.
 * 그래서 '직접 추가'는 이 목록에서 골라 즐겨찾기에 얹는 방식이 된다.
 */
export const META_CTAS = [
  { value: 'SHOP_NOW', label: '지금 구매하기' },
  { value: 'APPLY_NOW', label: '지금 신청하기' },
  { value: 'LEARN_MORE', label: '더 알아보기' },
  { value: 'ORDER_NOW', label: '지금 주문하기' },
  { value: 'SIGN_UP', label: '가입하기' },
  { value: 'SUBSCRIBE', label: '구독하기' },
  { value: 'GET_OFFER', label: '혜택 받기' },
  { value: 'BOOK_TRAVEL', label: '지금 예약하기' },
  { value: 'CONTACT_US', label: '문의하기' },
  { value: 'SEND_MESSAGE', label: '메시지 보내기' },
  { value: 'DOWNLOAD', label: '다운로드' },
  { value: 'WATCH_MORE', label: '더 보기' },
  { value: 'NO_BUTTON', label: '버튼 없음' },
] as const

export type MetaCta = (typeof META_CTAS)[number]['value']

/** 업로드 화면에 처음 보이는 버튼들. 나머지는 '다른 버튼 고르기'에서 꺼낸다. */
export const FAVORITE_CTAS: MetaCta[] = ['SHOP_NOW', 'APPLY_NOW', 'LEARN_MORE']

export const ctaLabel = (value: string) =>
  META_CTAS.find((cta) => cta.value === value)?.label ?? value

/** 목표에 따라 어울리는 버튼이 다르다. 업로드 화면에서 이 값으로 시작하고 바꿀 수 있게 한다. */
export const DEFAULT_CTA: Record<MetaObjective, MetaCta> = {
  OUTCOME_SALES: 'SHOP_NOW',
  OUTCOME_TRAFFIC: 'LEARN_MORE',
  OUTCOME_ENGAGEMENT: 'LEARN_MORE',
}

/**
 * 광고를 만들 때 미리 채워 두는 값들.
 * "매번 설정하지 않아도 되게" 하기 위한 것이지 잠그기 위한 것이 아니므로, 화면에서 바꿀 수 있다.
 */

/** 판매 목표일 때 무엇을 성과로 셀지 */
export const DEFAULT_CONVERSION_EVENT = 'PURCHASE'

/** 소재마다 다를 수 있어 업로드 화면에서 고칠 수 있게 한다 */
export const DEFAULT_LANDING_URL = 'https://drinkbreevo.com/shop_view?idx=10'

/**
 * 기본 타겟 — 연령·성별을 가르지 않는다.
 * 18세 아래로는 내릴 수 없다(메타가 막는다). 65는 '65세 이상' 전체를 뜻한다.
 */
export const DEFAULT_TARGETING = {
  ageMin: 18,
  ageMax: 65,
  /** 'all'이면 성별을 가리지 않는다 */
  genders: 'all' as const,
}

/**
 * 최근에 산 사람에게 또 보여주지 않으려고 뺄 때 쓰는 기간.
 * 광고 세트를 만들 때 켜고 끌 수 있게 한다.
 */
export const RECENT_BUYER_EXCLUSION_DAYS = 40

/** 광고 계정에 저장해 둔 맞춤 타겟 */
export interface MetaCustomAudience {
  id: string
  name: string
  /** 몇 명쯤인지. 메타가 알려주지 않을 때도 있어 null이 될 수 있다. */
  approximateCount: number | null
}

/**
 * 제외 타겟으로 기본 선택할 후보를 이름으로 찾는다.
 * 이름을 코드에 박아두면 메타에서 이름을 바꿨을 때 조용히 어긋나므로,
 * 목록에서 그럴듯한 것을 짚어 주기만 하고 최종 선택은 사람이 한다.
 */
export const guessRecentBuyerAudience = (list: MetaCustomAudience[]) =>
  list.find(
    (audience) =>
      audience.name.includes(String(RECENT_BUYER_EXCLUSION_DAYS)) &&
      /구매|purchase/i.test(audience.name),
  ) ?? null

/** 업로드한 소재가 메타에 자리 잡은 결과 — 광고를 만들 때 이걸 가리킨다 */
export type CreativeRef =
  | { kind: 'image'; imageHash: string }
  | { kind: 'video'; videoId: string; thumbnailUrl: string | null }

/**
 * 소재가 놓이는 자리.
 * 피드는 정사각(1:1)·세로(4:5)를, 스토리·릴스는 9:16을 쓴다.
 */
export type PlacementSlot = 'feed' | 'ig_feed' | 'fb_feed' | 'story'

export const PLACEMENT_LABELS: Record<PlacementSlot, string> = {
  feed: '피드 전체',
  ig_feed: '인스타 피드',
  fb_feed: '페이스북 피드',
  story: '스토리·릴스',
}

export const PLACEMENT_HINTS: Record<PlacementSlot, string> = {
  feed: '인스타·페이스북 피드 모두',
  ig_feed: '인스타에서는 4:5가 가장 크게 보인다',
  fb_feed: '페이스북에서는 1:1이 무난하다',
  story: '9:16이 여백 없이 꽉 찬다',
}

/** 가로세로 비율로 어디에 쓸 소재인지 짐작한다 */
export function slotOfRatio(width: number, height: number): PlacementSlot {
  if (!width || !height) return 'feed'
  // 세로로 길쭉하면(9:16 = 0.5625) 스토리·릴스용으로 본다.
  return width / height < 0.7 ? 'story' : 'feed'
}

export interface CreativeAsset {
  ref: CreativeRef
  slot: PlacementSlot
}

/** 광고 한 건을 만들 때 필요한 것 */
export interface AdCreateInput {
  adsetId: string
  name: string
  /** 광고 문구 (본문) */
  primaryText: string
  landingUrl: string
  cta: MetaCta
  /**
   * 소재 묶음.
   * 하나면 그대로 쓰고, 여러 개면 노출 위치에 따라 갈라 쓰도록 메타에 맡긴다.
   */
  creatives: CreativeAsset[]
  /**
   * 파트너십 광고로 돌릴지.
   * 켜려면 크리에이터 인스타 계정과 계정 레벨 파트너십이 미리 연결돼 있어야 한다.
   */
  isPartnership: boolean
  /** 파트너십일 때 원작자 인스타그램 계정 ID */
  partnerInstagramId?: string
}

export interface CampaignCreateInput {
  name: string
  objective: MetaObjective
  /** 캠페인 예산 최적화로 만들 때의 하루 예산(원). 비우면 광고 세트에서 예산을 잡는다. */
  dailyBudget: number | null
}

export interface AdSetCreateInput {
  campaignId: string
  name: string
  /** 캠페인이 CBO면 비워 둔다 */
  dailyBudget: number | null
  ageMin: number
  ageMax: number
  /** 'all'이면 성별을 가리지 않는다 */
  genders: 'all' | 'male' | 'female'
  /** 빼고 싶은 맞춤 타겟 (예: 최근 40일 구매자) */
  excludedAudienceIds: string[]
}

/** 자주 쓰는 업로드 설정 묶음 */
export interface MetaUploadPreset {
  id: string
  name: string
  objective: MetaObjective
  adsetId: string | null
  cta: MetaCta
  landingUrl: string
  primaryText: string
  isPartnership: boolean
  createdBy: string | null
  createdAt: string
}

export type MetaUploadPresetInput = Omit<MetaUploadPreset, 'id' | 'createdBy' | 'createdAt'>
