import clsx from 'clsx'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Card, Spinner } from '@/components/ui'
import { useCollabs, useInfluencers } from '@/hooks/queries'

/**
 * 캘린더에는 마켓만 남긴다.
 * 미팅·샘플 발송 같은 일정은 카드에서 보고, 여기서는 언제 마켓이 열리는지만 본다.
 */
type EventKind = '마켓 예정' | '마켓 진행'

const kindTone: Record<EventKind, string> = {
  '마켓 예정': 'bg-violet-500 text-white hover:bg-violet-600',
  '마켓 진행': 'bg-emerald-500 text-white hover:bg-emerald-600',
}

const legendTone: Record<EventKind, string> = {
  '마켓 예정': 'bg-violet-100 text-violet-700',
  '마켓 진행': 'bg-emerald-100 text-emerald-700',
}

/** 마켓 하나 — 시작일부터 종료일까지 이어지는 한 줄 */
interface MarketBar {
  id: string
  influencerId: string
  label: string
  kind: EventKind
  /** YYYY-MM-DD */
  start: string
  end: string
}

/** 한 주 안에서 막대가 차지하는 자리 */
interface Segment extends MarketBar {
  /** 그 주의 몇 번째 칸에서 시작하는지 (0=일요일) */
  column: number
  /** 몇 칸을 차지하는지 */
  span: number
  /** 몇 번째 줄에 놓이는지 — 겹치는 마켓은 아래 줄로 내려간다 */
  lane: number
  /** 앞뒤 주로 이어지는지 — 잘린 쪽은 모서리를 펴서 계속됨을 보인다 */
  continuesBefore: boolean
  continuesAfter: boolean
}

/** 한 주에 몇 줄까지 보여줄지. 넘치면 '+N' 으로 알린다. */
const MAX_LANES = 3

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

const toKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

const addDays = (date: Date, days: number) => {
  const next = new Date(date)
  next.setDate(date.getDate() + days)
  return next
}

/**
 * 겹치지 않게 줄을 나눠준다.
 * 먼저 시작하는 막대부터 자리를 잡고, 이미 찬 줄은 건너뛴다.
 */
function assignLanes(bars: Segment[]): Segment[] {
  // 줄마다 '지금까지 찬 칸'의 끝을 기억한다.
  const lanes: number[] = []
  return bars
    .slice()
    .sort((a, b) => a.column - b.column || b.span - a.span)
    .map((bar) => {
      let lane = lanes.findIndex((filledUntil) => filledUntil <= bar.column)
      if (lane === -1) {
        lane = lanes.length
        lanes.push(0)
      }
      lanes[lane] = bar.column + bar.span
      return { ...bar, lane }
    })
}

export default function CalendarPage({
  /** 다른 화면 안에 들어갈 때는 제목을 숨긴다 — 그 화면의 제목이 이미 있다 */
  embedded = false,
}: {
  embedded?: boolean
} = {}) {
  const { data: collabs, isLoading } = useCollabs()
  const { data: influencers = [] } = useInfluencers()
  const navigate = useNavigate()
  const [cursor, setCursor] = useState(() => new Date())

  const bars = useMemo<MarketBar[]>(() => {
    const nameOf = (id: string) => influencers.find((i) => i.id === id)?.name ?? '?'
    const list: MarketBar[] = []

    for (const collab of collabs ?? []) {
      if (collab.isCancelled || !collab.marketDate) continue
      const start = collab.marketDate.slice(0, 10)
      const end = (collab.marketEndDate ?? collab.marketDate).slice(0, 10)
      list.push({
        id: collab.id,
        influencerId: collab.influencerId,
        label: nameOf(collab.influencerId),
        // 마친 마켓은 실제 진행한 날, 준비 중인 마켓은 예정일로 본다.
        kind: collab.stage === '마켓 완료' ? '마켓 진행' : '마켓 예정',
        // 날짜를 거꾸로 적었어도 그림이 깨지지 않게 바로 세운다.
        start: start <= end ? start : end,
        end: start <= end ? end : start,
      })
    }
    return list
  }, [collabs, influencers])

  /** 달력에 보이는 6주. 각 주는 일요일부터 7일. */
  const weeks = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1)
    const start = addDays(first, -first.getDay())
    return Array.from({ length: 6 }, (_, weekIndex) =>
      Array.from({ length: 7 }, (_, dayIndex) => addDays(start, weekIndex * 7 + dayIndex)),
    )
  }, [cursor])

  /** 주마다 막대를 잘라 자리를 정한다 */
  const segmentsByWeek = useMemo(
    () =>
      weeks.map((week) => {
        const weekStart = toKey(week[0])
        const weekEnd = toKey(week[6])

        const inWeek = bars
          .filter((bar) => bar.start <= weekEnd && bar.end >= weekStart)
          .map((bar) => {
            const from = bar.start < weekStart ? weekStart : bar.start
            const to = bar.end > weekEnd ? weekEnd : bar.end
            const column = week.findIndex((day) => toKey(day) === from)
            const lastColumn = week.findIndex((day) => toKey(day) === to)
            return {
              ...bar,
              column,
              span: lastColumn - column + 1,
              lane: 0,
              continuesBefore: bar.start < weekStart,
              continuesAfter: bar.end > weekEnd,
            }
          })

        return assignLanes(inWeek)
      }),
    [weeks, bars],
  )

  const todayKey = toKey(new Date())
  const shiftMonth = (delta: number) =>
    setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + delta, 1))

  return (
    <div className="space-y-4">
      {!embedded && (
        <div>
          <h1 className="text-xl font-bold text-slate-900">캘린더</h1>
          <p className="mt-1 text-sm text-slate-500">
            마켓 예정일과 실제 진행한 날을 한눈에 확인하세요.
          </p>
        </div>
      )}

      <Card>
        <div className="flex items-center justify-between px-5 py-4">
          <h2 className="text-lg font-bold text-slate-900">
            {cursor.getFullYear()}년 {cursor.getMonth() + 1}월
          </h2>
          <div className="flex gap-1.5">
            <Button variant="secondary" size="sm" onClick={() => setCursor(new Date())}>
              오늘
            </Button>
            <Button variant="secondary" size="sm" onClick={() => shiftMonth(-1)}>
              ‹
            </Button>
            <Button variant="secondary" size="sm" onClick={() => shiftMonth(1)}>
              ›
            </Button>
          </div>
        </div>

        {isLoading ? (
          <Spinner />
        ) : (
          <div className="border-t border-slate-100">
            <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50">
              {WEEKDAYS.map((day, index) => (
                <div
                  key={day}
                  className={clsx(
                    'py-2 text-center text-xs font-medium',
                    index === 0 && 'text-rose-500',
                    index === 6 && 'text-sky-500',
                    index > 0 && index < 6 && 'text-slate-500',
                  )}
                >
                  {day}
                </div>
              ))}
            </div>

            {weeks.map((week, weekIndex) => {
              const segments = segmentsByWeek[weekIndex]
              const shown = segments.filter((segment) => segment.lane < MAX_LANES)
              const hiddenCount = segments.length - shown.length

              return (
                <div key={toKey(week[0])} className="relative">
                  {/* 날짜 칸 — 막대가 그 위에 놓인다 */}
                  <div className="grid grid-cols-7">
                    {week.map((date) => {
                      const key = toKey(date)
                      const isCurrentMonth = date.getMonth() === cursor.getMonth()
                      return (
                        <div
                          key={key}
                          className={clsx(
                            'min-h-24 border-r border-b border-slate-100 p-1.5',
                            !isCurrentMonth && 'bg-slate-50/60',
                            key === todayKey && 'bg-violet-50/60',
                          )}
                        >
                          <span
                            className={clsx(
                              'text-xs',
                              isCurrentMonth ? 'text-slate-600' : 'text-slate-300',
                              key === todayKey && 'font-bold text-violet-700',
                            )}
                          >
                            {date.getDate()}
                          </span>
                        </div>
                      )
                    })}
                  </div>

                  {/* 마켓 막대 — 시작일부터 종료일까지 한 줄로 잇는다 */}
                  <div className="pointer-events-none absolute inset-x-0 top-7 grid grid-cols-7 gap-y-0.5 px-1">
                    {shown.map((segment) => (
                      <button
                        key={`${segment.id}-${segment.column}`}
                        onClick={() => navigate(`/influencers/${segment.influencerId}`)}
                        title={`${segment.label} · ${segment.kind} (${segment.start} ~ ${segment.end})`}
                        style={{
                          gridColumn: `${segment.column + 1} / span ${segment.span}`,
                          gridRow: segment.lane + 1,
                        }}
                        className={clsx(
                          'pointer-events-auto truncate px-1.5 py-0.5 text-left text-[11px] font-medium transition',
                          kindTone[segment.kind],
                          // 다음 주로 이어지는 쪽은 모서리를 펴서 계속됨을 보인다
                          segment.continuesBefore ? 'rounded-l-none' : 'rounded-l',
                          segment.continuesAfter ? 'rounded-r-none' : 'rounded-r',
                        )}
                      >
                        {segment.continuesBefore ? '‹ ' : ''}
                        {segment.label}
                      </button>
                    ))}

                    {hiddenCount > 0 && (
                      <span
                        style={{ gridColumn: '1 / span 7', gridRow: MAX_LANES + 1 }}
                        className="px-1.5 text-[11px] text-slate-400"
                      >
                        +{hiddenCount}건 더
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      <div className="flex flex-wrap gap-2 text-xs">
        {(Object.keys(legendTone) as EventKind[]).map((kind) => (
          <span key={kind} className={clsx('rounded px-2 py-1', legendTone[kind])}>
            {kind}
          </span>
        ))}
      </div>
    </div>
  )
}
