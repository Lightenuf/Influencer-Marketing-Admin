import { createContext, use, useCallback, useEffect, useState, type ReactNode } from 'react'
import { isMockMode, repository } from '@/data'
import type { TeamMember } from '@/data/types'
import { supabase } from '@/lib/supabase'

const SESSION_KEY = 'breevo-influencer-admin:session'

interface AuthContextValue {
  user: TeamMember | null
  /** 목업 모드에서 고를 수 있는 팀원 목록 */
  members: TeamMember[]
  loading: boolean
  isMockMode: boolean
  signInAsMember: (memberId: string) => void
  signInWithPassword: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [members, setMembers] = useState<TeamMember[]>([])
  const [user, setUser] = useState<TeamMember | null>(null)
  const [loading, setLoading] = useState(true)

  // 목업 모드: 팀원 목록을 불러와 저장된 선택을 복원한다.
  useEffect(() => {
    if (!isMockMode) return
    let active = true
    repository.listTeamMembers().then((list) => {
      if (!active) return
      setMembers(list)
      const savedId = localStorage.getItem(SESSION_KEY)
      setUser(list.find((m) => m.id === savedId) ?? null)
      setLoading(false)
    })
    return () => {
      active = false
    }
  }, [])

  // Supabase 모드: 세션을 구독하고 프로필을 조회한다.
  useEffect(() => {
    if (isMockMode || !supabase) return
    const client = supabase

    const loadProfile = async (userId: string, fallbackEmail: string) => {
      const { data } = await client
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle()
      setUser({
        id: userId,
        email: data?.email ?? fallbackEmail,
        displayName: data?.display_name ?? fallbackEmail.split('@')[0],
        role: data?.role === 'admin' ? 'admin' : 'member',
      })
      setLoading(false)
    }

    client.auth.getSession().then(({ data }) => {
      const session = data.session
      if (session) {
        loadProfile(session.user.id, session.user.email ?? '')
      } else {
        setUser(null)
        setLoading(false)
      }
    })

    const { data: subscription } = client.auth.onAuthStateChange((_event, session) => {
      if (session) {
        loadProfile(session.user.id, session.user.email ?? '')
      } else {
        setUser(null)
        setLoading(false)
      }
    })

    return () => subscription.subscription.unsubscribe()
  }, [])

  const signInAsMember = useCallback(
    (memberId: string) => {
      const member = members.find((m) => m.id === memberId)
      if (!member) return
      localStorage.setItem(SESSION_KEY, member.id)
      setUser(member)
    },
    [members],
  )

  const signInWithPassword = useCallback(async (email: string, password: string) => {
    if (!supabase) throw new Error('Supabase가 설정되지 않았습니다.')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw new Error('이메일 또는 비밀번호가 올바르지 않습니다.')
  }, [])

  const signOut = useCallback(async () => {
    localStorage.removeItem(SESSION_KEY)
    if (supabase) await supabase.auth.signOut()
    setUser(null)
  }, [])

  return (
    <AuthContext
      value={{
        user,
        members,
        loading,
        isMockMode,
        signInAsMember,
        signInWithPassword,
        signOut,
      }}
    >
      {children}
    </AuthContext>
  )
}

export function useAuth() {
  const context = use(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}

/** 로그인한 사용자가 반드시 있는 화면에서 사용 */
export function useCurrentUser() {
  const { user } = useAuth()
  if (!user) throw new Error('로그인이 필요합니다.')
  return user
}
