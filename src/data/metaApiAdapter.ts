import { supabase } from '@/lib/supabase'
import type { MetaPeriod, MetaRepository } from './metaRepository'
import type {
  MetaAd,
  MetaAdSet,
  MetaCampaign,
  MetaCustomAudience,
  MetaInsight,
  MetaStatus,
  MetaWeekPoint,
} from './metaTypes'

/**
 * 실제 메타 광고 계정.
 *
 * 메타를 직접 부르지 않고 Supabase Edge Function(`meta-proxy`)을 거친다.
 * System User 토큰은 그 함수만 쥐고 있고 브라우저로 내려오지 않는다.
 */

async function call<T>(action: string, params: Record<string, unknown> = {}): Promise<T> {
  if (!supabase) throw new Error('로그인 정보가 없습니다. 다시 로그인해주세요.')

  const { data, error } = await supabase.functions.invoke('meta-proxy', {
    body: { action, params },
  })

  if (error) {
    // 함수가 500·502로 답하면 본문에 메타가 준 이유가 들어 있다.
    const detail = await readError(error)
    throw new Error(detail ?? '메타 광고 정보를 가져오지 못했습니다.')
  }
  if (data && typeof data === 'object' && 'error' in data) {
    throw new Error(String((data as { error: unknown }).error))
  }
  return data as T
}

/** supabase-js는 오류 본문을 Response에 담아 준다 — 열어서 메타 메시지를 꺼낸다 */
async function readError(error: unknown): Promise<string | null> {
  const context = (error as { context?: unknown }).context
  if (context instanceof Response) {
    try {
      const body = await context.json()
      if (body?.error) return String(body.error)
    } catch {
      // 본문이 JSON이 아니면 그냥 기본 메시지를 쓴다.
    }
  }
  return error instanceof Error ? error.message : null
}

export const metaApiAdapter: MetaRepository = {
  listCampaigns: () => call<MetaCampaign[]>('campaigns'),
  listAdSets: () => call<MetaAdSet[]>('adsets'),
  listAds: () => call<MetaAd[]>('ads'),
  listCustomAudiences: () => call<MetaCustomAudience[]>('audiences'),

  getInsights: (level, period: MetaPeriod) =>
    call<MetaInsight[]>('insights', { level, from: period.from, to: period.to }),

  getWeeklySeries: (adIds, period) =>
    call<MetaWeekPoint[]>('weekly', { adIds, from: period.from, to: period.to }),

  async setAdStatus(adId: string, status: MetaStatus) {
    await call('setAdStatus', { adId, status })
    // 메타가 바꾼 결과를 다시 주지 않으므로, 우리가 보낸 값을 그대로 돌려준다.
    // 화면은 곧바로 목록을 다시 받아 실제 값으로 맞춘다.
    return { id: adId, status } as MetaAd
  },

  async setDailyBudget(target, won) {
    await call('setDailyBudget', { level: target.level, id: target.id, won })
  },
}
