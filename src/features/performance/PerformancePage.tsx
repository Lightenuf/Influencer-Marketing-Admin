import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import MonthPicker, { monthKeyOf } from '@/components/MonthPicker'
import { Button, Card, CardHeader, EmptyState, Input, Spinner } from '@/components/ui'
import { PRODUCTS, type Collab } from '@/data/types'
import CalendarPage from '@/features/calendar/CalendarPage'
import MarketResultDialog from '@/features/pipeline/MarketResultDialog'
import { useCollabs, useInfluencers, useUpdateCollab } from '@/hooks/queries'
import { downloadCsv } from '@/utils/csv'
import { daysUntil, formatDate, formatNumber } from '@/utils/format'
import { profileUrl } from '@/utils/profileLink'

/** 링크는 표 안에서 바로 덧붙이고 지운다 — 성과를 보다가 떠오를 때 남길 수 있게. */
function ContentLinks({ collab }: { collab: Collab }) {
  const update = useUpdateCollab()
  const [draft, setDraft] = useState('')

  const save = (links: string[]) => update.mutate({ id: collab.id, patch: { contentLinks: links } })

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

/** 목표 매출 — 만원 단위로 적고 원으로 저장한다 */
function TargetRevenueCell({ collab }: { collab: Collab }) {
  const update = useUpdateCollab()
  const shown = collab.targetRevenue ? String(Math.round(collab.targetRevenue / 10_000)) : ''
  const [draft, setDraft] = useState(shown)

  useEffect(() => setDraft(shown), [shown])

  const commit = () => {
    const next = (Number(draft.replace(/[^\d]/g, '')) || 0) * 10_000
    if (next !== collab.targetRevenue) {
      update.mutate({ id: collab.id, patch: { targetRevenue: next } })
    }
  }

  return (
    <div className="flex items-center justify-end gap-1">
      <input
        inputMode="numeric"
        value={draft}
        onChange={(e) => setDraft(e.target.value.replace(/[^\d]/g, ''))}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
        }}
        placeholder="0"
        className="w-20 rounded-md border border-slate-200 bg-white px-2 py-1 text-right text-sm text-slate-700 focus:border-violet-400 focus:outline-none"
      />
      <span className="shrink-0 text-xs whitespace-nowrap text-slate-400">만원</span>
    </div>
  )
}

/**
 * 예상 소요량 — 평소에는 합계만 보이고, 누르면 맛별로 펼쳐 적는다.
 * 표가 길어지지 않게 하면서도 맛마다 몇 개인지 적을 수 있게 하기 위함.
 */
function PlannedUnitsCell({ collab }: { collab: Collab }) {
  const update = useUpdateCollab()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<Record<string, string>>({})

  useEffect(() => {
    setDraft(
      Object.fromEntries(
        PRODUCTS.map((product) => [
          product,
          collab.plannedUnits?.[product] ? String(collab.plannedUnits[product]) : '',
        ]),
      ),
    )
  }, [collab.plannedUnits])

  const commit = () => {
    const next: Record<string, number> = {}
    for (const product of PRODUCTS) {
      const count = Number((draft[product] ?? '').replace(/[^\d]/g, '')) || 0
      if (count > 0) next[product] = count
    }
    if (JSON.stringify(next) !== JSON.stringify(collab.plannedUnits ?? {})) {
      update.mutate({ id: collab.id, patch: { plannedUnits: next } })
    }
  }

  const total = PRODUCTS.reduce(
    (sum, product) => sum + (Number((draft[product] ?? '').replace(/[^\d]/g, '')) || 0),
    0,
  )

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 text-sm text-slate-700 hover:text-violet-600"
        title="맛별로 적기"
      >
        <span className="tabular">{total > 0 ? `${formatNumber(total)}개` : '적기'}</span>
        <span className="text-xs text-slate-400">{open ? '▴' : '▾'}</span>
      </button>

      {open && (
        <div className="flex flex-col gap-1">
          {PRODUCTS.map((product) => (
            <label key={product} className="flex items-center justify-end gap-1">
              <span className="shrink-0 text-xs whitespace-nowrap text-slate-500">{product}</span>
              <input
                inputMode="numeric"
                value={draft[product] ?? ''}
                onChange={(e) =>
                  setDraft((current) => ({
                    ...current,
                    [product]: e.target.value.replace(/[^\d]/g, ''),
                  }))
                }
                onBlur={commit}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.currentTarget.blur()
                }}
                placeholder="0"
                className="w-16 rounded-md border border-slate-200 bg-white px-2 py-1 text-right text-sm text-slate-700 focus:border-violet-400 focus:outline-none"
              />
              <span className="shrink-0 text-xs text-slate-400">개</span>
            </label>
          ))}
        </div>
      )}
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

  /**
   * 아직 열지 않은 마켓 — 달과 상관없이 준비 중인 것을 모두 본다.
   * 곧 열리는 것부터 본다. 날짜를 아직 안 잡은 건은 맨 뒤로 보낸다.
   */
  const waiting = useMemo(
    () =>
      (collabs ?? [])
        .filter((collab) => collab.stage === '마켓 준비 중' && !collab.isCancelled)
        .sort((a, b) => {
          if (!a.marketDate) return b.marketDate ? 1 : a.sortOrder - b.sortOrder
          if (!b.marketDate) return -1
          return a.marketDate.localeCompare(b.marketDate)
        }),
    [collabs],
  )

  /** 준비 중인 마켓을 다 더하면 이번에 얼마를 내고 몇 개가 나갈지가 나온다 */
  const waitingTotals = useMemo(() => {
    const byProduct: Record<string, number> = {}
    let revenue = 0
    for (const collab of waiting) {
      revenue += collab.targetRevenue
      for (const product of PRODUCTS) {
        const count = collab.plannedUnits?.[product] ?? 0
        if (count > 0) byProduct[product] = (byProduct[product] ?? 0) + count
      }
    }
    const units = Object.values(byProduct).reduce((sum, count) => sum + count, 0)
    return { revenue, byProduct, units }
  }, [waiting])

  const totals = useMemo(
    () =>
      done.reduce(
        (sum, collab) => ({
          revenue: sum.revenue + collab.marketRevenue,
          units: sum.units + collab.marketUnits,
          settled: sum.settled + (collab.isSettled ? collab.marketRevenue : 0),
          settlement: sum.settlement + collab.settlementAmount,
        }),
        { revenue: 0, units: 0, settled: 0, settlement: 0 },
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
          정산액: collab.settlementAmount,
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
          <h1 className="text-xl font-bold text-slate-900">마켓 관리</h1>
          <p className="mt-1 text-sm text-slate-500">
            마켓을 마친 협업의 매출을 모아 봅니다. 다음 시딩 대상을 고를 때 기준이 됩니다.
          </p>
        </div>
        <Button variant="secondary" onClick={exportCsv} disabled={done.length === 0}>
          엑셀 다운로드
        </Button>
      </div>

      <MonthPicker value={month} onChange={setMonth} />

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Card className="p-5">
          <p className="text-sm text-slate-500">
            {month ? `${month.getMonth() + 1}월 공동구매 총매출` : '전체 기간 총매출'}
          </p>
          <p className="mt-1 text-2xl font-bold text-slate-900">
            {formatNumber(totals.revenue)}
            <span className="ml-1 text-base font-semibold text-slate-500">원</span>
          </p>
          <p className="mt-0.5 text-xs text-slate-400">
            정산액 {formatNumber(totals.settlement)}원 · 남은 금액{' '}
            {formatNumber(totals.revenue - totals.settlement)}원
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-slate-500">진행 예정 마켓</p>
          <p className="mt-1 text-2xl font-bold text-violet-700">
            {formatNumber(waiting.length)}건
          </p>
          <p className="mt-0.5 text-xs text-slate-400">달과 상관없이 준비 중인 전체</p>
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
        <CardHeader
          title={`마켓 준비 ${formatNumber(waiting.length)}건`}
          description="아직 열지 않은 마켓입니다. 곧 열리는 순서로 보이며, 달을 바꿔도 그대로입니다"
        />

        {waiting.length > 0 && (
          <div className="flex flex-wrap items-end gap-x-8 gap-y-3 border-b border-slate-100 bg-slate-50 px-5 py-3">
            <div>
              <p className="text-xs text-slate-500">예상 매출</p>
              <p className="mt-0.5 text-xl font-bold text-slate-900">
                {formatNumber(waitingTotals.revenue)}
                <span className="ml-0.5 text-sm font-semibold text-slate-500">원</span>
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">예상 소요량</p>
              <p className="mt-0.5 text-xl font-bold text-slate-900">
                {formatNumber(waitingTotals.units)}
                <span className="ml-0.5 text-sm font-semibold text-slate-500">개</span>
              </p>
            </div>
            {PRODUCTS.map((product) => (
              <div key={product}>
                <p className="text-xs text-slate-500">{product}</p>
                <p className="mt-0.5 text-base font-medium text-slate-700">
                  {formatNumber(waitingTotals.byProduct[product] ?? 0)}
                  <span className="ml-0.5 text-xs text-slate-400">개</span>
                </p>
              </div>
            ))}
          </div>
        )}
        {waiting.length === 0 ? (
          <EmptyState
            title="준비 중인 마켓이 없습니다"
            description="파이프라인에서 '마켓 준비 중'으로 옮기면 이곳에 나타납니다."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-y border-slate-100 bg-slate-50 text-xs text-slate-500">
                <tr>
                  <th className="px-5 py-2.5 text-left font-medium">크리에이터</th>
                  <th className="px-3 py-2.5 text-left font-medium whitespace-nowrap">
                    마켓 예정일
                  </th>
                  <th className="px-3 py-2.5 text-right font-medium whitespace-nowrap">
                    목표 매출
                  </th>
                  <th className="px-3 py-2.5 text-right font-medium whitespace-nowrap">
                    예상 소요량
                  </th>
                  <th className="px-5 py-2.5 text-right font-medium">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {waiting.map((collab) => {
                  const influencer = nameOf(collab.influencerId)
                  const left = collab.marketDate ? daysUntil(collab.marketDate) : null
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
                          <div className="text-xs text-slate-400">@{influencer.snsHandle}</div>
                        )}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-slate-600">
                        {formatDate(collab.marketDate)}{' '}
                        {left !== null && (
                          <span
                            className={
                              left <= 3 && left >= 0
                                ? 'ml-1 text-xs font-medium text-amber-600'
                                : 'ml-1 text-xs text-slate-400'
                            }
                          >
                            {left > 0 ? `D-${left}` : left === 0 ? '오늘' : `${-left}일 지남`}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right whitespace-nowrap">
                        <TargetRevenueCell collab={collab} />
                      </td>
                      <td className="px-3 py-3 text-right whitespace-nowrap">
                        <PlannedUnitsCell collab={collab} />
                      </td>
                      <td className="px-5 py-3 text-right">
                        <Button size="sm" onClick={() => setEditing(collab)}>
                          마켓 완료 처리
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

      <Card>
        <CardHeader title="크리에이터별 성과" description="매출이 큰 순서" />
        {done.length === 0 ? (
          <EmptyState
            title={monthKey ? '이 달에 마친 마켓이 없습니다' : '아직 마친 마켓이 없습니다'}
            description="파이프라인 '마켓 준비 중' 카드에서 '마켓 완료 처리'를 누르면 이곳에 쌓입니다."
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
                  <th className="px-3 py-2.5 text-right font-medium">정산액</th>
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
                      <td className="tabular px-3 py-3 text-right whitespace-nowrap text-slate-600">
                        {collab.settlementAmount > 0 ? formatNumber(collab.settlementAmount) : '-'}
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

      <div className="border-t border-slate-200 pt-6">
        <h2 className="text-lg font-bold text-slate-900">캘린더</h2>
        <p className="mt-1 text-sm text-slate-500">
          마켓 예정일, 미팅 날짜, 샘플 배송일을 한눈에 봅니다.
        </p>
      </div>

      <CalendarPage embedded />

      <MarketResultDialog
        collab={editing}
        open={editing !== null}
        onClose={() => setEditing(null)}
      />
    </div>
  )
}
