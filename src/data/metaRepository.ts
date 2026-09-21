import type {
  MetaAd,
  MetaAdSet,
  MetaCampaign,
  MetaCustomAudience,
  MetaInsight,
  MetaLevel,
  MetaStatus,
  MetaWeekPoint,
} from './metaTypes'

export interface MetaPeriod {
  /** YYYY-MM-DD, 포함 */
  from: string
  /** YYYY-MM-DD, 포함 */
  to: string
}

/**
 * 메타 광고 데이터 창구.
 *
 * 화면은 이 인터페이스만 알고, 목업인지 실제 메타인지 모른다.
 * 실연동은 Supabase Edge Function을 거친다 — System User 토큰을 브라우저에 두지 않기 위함이다.
 */
export interface MetaRepository {
  listCampaigns(): Promise<MetaCampaign[]>
  listAdSets(): Promise<MetaAdSet[]>
  listAds(): Promise<MetaAd[]>

  /** 기간 집계. level이 가리키는 노드마다 한 줄씩 준다. */
  getInsights(level: Exclude<MetaLevel, 'account'>, period: MetaPeriod): Promise<MetaInsight[]>

  /** 광고 계정에 저장된 맞춤 타겟 — 광고 세트를 만들 때 제외 대상으로 고른다 */
  listCustomAudiences(): Promise<MetaCustomAudience[]>

  /** 고른 광고들의 주 단위 ROAS 추세 */
  getWeeklySeries(adIds: string[], period: MetaPeriod): Promise<MetaWeekPoint[]>

  /** 광고 켜기·일시중지 */
  setAdStatus(adId: string, status: MetaStatus): Promise<MetaAd>

  /**
   * 일예산 조정.
   * 광고에는 예산 필드가 없어, 그 광고가 속한 광고 세트(캠페인이 CBO면 캠페인)를 고친다.
   */
  setDailyBudget(target: { level: 'campaign' | 'adset'; id: string }, won: number): Promise<void>
}
