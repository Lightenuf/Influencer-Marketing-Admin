import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { ALLOWED_EMAIL_DOMAIN, useAuth } from './AuthProvider'
import { Button, Card, Field, Input } from '@/components/ui'

export default function SignupPage() {
  const { user, loading, isMockMode, signUp } = useAuth()
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const [sent, setSent] = useState(false)

  if (loading) return null
  if (user) return <Navigate to="/dashboard" replace />
  if (isMockMode) return <Navigate to="/login" replace />

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setPending(true)
    try {
      await signUp(email.trim(), password, displayName.trim())
      setSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : '가입에 실패했습니다.')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center p-6">
      <Card className="w-full max-w-sm p-8">
        <div className="mb-6 text-center">
          <p className="text-xs font-semibold tracking-widest text-violet-600">BREEVO</p>
          <h1 className="mt-1 text-xl font-bold text-slate-900">팀 계정 만들기</h1>
          <p className="mt-2 text-sm text-slate-500">
            회사 이메일(<b>{ALLOWED_EMAIL_DOMAIN}</b>)로만 가입할 수 있습니다
          </p>
        </div>

        {sent ? (
          <div className="space-y-4">
            <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm leading-relaxed text-emerald-800">
              <b>{email}</b> 으로 인증 메일을 보냈습니다.
              <br />
              메일의 링크를 눌러 인증을 마치면 로그인할 수 있습니다.
            </p>
            <p className="text-xs leading-relaxed text-slate-500">
              메일이 오지 않으면 스팸함을 확인해보시고, 그래도 없으면 관리자에게 문의해주세요.
            </p>
            <Link to="/login" className="block text-center text-sm text-violet-600 hover:underline">
              로그인 화면으로
            </Link>
          </div>
        ) : (
          <>
            <form onSubmit={submit} className="space-y-4">
              <Field label="이름" required>
                <Input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="예) 김한주"
                  required
                />
              </Field>
              <Field label="회사 이메일" required>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={`name${ALLOWED_EMAIL_DOMAIN}`}
                  autoComplete="username"
                  required
                />
              </Field>
              <Field label="비밀번호" required error={error} hint="8자 이상">
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={8}
                  autoComplete="new-password"
                  required
                />
              </Field>

              <Button
                type="submit"
                className="w-full"
                disabled={pending || !displayName || !email || password.length < 8}
              >
                {pending ? '가입 중...' : '가입하기'}
              </Button>
            </form>

            <p className="mt-5 text-center text-sm text-slate-500">
              이미 계정이 있으신가요?{' '}
              <Link to="/login" className="text-violet-600 hover:underline">
                로그인
              </Link>
            </p>
          </>
        )}
      </Card>
    </div>
  )
}
