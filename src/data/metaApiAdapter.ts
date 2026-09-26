import { supabase } from '@/lib/supabase'
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
  MetaStatus,
  MetaWeekPoint,
} from './metaTypes'

/**
 * 실제 메타 광고 계정.
 *
 * 메타를 직접 부르지 않고 Supabase Edge Function(`meta-proxy`)을 거친다.
 * System User 토큰은 그 함수만 쥐고 있고 브라우저로 내려오지 않는다.
 */

/**
 * 지금 보고 있는 광고 계정.
 * 비어 있으면 함수가 기본 계정을 쓴다. 이 브라우저에만 기억한다.
 */
let account = (() => {
  try {
    return localStorage.getItem('breevo:metaAccount') ?? ''
  } catch {
    return ''
  }
})()

async function call<T>(action: string, params: Record<string, unknown> = {}): Promise<T> {
  if (!supabase) throw new Error('로그인 정보가 없습니다. 다시 로그인해주세요.')

  const { data, error } = await supabase.functions.invoke('meta-proxy', {
    body: { action, params: { ...params, accountId: account } },
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
  listAccounts: () => call('accounts'),

  getDailySeries: (adIds, period) => call('daily', { adIds, ...period }),

  setAccount(accountId) {
    account = accountId
    try {
      localStorage.setItem('breevo:metaAccount', accountId)
    } catch {
      // 저장이 막혀도 이번 세션 동안은 동작한다
    }
  },

  getAccount: () => account,

  listCampaigns: () => call<MetaCampaign[]>('campaigns'),
  listAdSets: () => call<MetaAdSet[]>('adsets'),
  listAds: () => call<MetaAd[]>('ads'),
  listCustomAudiences: () => call<MetaCustomAudience[]>('audiences'),

  getInsights: (level, period: MetaPeriod) =>
    call<MetaInsight[]>('insights', { level, from: period.from, to: period.to }),

  getWeeklySeries: (adIds, period) =>
    call<MetaWeekPoint[]>('weekly', { adIds, from: period.from, to: period.to }),

  /**
   * 이미지는 함수를 거쳐 그대로 올린다.
   * 영상은 Storage에 올린 뒤 잠깐 열리는 주소만 넘겨, 메타가 직접 받아가게 한다.
   * (큰 파일은 함수를 통과하지 못한다)
   */
  async uploadCreative(file: File): Promise<CreativeRef> {
    if (!supabase) throw new Error('로그인 정보가 없습니다. 다시 로그인해주세요.')

    if (file.type.startsWith('video/')) {
      const path = `${Date.now()}-${file.name.replace(/[^\w.-]/g, '_')}`
      const { error: uploadError } = await supabase.storage
        .from('meta-creatives')
        .upload(path, file, { contentType: file.type, upsert: true })
      if (uploadError) throw new Error(`영상을 올리지 못했습니다: ${uploadError.message}`)

      // 메타가 받아갈 동안만 열어둔다.
      const { data: signed, error: signError } = await supabase.storage
        .from('meta-creatives')
        .createSignedUrl(path, 60 * 30)
      if (signError || !signed) throw new Error('영상 주소를 만들지 못했습니다.')

      return call<CreativeRef>('uploadVideo', { fileUrl: signed.signedUrl, name: file.name })
    }

    const base64 = await toBase64(file)
    return call<CreativeRef>('uploadImage', { base64, name: file.name })
  },

  createAd: (input: AdCreateInput) => call<{ id: string }>('createAd', { ...input }),
  createCampaign: (input: CampaignCreateInput) =>
    call<{ id: string }>('createCampaign', { ...input }),
  createAdSet: (input: AdSetCreateInput) => call<{ id: string }>('createAdSet', { ...input }),

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

/** 파일을 글자로 바꿔 함수에 실어 보낸다 (이미지 전용) */
function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result)
      // 'data:image/png;base64,....' 에서 뒤쪽만 쓴다.
      resolve(result.slice(result.indexOf(',') + 1))
    }
    reader.onerror = () => reject(new Error('파일을 읽지 못했습니다.'))
    reader.readAsDataURL(file)
  })
}
