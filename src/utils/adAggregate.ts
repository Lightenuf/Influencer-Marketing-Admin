import type { AdTags, TagDimension } from '@/data/adTypes'
import type { MetaAd, MetaInsight } from '@/data/metaTypes'
import { sumInsights } from '@/data/metaTypes'
import { creativeKeyOf } from './creativeKey'

/**
 * 광고 하나에 붙은 것들을 한 줄로 모은다.
 * 메타에서 온 것(광고·지표)과 어드민에서 붙인 것(태그)이 여기서 만난다.
 */
export interface AdRow {
  ad: MetaAd
  tags: AdTags | null
  insight: Omit<MetaInsight, 'level' | 'id'>
  creativeKey: string
}

/** 지표가 없는 광고도 줄은 있어야 한다 — '한 번도 안 돈 광고'를 봐야 할 때가 있다 */
const EMPTY = {
  spend: 0,
  revenue: 0,
  results: 0,
  reach: 0,
  impressions: 0,
  linkClicks: 0,
}

export function buildRows(ads: MetaAd[], insights: MetaInsight[], tags: AdTags[]): AdRow[] {
  const insightOf = new Map(insights.map((row) => [row.id, row]))
  const tagOf = new Map(tags.map((row) => [row.adId, row]))

  return ads.map((ad) => ({
    ad,
    tags: tagOf.get(ad.id) ?? null,
    insight: insightOf.get(ad.id) ?? EMPTY,
    creativeKey: creativeKeyOf(ad),
  }))
}

/** 전역 필터 — URL 쿼리에 그대로 올라간다 */
export interface AdFilter {
  campaignId: string
  adsetId: string
  source: string
  format: string
  angle: string
  segment: string
  offer: string
  /** 기간 내 지출이 있는 것만 볼지 (5-6) */
  spentOnly: boolean
}

export const emptyFilter = (spentOnly: boolean): AdFilter => ({
  campaignId: '',
  adsetId: '',
  source: '',
  format: '',
  angle: '',
  segment: '',
  offer: '',
  spentOnly,
})

/** 태그 차원 하나를 읽는다. 태그가 없으면 빈 문자열 */
const tagValue = (row: AdRow, dimension: TagDimension) => row.tags?.[dimension] ?? ''

export function applyFilter(
  rows: AdRow[],
  filter: AdFilter,
  adsetToCampaign: Map<string, string>,
): AdRow[] {
  return rows.filter((row) => {
    if (filter.spentOnly && row.insight.spend <= 0) return false
    if (filter.adsetId && row.ad.adsetId !== filter.adsetId) return false
    if (filter.campaignId && adsetToCampaign.get(row.ad.adsetId) !== filter.campaignId) return false
    for (const dimension of ['source', 'format', 'angle', 'segment', 'offer'] as const) {
      if (filter[dimension] && tagValue(row, dimension) !== filter[dimension]) return false
    }
    return true
  })
}

/** 묶음 한 덩이 — 소재별·앵글별·크리에이터별 표가 모두 이 모양을 쓴다 */
export interface Bucket {
  key: string
  label: string
  rows: AdRow[]
  insight: Omit<MetaInsight, 'level' | 'id'>
  /** 대표 광고 — 썸네일·상태를 보여줄 때 쓴다 */
  lead: AdRow
}

const bucketOf = (key: string, label: string, rows: AdRow[]): Bucket => ({
  key,
  label,
  rows,
  insight: sumInsights(
    rows.map((row) => ({ level: 'ad' as const, id: row.ad.id, ...row.insight })),
  ),
  // 지출이 가장 많은 것을 대표로 삼는다. 복제본 중 실제로 돈 것을 보여주기 위함이다.
  lead: [...rows].sort((a, b) => b.insight.spend - a.insight.spend)[0],
})

/**
 * 소재 단위로 묶는다 (5-4).
 * 같은 소재가 여러 세트에 복제돼 있어, 광고 단위로 세면 한 소재가 여러 줄로 갈라진다.
 */
export function byCreative(rows: AdRow[]): Bucket[] {
  const groups = new Map<string, AdRow[]>()
  for (const row of rows) {
    groups.set(row.creativeKey, [...(groups.get(row.creativeKey) ?? []), row])
  }
  return [...groups.entries()]
    .map(([key, list]) => bucketOf(key, list[0].ad.name, list))
    .sort((a, b) => b.insight.spend - a.insight.spend)
}

/** 태그 차원으로 묶는다. 태그가 없는 것은 '태깅 필요'로 모은다 */
export function byTag(rows: AdRow[], dimension: TagDimension): Bucket[] {
  const groups = new Map<string, AdRow[]>()
  for (const row of rows) {
    const key = tagValue(row, dimension) || '(태깅 필요)'
    groups.set(key, [...(groups.get(key) ?? []), row])
  }
  return [...groups.entries()]
    .map(([key, list]) => bucketOf(key, key, list))
    .sort((a, b) => b.insight.spend - a.insight.spend)
}

/** 크리에이터로 묶는다. UGC만 본다 */
export function byCreator(rows: AdRow[], nameOf: (id: string) => string): Bucket[] {
  const ugc = rows.filter((row) => (row.tags?.source ?? '').startsWith('UGC'))
  const groups = new Map<string, AdRow[]>()
  for (const row of ugc) {
    const id = row.tags?.creatorId ?? ''
    groups.set(id, [...(groups.get(id) ?? []), row])
  }
  return [...groups.entries()]
    .map(([id, list]) => bucketOf(id || 'none', id ? nameOf(id) : '(셀러 미연결)', list))
    .sort((a, b) => b.insight.spend - a.insight.spend)
}

/** 소재 수 — 앵글별 표에서 '몇 개로 이 숫자를 냈나'를 보여준다 */
export const creativeCount = (bucket: Bucket) =>
  new Set(bucket.rows.map((row) => row.creativeKey)).size
