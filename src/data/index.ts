import { supabase } from '@/lib/supabase'
import { mockAdapter } from './mockAdapter'
import type { DataRepository } from './repository'
import { supabaseAdapter } from './supabaseAdapter'

/** Supabase 환경변수가 설정되면 자동으로 실제 DB를 사용한다. */
export const isMockMode = supabase === null

export const repository: DataRepository = isMockMode ? mockAdapter : supabaseAdapter
