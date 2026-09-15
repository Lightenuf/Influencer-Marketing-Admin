import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/** 환경변수가 없으면 목업 모드로 동작한다. */
export const supabase = url && anonKey ? createClient(url, anonKey) : null

export function requireSupabase() {
  if (!supabase) throw new Error('Supabase가 설정되지 않았습니다.')
  return supabase
}
