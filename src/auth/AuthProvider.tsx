import { createContext, use, useCallback, useEffect, useState, type ReactNode } from 'react'
import { repository } from '@/data'
import type { TeamMember } from '@/data/types'

const SESSION_KEY = 'breevo-influencer-admin:session'

interface AuthContextValue {
  user: TeamMember | null
  members: TeamMember[]
  loading: boolean
  signIn: (memberId: string) => void
  signOut: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [members, setMembers] = useState<TeamMember[]>([])
  const [user, setUser] = useState<TeamMember | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
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

  const signIn = useCallback(
    (memberId: string) => {
      const member = members.find((m) => m.id === memberId)
      if (!member) return
      localStorage.setItem(SESSION_KEY, member.id)
      setUser(member)
    },
    [members],
  )

  const signOut = useCallback(() => {
    localStorage.removeItem(SESSION_KEY)
    setUser(null)
  }, [])

  return (
    <AuthContext value={{ user, members, loading, signIn, signOut }}>{children}</AuthContext>
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
