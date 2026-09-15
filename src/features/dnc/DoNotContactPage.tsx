import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, Card, CardHeader, EmptyState, Input, Spinner, Textarea } from '@/components/ui'
import type { Influencer } from '@/data/types'
import DncChangeDialog from '@/features/dnc/DncChangeDialog'
import { useInfluencers, useTeamMembers } from '@/hooks/queries'
import { downloadCsv } from '@/utils/csv'
import { formatDateTime } from '@/utils/format'

const normalize = (value: string) => value.trim().toLowerCase().replace(/^@/, '')

export default function DoNotContactPage() {
  const { data: influencers, isLoading } = useInfluencers()
  const { data: members = [] } = useTeamMembers()
  const [keyword, setKeyword] = useState('')
  const [pasted, setPasted] = useState('')
  const [target, setTarget] = useState<Influencer | null>(null)

  const blocked = useMemo(
    () => (influencers ?? []).filter((influencer) => influencer.doNotContact),
    [influencers],
  )

  const filtered = useMemo(() => {
    const query = normalize(keyword)
    if (!query) return blocked
    return blocked.filter((influencer) =>
      `${influencer.name} ${influencer.snsHandle}`.toLowerCase().includes(query),
    )
  }, [blocked, keyword])

  /** 발송 명단을 붙여넣으면 연락 금지 대상이 섞여 있는지 대조한다. */
  const checkResult = useMemo(() => {
    const lines = pasted
      .split(/[\n,]/)
      .map((line) => normalize(line))
      .filter(Boolean)
    if (lines.length === 0) return null

    const hits = lines.filter((line) =>
      blocked.some(
        (influencer) =>
          normalize(influencer.snsHandle) === line || normalize(influencer.name) === line,
      ),
    )
    return { total: lines.length, hits: [...new Set(hits)] }
  }, [pasted, blocked])

  const nameOf = (userId: string | null) =>
    members.find((m) => m.id === userId)?.displayName ?? '알 수 없음'

  const exportCsv = () =>
    downloadCsv(
      '연락금지_목록',
      filtered.map((influencer) => ({
        이름: influencer.name,
        계정: influencer.snsHandle,
        사유: influencer.dncReason ?? '',
        등록자: nameOf(influencer.dncSetBy),
        등록일시: formatDateTime(influencer.dncSetAt),
      })),
    )

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">연락 금지 관리</h1>
          <p className="mt-1 text-sm text-slate-500">
            취소·거절 의사를 밝힌 크리에이터에게 다시 제안이 나가지 않도록 관리합니다.
          </p>
        </div>
        <Button variant="secondary" onClick={exportCsv} disabled={filtered.length === 0}>
          엑셀 다운로드
        </Button>
      </div>

      <Card>
        <CardHeader
          title="발송 전 명단 대조"
          description="보낼 명단을 붙여넣으면 연락 금지 대상이 섞여 있는지 확인합니다."
        />
        <div className="grid gap-4 p-5 md:grid-cols-2">
          <Textarea
            rows={5}
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
            placeholder={'계정 또는 이름을 한 줄에 하나씩 붙여넣기\n예)\nnalssin_cook\ndieter_jin'}
          />
          <div className="rounded-lg bg-slate-50 p-4 text-sm">
            {!checkResult ? (
              <p className="text-slate-400">왼쪽에 명단을 붙여넣어주세요.</p>
            ) : checkResult.hits.length === 0 ? (
              <p className="font-medium text-emerald-700">
                ✅ {checkResult.total}건 확인 — 연락 금지 대상이 없습니다.
              </p>
            ) : (
              <>
                <p className="font-medium text-rose-700">
                  ⛔ {checkResult.total}건 중 {checkResult.hits.length}건이 연락 금지 대상입니다.
                </p>
                <ul className="mt-2 space-y-1 text-rose-600">
                  {checkResult.hits.map((hit) => (
                    <li key={hit}>· {hit}</li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-slate-500">
                  위 계정은 발송 명단에서 제외해주세요.
                </p>
              </>
            )}
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader
          title={`연락 금지 목록 (${blocked.length}명)`}
          action={
            <div className="w-48">
              <Input
                placeholder="이름 · 계정 검색"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
              />
            </div>
          }
        />
        {isLoading ? (
          <Spinner />
        ) : filtered.length === 0 ? (
          <EmptyState
            title={blocked.length === 0 ? '연락 금지 대상이 없습니다' : '검색 결과가 없습니다'}
            description={
              blocked.length === 0
                ? '인플루언서 상세 화면에서 "연락 금지 등록"을 누르면 이곳에 모입니다.'
                : undefined
            }
          />
        ) : (
          <table className="w-full text-sm">
            <thead className="border-y border-slate-100 bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="px-5 py-2.5 text-left font-medium">이름 / 계정</th>
                <th className="px-3 py-2.5 text-left font-medium">사유</th>
                <th className="px-3 py-2.5 text-left font-medium">등록자</th>
                <th className="px-3 py-2.5 text-left font-medium">등록일시</th>
                <th className="px-5 py-2.5 text-right font-medium">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((influencer) => (
                <tr key={influencer.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3">
                    <Link
                      to={`/influencers/${influencer.id}`}
                      className="font-medium text-slate-900 hover:text-violet-600"
                    >
                      {influencer.name}
                    </Link>
                    <div className="text-xs text-slate-400">@{influencer.snsHandle}</div>
                  </td>
                  <td className="px-3 py-3 text-slate-700">{influencer.dncReason}</td>
                  <td className="px-3 py-3 text-slate-600">{nameOf(influencer.dncSetBy)}</td>
                  <td className="px-3 py-3 text-slate-500">
                    {formatDateTime(influencer.dncSetAt)}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <Button size="sm" variant="secondary" onClick={() => setTarget(influencer)}>
                      해제
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <DncChangeDialog
        influencer={target}
        open={target !== null}
        onClose={() => setTarget(null)}
      />
    </div>
  )
}
