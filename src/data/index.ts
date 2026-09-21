import { supabase } from '@/lib/supabase'
import { mockAdapter } from './mockAdapter'
import type { DataRepository } from './repository'
import { metaMockAdapter } from './metaMockAdapter'
import type { MetaRepository } from './metaRepository'
import { supabaseAdapter } from './supabaseAdapter'

/** Supabase 환경변수가 설정되면 자동으로 실제 DB를 사용한다. */
export const isMockMode = supabase === null

export const repository: DataRepository = isMockMode ? mockAdapter : supabaseAdapter

/**
 * 메타 광고는 별도 창구를 쓴다.
 * 실연동은 Supabase Edge Function을 거치므로, 그 주소가 설정되기 전까지는 목업으로 돈다.
 * (System User 토큰은 서버에만 두고 브라우저로 내려보내지 않는다)
 */
export const isMetaMockMode = !import.meta.env.VITE_META_PROXY_URL

export const metaRepository: MetaRepository = metaMockAdapter
