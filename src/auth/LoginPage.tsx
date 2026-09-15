import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from './AuthProvider'
import { Button, Card, Field, Select } from '@/components/ui'

export default function LoginPage() {
  const { user, members, loading, signIn } = useAuth()
  const [selected, setSelected] = useState('')

  if (loading) return null
  if (user) return <Navigate to="/dashboard" replace />

  return (
    <div className="flex min-h-full items-center justify-center p-6">
      <Card className="w-full max-w-sm p-8">
        <div className="mb-6 text-center">
          <p className="text-xs font-semibold tracking-widest text-violet-600">BREEVO</p>
          <h1 className="mt-1 text-xl font-bold text-slate-900">인플루언서 관리 어드민</h1>
          <p className="mt-2 text-sm text-slate-500">팀 계정으로 로그인하세요</p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            signIn(selected)
          }}
          className="space-y-4"
        >
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

          <Button type="submit" className="w-full" disabled={!selected}>
            로그인
          </Button>
        </form>

        <p className="mt-6 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-700">
          현재는 <b>미리보기 모드</b>입니다. 데이터는 이 브라우저에만 저장되며, Supabase 연결 후
          이메일·비밀번호 로그인과 팀 공유 데이터베이스로 전환됩니다.
        </p>
      </Card>
    </div>
  )
}
