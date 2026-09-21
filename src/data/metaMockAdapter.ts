import type { MetaPeriod, MetaRepository } from './metaRepository'
import type {
  AdCreateInput,
  AdSetCreateInput,
  CampaignCreateInput,
  CreativeRef,
  MetaAd,
  MetaAdSet,
  MetaCampaign,
  MetaCustomAudience,
  MetaInsight,
  MetaWeekPoint,
} from './metaTypes'

/**
 * 메타 계정 없이 화면을 만들고 확인하기 위한 가짜 데이터.
 *
 * 값은 매번 같아야 비교가 되므로, 난수 대신 id와 날짜로 정해지는 수를 쓴다.
 * 실연동을 붙일 때 이 파일만 빠지고 화면은 그대로 남는다.
 */

const STORAGE_KEY = 'breevo-meta-admin:v1'

const CAMPAIGNS: MetaCampaign[] = [
  {
    id: 'c-1',
    name: '브리보 9월 전환 캠페인',
    status: 'ACTIVE',
    objective: 'OUTCOME_SALES',
    isCbo: true,
    dailyBudget: 300_000,
    lifetimeBudget: null,
  },
  {
    id: 'c-2',
    name: '크리에이터 파트너십 (상시)',
    status: 'ACTIVE',
    objective: 'OUTCOME_SALES',
    isCbo: false,
    dailyBudget: null,
    lifetimeBudget: null,
  },
  {
    id: 'c-3',
    name: '리타게팅 — 장바구니 이탈',
    status: 'PAUSED',
    objective: 'OUTCOME_SALES',
    isCbo: false,
    dailyBudget: null,
    lifetimeBudget: null,
  },
]

const ADSETS: MetaAdSet[] = [
  {
    id: 'as-1',
    campaignId: 'c-1',
    name: '20-34 여성 · 관심사 다이어트',
    status: 'ACTIVE',
    dailyBudget: null,
    lifetimeBudget: null,
    startDate: '2026-09-01',
    endDate: null,
  },
  {
    id: 'as-2',
    campaignId: 'c-1',
    name: '유사타겟 1% (구매자 기반)',
    status: 'ACTIVE',
    dailyBudget: null,
    lifetimeBudget: null,
    startDate: '2026-09-05',
    endDate: '2026-10-05',
  },
  {
    id: 'as-3',
    campaignId: 'c-2',
    name: '파트너십 — 육아맘',
    status: 'ACTIVE',
    dailyBudget: 120_000,
    lifetimeBudget: null,
    startDate: '2026-08-20',
    endDate: null,
  },
  {
    id: 'as-4',
    campaignId: 'c-2',
    name: '파트너십 — 홈카페·건강식',
    status: 'ACTIVE',
    dailyBudget: 80_000,
    lifetimeBudget: null,
    startDate: '2026-09-10',
    endDate: null,
  },
  {
    id: 'as-5',
    campaignId: 'c-3',
    name: '최근 14일 장바구니 담기',
    status: 'PAUSED',
    dailyBudget: 50_000,
    lifetimeBudget: null,
    startDate: '2026-08-01',
    endDate: null,
  },
]

const AD_SEEDS: Array<Omit<MetaAd, 'createdAt'> & { day: number }> = [
  {
    id: 'ad-1',
    adsetId: 'as-1',
    name: '숏폼 A — 아침 루틴',
    status: 'ACTIVE',
    creativeType: 'video',
    thumbnailUrl: null,
    isPartnership: false,
    day: 1,
  },
  {
    id: 'ad-2',
    adsetId: 'as-1',
    name: '숏폼 B — 성분 설명',
    status: 'ACTIVE',
    creativeType: 'video',
    thumbnailUrl: null,
    isPartnership: false,
    day: 3,
  },
  {
    id: 'ad-3',
    adsetId: 'as-1',
    name: '이미지 A — 제품컷',
    status: 'PAUSED',
    creativeType: 'image',
    thumbnailUrl: null,
    isPartnership: false,
    day: 5,
  },
  {
    id: 'ad-4',
    adsetId: 'as-2',
    name: '숏폼 C — 후기 모음',
    status: 'ACTIVE',
    creativeType: 'video',
    thumbnailUrl: null,
    isPartnership: false,
    day: 6,
  },
  {
    id: 'ad-5',
    adsetId: 'as-2',
    name: '이미지 B — 비포애프터',
    status: 'ACTIVE',
    creativeType: 'image',
    thumbnailUrl: null,
    isPartnership: false,
    day: 8,
  },
  {
    id: 'ad-6',
    adsetId: 'as-3',
    name: '@mom_daily_kr 리뷰',
    status: 'ACTIVE',
    creativeType: 'video',
    thumbnailUrl: null,
    isPartnership: true,
    day: 2,
  },
  {
    id: 'ad-7',
    adsetId: 'as-3',
    name: '@healthy_table 언박싱',
    status: 'ACTIVE',
    creativeType: 'video',
    thumbnailUrl: null,
    isPartnership: true,
    day: 9,
  },
  {
    id: 'ad-8',
    adsetId: 'as-4',
    name: '@homecafe_lab 레시피',
    status: 'ACTIVE',
    creativeType: 'video',
    thumbnailUrl: null,
    isPartnership: true,
    day: 11,
  },
  {
    id: 'ad-9',
    adsetId: 'as-4',
    name: '@fresh_market 공구 예고',
    status: 'PAUSED',
    creativeType: 'image',
    thumbnailUrl: null,
    isPartnership: true,
    day: 12,
  },
  {
    id: 'ad-10',
    adsetId: 'as-5',
    name: '리타겟 — 재고 소진 임박',
    status: 'PAUSED',
    creativeType: 'image',
    thumbnailUrl: null,
    isPartnership: false,
    day: 4,
  },
]

const ADS: MetaAd[] = AD_SEEDS.map(({ day, ...ad }) => ({
  ...ad,
  createdAt: `2026-09-${String(day).padStart(2, '0')}T09:00:00.000Z`,
}))

/** 같은 입력에는 늘 같은 수. 화면을 다시 열어도 숫자가 흔들리지 않게 한다. */
function hash(seed: string): number {
  let value = 2166136261
  for (let i = 0; i < seed.length; i += 1) {
    value ^= seed.charCodeAt(i)
    value = Math.imul(value, 16777619)
  }
  return ((value >>> 0) % 10_000) / 10_000
}

const eachDay = (period: MetaPeriod): string[] => {
  const days: string[] = []
  const cursor = new Date(`${period.from}T00:00:00Z`)
  const last = new Date(`${period.to}T00:00:00Z`)
  while (cursor <= last) {
    days.push(cursor.toISOString().slice(0, 10))
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return days
}

/** 광고 하나의 하루치 성과 */
function dayStats(adId: string, day: string) {
  const ad = ADS.find((item) => item.id === adId)
  const paused = ad?.status === 'PAUSED'
  const base = hash(`${adId}|${day}`)
  const size = hash(adId)

  // 멈춘 광고는 최근에 돈을 쓰지 않는다.
  const stopped = paused && day >= '2026-09-15'
  const spend = stopped ? 0 : Math.round((8_000 + size * 45_000) * (0.6 + base * 0.8))

  // 실제 광고 지표의 관계를 따른다 — 노출은 CPM에서, 클릭은 CTR에서, 전환은 클릭에서 나온다.
  const cpm = 6_000 + hash(`m|${adId}`) * 7_000 // 1,000회 노출당 비용
  const impressions = Math.round((spend / cpm) * 1000)
  const ctr = 0.009 + base * 0.018 // 링크 클릭률 0.9~2.7%
  const linkClicks = Math.round(impressions * ctr)
  const reach = Math.round(impressions * (0.55 + base * 0.25))
  // 파트너십 소재가 대체로 잘 나온다 — 화면에서 차이가 보이도록.
  const bonus = ad?.isPartnership ? 0.012 : 0
  const results = Math.round(linkClicks * (0.015 + hash(`r|${adId}`) * 0.035 + bonus))
  const aov = 28_000 + hash(`v|${adId}`) * 22_000
  const revenue = Math.round(results * aov)

  return { spend, impressions, linkClicks, reach, results, revenue }
}

/** 화면에서 바꾼 상태·예산은 이 브라우저에만 남긴다 (실연동 전까지의 흉내) */
interface Overrides {
  adStatus: Record<string, 'ACTIVE' | 'PAUSED'>
  dailyBudget: Record<string, number>
}

const readOverrides = (): Overrides => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return { adStatus: {}, dailyBudget: {}, ...JSON.parse(raw) }
  } catch {
    // 저장소를 못 읽어도 화면은 떠야 한다.
  }
  return { adStatus: {}, dailyBudget: {} }
}

const writeOverrides = (value: Overrides) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
  } catch {
    // 저장 실패는 조용히 넘긴다 — 미리보기용 데이터다.
  }
}

const delay = () => new Promise((resolve) => setTimeout(resolve, 120))

export const metaMockAdapter: MetaRepository = {
  async listCampaigns() {
    await delay()
    const { dailyBudget } = readOverrides()
    return CAMPAIGNS.map((campaign) => ({
      ...campaign,
      dailyBudget: dailyBudget[campaign.id] ?? campaign.dailyBudget,
    }))
  },

  async listAdSets() {
    await delay()
    const { dailyBudget } = readOverrides()
    return ADSETS.map((adset) => ({
      ...adset,
      dailyBudget: dailyBudget[adset.id] ?? adset.dailyBudget,
    }))
  },

  async listAds() {
    await delay()
    const { adStatus } = readOverrides()
    return ADS.map((ad) => ({ ...ad, status: adStatus[ad.id] ?? ad.status }))
  },

  async listCustomAudiences(): Promise<MetaCustomAudience[]> {
    await delay()
    return [
      { id: 'aud-1', name: '최근 40일 구매자', approximateCount: 3_420 },
      { id: 'aud-2', name: '장바구니 담기 14일', approximateCount: 8_150 },
      { id: 'aud-3', name: '인스타 참여 365일', approximateCount: 41_900 },
      { id: 'aud-4', name: '구매자 유사타겟 1%', approximateCount: 512_000 },
    ]
  },

  async getInsights(level, period) {
    await delay()
    const days = eachDay(period)

    const perAd = ADS.map((ad) => {
      const total = days.reduce(
        (sum, day) => {
          const stat = dayStats(ad.id, day)
          return {
            spend: sum.spend + stat.spend,
            revenue: sum.revenue + stat.revenue,
            results: sum.results + stat.results,
            reach: sum.reach + stat.reach,
            impressions: sum.impressions + stat.impressions,
            linkClicks: sum.linkClicks + stat.linkClicks,
          }
        },
        { spend: 0, revenue: 0, results: 0, reach: 0, impressions: 0, linkClicks: 0 },
      )
      return { ad, total }
    })

    if (level === 'ad') {
      return perAd.map(({ ad, total }) => ({ level: 'ad' as const, id: ad.id, ...total }))
    }

    const groupKey = (adsetId: string) =>
      level === 'adset' ? adsetId : (ADSETS.find((a) => a.id === adsetId)?.campaignId ?? '')

    const grouped = new Map<string, MetaInsight>()
    for (const { ad, total } of perAd) {
      const key = groupKey(ad.adsetId)
      if (!key) continue
      const found = grouped.get(key)
      if (found) {
        found.spend += total.spend
        found.revenue += total.revenue
        found.results += total.results
        found.reach += total.reach
        found.impressions += total.impressions
        found.linkClicks += total.linkClicks
      } else {
        grouped.set(key, { level, id: key, ...total })
      }
    }
    return [...grouped.values()]
  },

  async getWeeklySeries(adIds, period) {
    await delay()
    const points: MetaWeekPoint[] = []

    for (const adId of adIds) {
      const weeks = new Map<string, { spend: number; revenue: number }>()
      for (const day of eachDay(period)) {
        const date = new Date(`${day}T00:00:00Z`)
        // 그 주의 월요일로 묶는다
        const weekday = (date.getUTCDay() + 6) % 7
        date.setUTCDate(date.getUTCDate() - weekday)
        const weekStart = date.toISOString().slice(0, 10)

        const stat = dayStats(adId, day)
        const bucket = weeks.get(weekStart) ?? { spend: 0, revenue: 0 }
        bucket.spend += stat.spend
        bucket.revenue += stat.revenue
        weeks.set(weekStart, bucket)
      }

      for (const [weekStart, bucket] of weeks) {
        points.push({
          adId,
          weekStart,
          spend: bucket.spend,
          revenue: bucket.revenue,
          roas: bucket.spend > 0 ? bucket.revenue / bucket.spend : 0,
        })
      }
    }

    return points.sort((a, b) => a.weekStart.localeCompare(b.weekStart))
  },

  async uploadCreative(file: File): Promise<CreativeRef> {
    await delay()
    // 실제로 올리지 않고 올린 척만 한다.
    return file.type.startsWith('video/')
      ? { kind: 'video', videoId: `mock-video-${Date.now()}`, thumbnailUrl: null }
      : { kind: 'image', imageHash: `mock-image-${Date.now()}` }
  },

  async createAd(input: AdCreateInput) {
    await delay()
    return { id: `mock-ad-${input.adsetId}-${Date.now()}` }
  },

  async createCampaign(_input: CampaignCreateInput) {
    await delay()
    return { id: `mock-campaign-${Date.now()}` }
  },

  async createAdSet(_input: AdSetCreateInput) {
    await delay()
    return { id: `mock-adset-${Date.now()}` }
  },

  async setAdStatus(adId, status) {
    await delay()
    const overrides = readOverrides()
    overrides.adStatus[adId] = status
    writeOverrides(overrides)
    const ad = ADS.find((item) => item.id === adId)
    if (!ad) throw new Error('광고를 찾을 수 없습니다.')
    return { ...ad, status }
  },

  async setDailyBudget(target, won) {
    await delay()
    const overrides = readOverrides()
    overrides.dailyBudget[target.id] = won
    writeOverrides(overrides)
  },
}
