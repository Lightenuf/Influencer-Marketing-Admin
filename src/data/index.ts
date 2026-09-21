import { supabase } from '@/lib/supabase'
import { mockAdapter } from './mockAdapter'
import type { DataRepository } from './repository'
import { metaApiAdapter } from './metaApiAdapter'
import { metaMockAdapter } from './metaMockAdapter'
import type { MetaRepository } from './metaRepository'
import { supabaseAdapter } from './supabaseAdapter'

/** Supabase 환경변수가 설정되면 자동으로 실제 DB를 사용한다. */
export const isMockMode = supabase === null

export const repository: DataRepository = isMockMode ? mockAdapter : supabaseAdapter

/**
 * 메타 광고는 별도 창구를 쓴다.
 *
 * 실연동은 Supabase Edge Function(`meta-proxy`)을 거친다 — 토큰을 브라우저에 두지 않기 위함.
 * 그래서 Supabase가 연결되어 있고 VITE_META_ENABLED가 켜져 있을 때만 실제 계정을 본다.
 * 함수를 배포하기 전에 켜면 화면마다 오류가 나므로, 배포를 마친 뒤 켠다.
 */
export const isMetaMockMode = supabase === null || import.meta.env.VITE_META_ENABLED !== 'true'

export const metaRepository: MetaRepository = isMetaMockMode ? metaMockAdapter : metaApiAdapter
