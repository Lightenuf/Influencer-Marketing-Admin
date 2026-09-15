import { mockAdapter } from './mockAdapter'
import type { DataRepository } from './repository'

/**
 * Supabase 환경변수가 설정되면 자동으로 Supabase 어댑터를 쓰도록 이 지점만 바꾸면 된다.
 * (2단계에서 supabaseAdapter.ts 추가 후 아래 분기를 활성화)
 */
export const repository: DataRepository = mockAdapter

export const isMockMode = repository === mockAdapter
