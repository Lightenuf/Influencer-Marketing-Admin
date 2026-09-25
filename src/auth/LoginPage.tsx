import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from './AuthProvider'
import { Button, Card, Field, Input, Select } from '@/components/ui'

export default function LoginPage() {
  const { user, members, loading, isMockMode, signInAsMember, signInWithPassword, signInWithGoogle } =
    useAuth()
  const [selected, setSelected] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const [googlePending, setGooglePending] = useState(false)

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

  const google = async () => {
    setError('')
    setGooglePending(true)
    try {
      await signInWithGoogle()
      // 구글 화면으로 넘어가므로 여기서 더 할 일은 없다.
    } catch (err) {
      setError(err instanceof Error ? err.message : '구글 로그인에 실패했습니다.')
      setGooglePending(false)
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center p-6">
      <Card className="w-full max-w-sm p-8">
        <div className="mb-6 text-center">
          <p className="text-xs font-semibold tracking-widest text-violet-600">Breevo</p>
          <h1 className="mt-1 text-xl font-bold text-slate-900">마케팅 허브</h1>
          <p className="mt-2 text-sm text-slate-500">팀 계정으로 로그인하세요</p>
        </div>

        {!isMockMode && (
          <div className="mb-5">
            <button
              type="button"
              onClick={google}
              disabled={googlePending}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
                <path
                  fill="#4285F4"
                  d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.4a5.5 5.5 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.6-5.2 3.6-8.8z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24z"
                />
                <path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6H1.3a12 12 0 0 0 0 10.8l4-3.1z" />
                <path
                  fill="#EA4335"
                  d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1c.9-2.9 3.6-4.9 6.7-4.9z"
                />
              </svg>
              {googlePending ? '구글로 이동 중...' : '회사 구글 계정으로 로그인'}
            </button>
            <p className="mt-2 text-center text-xs text-slate-400">
              @lightenuf.com 계정만 들어올 수 있습니다
            </p>

            <div className="mt-5 flex items-center gap-3">
              <span className="h-px flex-1 bg-slate-200" />
              <span className="text-xs text-slate-400">또는 이메일로</span>
              <span className="h-px flex-1 bg-slate-200" />
            </div>
          </div>
        )}

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
