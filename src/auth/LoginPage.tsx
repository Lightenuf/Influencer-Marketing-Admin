import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from './AuthProvider'
import { Button, Card, Field, Input, Select } from '@/components/ui'

export default function LoginPage() {
  const { user, members, loading, isMockMode, signInAsMember, signInWithPassword } = useAuth()
  const [selected, setSelected] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  if (loading) return null
  if (user) return <Navigate to="/dashboard" replace />

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (isMockMode) {
      signInAsMember(selected)
      return
    }
    setPending(true)
    try {
      await signInWithPassword(email.trim(), password)
    } catch (err) {
      setError(err instanceof Error ? err.message : '로그인에 실패했습니다.')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center p-6">
      <Card className="w-full max-w-sm p-8">
        <div className="mb-6 text-center">
          <p className="text-xs font-semibold tracking-widest text-violet-600">BREEVO</p>
          <h1 className="mt-1 text-xl font-bold text-slate-900">인플루언서 관리 어드민</h1>
          <p className="mt-2 text-sm text-slate-500">팀 계정으로 로그인하세요</p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          {isMockMode ? (
            <Field label="팀원 선택" required>
              <Select value={selected} onChange={(e) => setSelected(e.target.value)} required>
                <option value="" disabled>
                  선택해주세요
                </option>
                {members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.displayName} ({member.email})
                  </option>
                ))}
              </Select>
            </Field>
          ) : (
            <>
              <Field label="이메일" required>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="username"
                  required
                />
              </Field>
              <Field label="비밀번호" required error={error}>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
              </Field>
            </>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={pending || (isMockMode ? !selected : !email || !password)}
          >
            {pending ? '로그인 중...' : '로그인'}
          </Button>
        </form>

        {!isMockMode && (
          <p className="mt-5 text-center text-sm text-slate-500">
            계정이 없으신가요?{' '}
            <Link to="/signup" className="text-violet-600 hover:underline">
              회사 이메일로 가입
            </Link>
          </p>
        )}

        {isMockMode && (
          <p className="mt-6 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-700">
            현재는 <b>미리보기 모드</b>입니다. 데이터는 이 브라우저에만 저장되며, Supabase 연결 후
            이메일·비밀번호 로그인과 팀 공유 데이터베이스로 전환됩니다.
          </p>
        )}
      </Card>
    </div>
  )
}
