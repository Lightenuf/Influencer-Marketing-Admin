import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import MonthPicker, { monthKeyOf } from '@/components/MonthPicker'
import { Button, Card, CardHeader, EmptyState, Input, Spinner } from '@/components/ui'
import type { Collab } from '@/data/types'
import MarketResultDialog from '@/features/pipeline/MarketResultDialog'
import { useCollabs, useInfluencers, useUpdateCollab } from '@/hooks/queries'
import { downloadCsv } from '@/utils/csv'
import { formatDate, formatNumber } from '@/utils/format'
import { profileUrl } from '@/utils/profileLink'

/** 링크는 표 안에서 바로 덧붙이고 지운다 — 성과를 보다가 떠오를 때 남길 수 있게. */
function ContentLinks({ collab }: { collab: Collab }) {
  const update = useUpdateCollab()
  const [draft, setDraft] = useState('')

  const save = (links: string[]) =>
    update.mutate({ id: collab.id, patch: { contentLinks: links } })

  const add = () => {
    const url = draft.trim()
    if (!url || collab.contentLinks.includes(url)) return
    save([...collab.contentLinks, url])
    setDraft('')
  }

  return (
    <div className="space-y-1.5">
      {collab.contentLinks.map((url, index) => (
        <div key={url} className="flex items-center gap-1.5">
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            title={url}
            className="max-w-56 truncate text-xs text-violet-600 hover:underline"
          >
            콘텐츠 {index + 1} — {url.replace(/^https?:\/\/(www\.)?/, '')}
          </a>
          <button
            type="button"
            onClick={() => save(collab.contentLinks.filter((item) => item !== url))}
            className="text-xs text-slate-300 hover:text-rose-500"
          >
            ×
          </button>
        </div>
      ))}

      <div className="flex gap-1.5">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              add()
            }
          }}
          placeholder="콘텐츠 링크 붙여넣기"
          className="py-1 text-xs"
        />
        <Button type="button" size="sm" variant="secondary" onClick={add} disabled={!draft.trim()}>
          추가
        </Button>
      </div>
    </div>
  )
}

export default function PerformancePage() {
  const { data: collabs, isLoading } = useCollabs()
  const { data: influencers = [] } = useInfluencers()
  const [month, setMonth] = useState<Date | null>(() => new Date())
  const [editing, setEditing] = useState<Collab | null>(null)

  const monthKey = monthKeyOf(month)

  const done = useMemo(() => {
    const list = (collabs ?? []).filter((collab) => collab.stage === '마켓 완료')
    return list
      .filter(
        (collab) => !monthKey || (collab.marketDate ?? collab.updatedAt).slice(0, 7) === monthKey,
      )
      .sort((a, b) => b.marketRevenue - a.marketRevenue)
  }, [collabs, monthKey])

  const totals = useMemo(
    () =>
      done.reduce(
        (sum, collab) => ({
          revenue: sum.revenue + collab.marketRevenue,
          units: sum.units + collab.marketUnits,
          settled: sum.settled + (collab.isSettled ? collab.marketRevenue : 0),
        }),
        { revenue: 0, units: 0, settled: 0 },
      ),
    [done],
  )

  const nameOf = (id: string) => influencers.find((i) => i.id === id)

  const exportCsv = () =>
    downloadCsv(
      `마켓성과_${monthKey ?? '전체'}`,
      done.map((collab) => {
        const influencer = nameOf(collab.influencerId)
        return {
          크리에이터: influencer?.name ?? '',
          계정: influencer?.snsHandle ?? '',
          마켓일: formatDate(collab.marketDate),
          매출: collab.marketRevenue,
          판매수량: collab.marketUnits,
          정산: collab.isSettled ? 'Y' : 'N',
          콘텐츠링크: collab.contentLinks.join(' '),
        }
      }),
    )

  if (isLoading) return <Spinner />

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">마켓 성과</h1>
          <p className="mt-1 text-sm text-slate-500">
            마켓을 마친 협업의 매출을 모아 봅니다. 다음 시딩 대상을 고를 때 기준이 됩니다.
          </p>
        </div>
        <Button variant="secondary" onClick={exportCsv} disabled={done.length === 0}>
          엑셀 다운로드
        </Button>
      </div>

      <MonthPicker value={month} onChange={setMonth} />

      <div className="grid gap-3 md:grid-cols-4">
        <Card className="p-5 md:col-span-2">
          <p className="text-sm text-slate-500">
            {month ? `${month.getMonth() + 1}월 공동구매 총매출` : '전체 기간 총매출'}
          </p>
          <p className="mt-1 text-3xl font-bold text-slate-900">
            {formatNumber(totals.revenue)}
            <span className="ml-1 text-lg font-semibold text-slate-500">원</span>
          </p>
          <p className="mt-0.5 text-xs text-slate-400">
            정산 완료 {formatNumber(totals.settled)}원 · 미정산{' '}
            {formatNumber(totals.revenue - totals.settled)}원
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-slate-500">진행한 마켓</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{formatNumber(done.length)}건</p>
          <p className="mt-0.5 text-xs text-slate-400">
            평균 {formatNumber(done.length ? Math.round(totals.revenue / done.length) : 0)}원
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-slate-500">판매 수량</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{formatNumber(totals.units)}개</p>
        </Card>
      </div>

      <Card>
        <CardHeader title="크리에이터별 성과" description="매출이 큰 순서" />
        {done.length === 0 ? (
          <EmptyState
            title={monthKey ? '이 달에 마친 마켓이 없습니다' : '아직 마친 마켓이 없습니다'}
            description="파이프라인 '마켓 대기중' 카드에서 '마켓 완료 처리'를 누르면 이곳에 쌓입니다."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-y border-slate-100 bg-slate-50 text-xs text-slate-500">
                <tr>
                  <th className="px-5 py-2.5 text-left font-medium">크리에이터</th>
                  <th className="px-3 py-2.5 text-left font-medium">마켓일</th>
                  <th className="px-3 py-2.5 text-right font-medium">매출</th>
                  <th className="px-3 py-2.5 text-right font-medium">수량</th>
                  <th className="px-3 py-2.5 text-left font-medium">정산</th>
                  <th className="px-3 py-2.5 text-left font-medium">콘텐츠 링크</th>
                  <th className="px-5 py-2.5 text-right font-medium">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {done.map((collab) => {
                  const influencer = nameOf(collab.influencerId)
                  const url = influencer
                    ? profileUrl(influencer.snsPlatform, influencer.snsHandle, influencer.snsUrl)
                    : null
                  return (
                    <tr key={collab.id} className="hover:bg-slate-50">
                      <td className="px-5 py-3">
                        <Link
                          to={`/influencers/${collab.influencerId}/edit`}
                          className="font-medium text-slate-900 hover:text-violet-600"
                        >
                          {influencer?.name ?? '삭제된 크리에이터'}
                        </Link>
                        {influencer && (
                          <div className="text-xs text-slate-400">
                            {url ? (
                              <a
                                href={url}
                                target="_blank"
                                rel="noreferrer"
                                className="hover:text-violet-600 hover:underline"
                              >
                                @{influencer.snsHandle}
                              </a>
                            ) : (
                              `@${influencer.snsHandle}`
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-3 text-slate-500">{formatDate(collab.marketDate)}</td>
                      <td className="tabular px-3 py-3 text-right font-medium text-slate-900">
                        {formatNumber(collab.marketRevenue)}
                      </td>
                      <td className="tabular px-3 py-3 text-right text-slate-600">
                        {formatNumber(collab.marketUnits)}
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={
                            collab.isSettled
                              ? 'rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700'
                              : 'rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500'
                          }
                        >
                          {collab.isSettled ? '완료' : '전'}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <ContentLinks collab={collab} />
                      </td>
                      <td className="px-5 py-3 text-right">
                        <Button size="sm" variant="secondary" onClick={() => setEditing(collab)}>
                          수정
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <MarketResultDialog
        collab={editing}
        open={editing !== null}
        onClose={() => setEditing(null)}
      />
    </div>
  )
}
