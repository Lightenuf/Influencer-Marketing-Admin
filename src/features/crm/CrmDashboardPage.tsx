import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardHeader, EmptyState, Spinner } from '@/components/ui'
import { repository } from '@/data'
import { CHANNEL_LABELS, type Campaign } from '@/data/types'
import { daysSince, formatDate, formatNumber } from '@/utils/format'

/** 컨셉마다 색을 고정한다 — 캘린더와 표에서 같은 색으로 보여야 눈에 익는다 */
const CONCEPT_COLORS = [
  '#8b5cf6',
  '#14b8a6',
  '#f59e0b',
  '#ec4899',
  '#3b82f6',
  '#84cc16',
  '#f43f5e',
  '#a855f7',
]

const colorOf = (concept: string, all: string[]) =>
  CONCEPT_COLORS[Math.max(0, all.indexOf(concept)) % CONCEPT_COLORS.length]

/** 평균을 낼 때 쓰는 묶음 */
interface Group {
  key: string
  count: number
  target: number
  success: number
  visit: number
  purchase: number
  unsubscribe: number
  amount: number
}

const emptyGroup = (key: string): Group => ({
  key,
  count: 0,
  target: 0,
  success: 0,
  visit: 0,
  purchase: 0,
  unsubscribe: 0,
  amount: 0,
})

/**
 * 묶음별 평균 성과.
 * 캠페인마다의 비율을 평균내지 않고 전체 합으로 낸다 —
 * 100명에게 보낸 것과 10,000명에게 보낸 것을 같은 무게로 볼 수는 없다.
 */
function aggregate(campaigns: Campaign[], keysOf: (c: Campaign) => string[]): Group[] {
  const map = new Map<string, Group>()
  for (const c of campaigns) {
    for (const key of keysOf(c)) {
      if (!key) continue
      const group = map.get(key) ?? emptyGroup(key)
      group.count += 1
      group.target += c.targetCount
      group.success += c.successCount
      group.visit += c.visitCount
      group.purchase += c.purchaseCount
      group.unsubscribe += c.unsubscribeCount
      group.amount += c.purchaseAmount
      map.set(key, group)
    }
  }
  return [...map.values()].sort((a, b) => b.amount - a.amount || b.count - a.count)
}

export default function CrmDashboardPage() {
  const navigate = useNavigate()
  const [days, setDays] = useState(30)

  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ['campaigns'],
    queryFn: () => repository.listCampaigns(),
  })

  const sent = useMemo(() => campaigns.filter((c) => c.status === 'sent' && c.sentAt), [campaigns])

  const allConcepts = useMemo(() => [...new Set(sent.flatMap((c) => c.concepts))].sort(), [sent])

  const since = Date.now() - days * 86_400_000
  const recent = sent.filter((c) => new Date(c.sentAt!).getTime() >= since)

  const byConcept = aggregate(sent, (c) => c.concepts)
  const byPurpose = aggregate(sent, (c) => [c.purpose])
  const conceptShare = aggregate(recent, (c) => c.concepts)
  const shareTotal = conceptShare.reduce((sum, g) => sum + g.count, 0)

  const lastSentAt = sent[0]?.sentAt ?? null
  const untagged = campaigns.filter((c) => !c.purpose || c.concepts.length === 0).length

  if (isLoading) return <Spinner />

  if (sent.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-bold text-slate-900">CRM 대시보드</h1>
        <Card>
          <EmptyState
            title="아직 볼 기록이 없습니다"
            description="캠페인 관리에서 새로 보내거나, 아임웹 발송 내역을 CSV로 올리면 여기에 비교가 나옵니다."
          />
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-4 pb-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">CRM 대시보드</h1>
          <p className="mt-1 text-sm text-slate-500">
            어떤 메시지가 반응이 좋았는지, 지금 보내도 되는지 봅니다.
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <Kpi
          label="마지막 발송 후"
          value={lastSentAt ? `${daysSince(lastSentAt)}일` : '-'}
          sub={lastSentAt ? formatDate(lastSentAt) : undefined}
        />
        <Kpi label="보낸 캠페인" value={`${formatNumber(sent.length)}건`} />
        <Kpi
          label={`최근 ${days}일 발송`}
          value={`${formatNumber(recent.length)}건`}
          warn={recent.length >= 12}
        />
        <Kpi
          label="태깅 필요"
          value={`${formatNumber(untagged)}건`}
          warn={untagged > 0}
          onClick={untagged > 0 ? () => navigate('/crm/campaigns') : undefined}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <CompareCard
          title="컨셉별 평균 성과"
          description="줄을 누르면 그 컨셉의 캠페인만 봅니다"
          groups={byConcept}
          onPick={(key) => navigate(`/crm/campaigns?concept=${encodeURIComponent(key)}`)}
          colorOf={(key) => colorOf(key, allConcepts)}
        />
        <CompareCard
          title="목적별 평균 성과"
          description="줄을 누르면 그 목적의 캠페인만 봅니다"
          groups={byPurpose}
          onPick={(key) => navigate(`/crm/campaigns?purpose=${encodeURIComponent(key)}`)}
        />
      </div>

      <Card>
        <CardHeader
          title="컨셉 비율"
          description="할인에만 기대고 있지는 않은지 봅니다"
          action={
            <div className="flex gap-1">
              {[30, 90].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDays(d)}
                  className={`rounded-lg px-2.5 py-1 text-xs ${
                    days === d
                      ? 'bg-violet-100 font-medium text-violet-700'
                      : 'text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  {d}일
                </button>
              ))}
            </div>
          }
        />
        <div className="p-5">
          {shareTotal === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">
              최근 {days}일에 보낸 캠페인이 없습니다
            </p>
          ) : (
            <>
              <div className="flex h-6 overflow-hidden rounded-lg">
                {conceptShare.map((group) => (
                  <button
                    key={group.key}
                    type="button"
                    title={`${group.key} ${group.count}건`}
                    onClick={() =>
                      navigate(`/crm/campaigns?concept=${encodeURIComponent(group.key)}`)
                    }
                    style={{
                      width: `${(group.count / shareTotal) * 100}%`,
                      backgroundColor: colorOf(group.key, allConcepts),
                    }}
                  />
                ))}
              </div>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
                {conceptShare.map((group) => (
                  <button
                    key={group.key}
                    type="button"
                    onClick={() =>
                      navigate(`/crm/campaigns?concept=${encodeURIComponent(group.key)}`)
                    }
                    className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-violet-600"
                  >
                    <span
                      className="h-2.5 w-2.5 rounded-sm"
                      style={{ backgroundColor: colorOf(group.key, allConcepts) }}
                    />
                    {group.key} {Math.round((group.count / shareTotal) * 100)}%
                    <span className="text-slate-400">({group.count}건)</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </Card>

      <SendCalendar
        campaigns={sent}
        colorOf={(key) => colorOf(key, allConcepts)}
        onPick={(id) => navigate(`/crm/campaigns/${id}`)}
      />
    </div>
  )
}

function CompareCard({
  title,
  description,
  groups,
  onPick,
  colorOf,
}: {
  title: string
  description: string
  groups: Group[]
  onPick: (key: string) => void
  colorOf?: (key: string) => string
}) {
  const best = Math.max(1, ...groups.map((g) => g.amount))

  return (
    <Card>
      <CardHeader title={title} description={description} />
      {groups.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-slate-400">
          아직 분류된 캠페인이 없습니다
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="border-y border-slate-100 bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="px-5 py-2 text-left font-medium">분류</th>
                <th className="px-2 py-2 text-right font-medium">건수</th>
                <th className="px-2 py-2 text-right font-medium whitespace-nowrap">성공률</th>
                <th className="px-2 py-2 text-right font-medium whitespace-nowrap">유입률</th>
                <th className="px-2 py-2 text-right font-medium whitespace-nowrap">구매 전환</th>
                <th className="px-2 py-2 text-right font-medium whitespace-nowrap">수신거부</th>
                <th className="px-5 py-2 text-right font-medium">매출</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {groups.map((group) => (
                <tr
                  key={group.key}
                  onClick={() => onPick(group.key)}
                  className="cursor-pointer hover:bg-slate-50"
                >
                  <td className="px-5 py-2.5">
                    <span className="flex items-center gap-1.5 font-medium text-slate-800">
                      {colorOf && (
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-sm"
                          style={{ backgroundColor: colorOf(group.key) }}
                        />
                      )}
                      {group.key}
                    </span>
                  </td>
                  <td className="tabular px-2 py-2.5 text-right text-slate-500">{group.count}</td>
                  <td className="tabular px-2 py-2.5 text-right text-slate-600">
                    {pct(group.success, group.target)}
                  </td>
                  <td className="tabular px-2 py-2.5 text-right text-slate-600">
                    {pct(group.visit, group.success)}
                  </td>
                  <td className="tabular px-2 py-2.5 text-right font-medium text-violet-600">
                    {pct(group.purchase, group.success)}
                  </td>
                  <td className="tabular px-2 py-2.5 text-right text-slate-500">
                    {pct(group.unsubscribe, group.success, 2)}
                  </td>
                  <td className="tabular px-5 py-2.5 text-right whitespace-nowrap">
                    <span className="relative inline-block">
                      <span
                        className="absolute inset-y-0 right-0 rounded-sm bg-violet-100"
                        style={{ width: `${(group.amount / best) * 100}%` }}
                      />
                      <span className="relative px-1 text-slate-800">
                        {formatNumber(group.amount)}원
                      </span>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}

const pct = (top: number, bottom: number, digits = 1) =>
  bottom > 0 ? `${((top / bottom) * 100).toFixed(digits)}%` : '-'

/** 언제 무엇을 보냈는지 한 달을 한눈에 */
function SendCalendar({
  campaigns,
  colorOf,
  onPick,
}: {
  campaigns: Campaign[]
  colorOf: (key: string) => string
  onPick: (id: string) => void
}) {
  const [offset, setOffset] = useState(0)

  const base = new Date()
  base.setDate(1)
  base.setMonth(base.getMonth() + offset)
  const year = base.getFullYear()
  const month = base.getMonth()

  const firstWeekday = new Date(year, month, 1).getDay()
  const lastDate = new Date(year, month + 1, 0).getDate()

  const byDay = new Map<number, Campaign[]>()
  for (const c of campaigns) {
    const when = new Date(c.sentAt!)
    if (when.getFullYear() !== year || when.getMonth() !== month) continue
    const day = when.getDate()
    byDay.set(day, [...(byDay.get(day) ?? []), c])
  }

  const cells: (number | null)[] = [
    ...Array<null>(firstWeekday).fill(null),
    ...Array.from({ length: lastDate }, (_, i) => i + 1),
  ]

  return (
    <Card>
      <CardHeader
        title="발송 캘린더"
        description="컨셉 색으로 표시합니다. 누르면 그 캠페인으로 갑니다"
        action={
          <div className="flex items-center gap-1 text-sm">
            <button
              type="button"
              onClick={() => setOffset((o) => o - 1)}
              className="rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100"
            >
              ‹
            </button>
            <span className="w-24 text-center text-slate-700">
              {year}년 {month + 1}월
            </span>
            <button
              type="button"
              onClick={() => setOffset((o) => o + 1)}
              className="rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100"
            >
              ›
            </button>
          </div>
        }
      />
      <div className="p-5">
        <div className="grid grid-cols-7 gap-1 text-center text-xs text-slate-400">
          {['일', '월', '화', '수', '목', '금', '토'].map((day) => (
            <div key={day} className="pb-1">
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((day, i) => (
            <div
              key={i}
              className={`min-h-[76px] rounded-lg border p-1.5 ${
                day ? 'border-slate-100' : 'border-transparent'
              }`}
            >
              {day && (
                <>
                  <div className="text-[11px] text-slate-400">{day}</div>
                  <div className="mt-0.5 space-y-0.5">
                    {(byDay.get(day) ?? []).slice(0, 3).map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => onPick(c.id)}
                        title={`${c.title || '(제목 없음)'} · ${CHANNEL_LABELS[c.channel]}`}
                        className="block w-full truncate rounded px-1 py-0.5 text-left text-[10px] text-white"
                        style={{
                          backgroundColor: c.concepts[0] ? colorOf(c.concepts[0]) : '#cbd5e1',
                        }}
                      >
                        {c.title || '(제목 없음)'}
                      </button>
                    ))}
                    {(byDay.get(day) ?? []).length > 3 && (
                      <div className="px-1 text-[10px] text-slate-400">
                        +{(byDay.get(day) ?? []).length - 3}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </Card>
  )
}

function Kpi({
  label,
  value,
  sub,
  warn,
  onClick,
}: {
  label: string
  value: string
  sub?: string
  warn?: boolean
  onClick?: () => void
}) {
  const inner = (
    <>
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`mt-0.5 text-2xl font-bold ${warn ? 'text-amber-600' : 'text-slate-900'}`}>
        {value}
      </p>
      {sub && <p className="text-xs text-slate-400">{sub}</p>}
    </>
  )
  return onClick ? (
    <button
      type="button"
      onClick={onClick}
      className="rounded-xl border border-slate-200 bg-white p-4 text-left hover:border-violet-300"
    >
      {inner}
    </button>
  ) : (
    <div className="rounded-xl border border-slate-200 bg-white p-4">{inner}</div>
  )
}
