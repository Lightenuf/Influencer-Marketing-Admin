import clsx from 'clsx'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Card, Spinner } from '@/components/ui'
import { useCollabs, useInfluencers, useShipments } from '@/hooks/queries'

type EventKind = '협업 시작' | '협업 종료' | '샘플 발송' | '콘텐츠 마감' | '출고'

interface CalendarEvent {
  date: string
  kind: EventKind
  label: string
  influencerId: string
}

const kindTone: Record<EventKind, string> = {
  '협업 시작': 'bg-violet-100 text-violet-700',
  '협업 종료': 'bg-slate-200 text-slate-600',
  '샘플 발송': 'bg-teal-100 text-teal-700',
  '콘텐츠 마감': 'bg-amber-100 text-amber-700',
  출고: 'bg-sky-100 text-sky-700',
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']
const toKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

export default function CalendarPage() {
  const { data: collabs, isLoading } = useCollabs()
  const { data: shipments = [] } = useShipments()
  const { data: influencers = [] } = useInfluencers()
  const navigate = useNavigate()
  const [cursor, setCursor] = useState(() => new Date())

  const events = useMemo(() => {
    const nameOf = (id: string) => influencers.find((i) => i.id === id)?.name ?? '?'
    const list: CalendarEvent[] = []
    for (const collab of collabs ?? []) {
      if (collab.isCancelled) continue
      const name = nameOf(collab.influencerId)
      const push = (date: string | null, kind: EventKind) => {
        if (date) list.push({ date: date.slice(0, 10), kind, label: name, influencerId: collab.influencerId })
      }
      push(collab.startDate, '협업 시작')
      push(collab.endDate, '협업 종료')
      push(collab.sampleShipDate, '샘플 발송')
      push(collab.contentDueDate, '콘텐츠 마감')
    }
    for (const shipment of shipments) {
      if (!shipment.shippedAt) continue
      list.push({
        date: shipment.shippedAt.slice(0, 10),
        kind: '출고',
        label: nameOf(shipment.influencerId),
        influencerId: shipment.influencerId,
      })
    }
    return list
  }, [collabs, shipments, influencers])

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()
    for (const event of events) {
      const bucket = map.get(event.date) ?? []
      bucket.push(event)
      map.set(event.date, bucket)
    }
    return map
  }, [events])

  const cells = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1)
    const start = new Date(first)
    start.setDate(first.getDate() - first.getDay())
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(start)
      date.setDate(start.getDate() + index)
      return date
    })
  }, [cursor])

  const todayKey = toKey(new Date())
  const shiftMonth = (delta: number) =>
    setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + delta, 1))

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900">캘린더</h1>
        <p className="mt-1 text-sm text-slate-500">
          협업 기간, 샘플 발송일, 콘텐츠 마감일을 한눈에 확인하세요.
        </p>
      </div>

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

            <div className="grid grid-cols-7">
              {cells.map((date) => {
                const key = toKey(date)
                const dayEvents = eventsByDate.get(key) ?? []
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
                    <div className="mt-1 space-y-0.5">
                      {dayEvents.slice(0, 3).map((event, index) => (
                        <button
                          key={`${event.influencerId}-${event.kind}-${index}`}
                          onClick={() => navigate(`/influencers/${event.influencerId}`)}
                          className={clsx(
                            'block w-full truncate rounded px-1 py-0.5 text-left text-[11px]',
                            kindTone[event.kind],
                          )}
                          title={`${event.label} · ${event.kind}`}
                        >
                          {event.label} {event.kind}
                        </button>
                      ))}
                      {dayEvents.length > 3 && (
                        <span className="block px-1 text-[11px] text-slate-400">
                          +{dayEvents.length - 3}건
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </Card>

      <div className="flex flex-wrap gap-2 text-xs">
        {(Object.keys(kindTone) as EventKind[]).map((kind) => (
          <span key={kind} className={clsx('rounded px-2 py-1', kindTone[kind])}>
            {kind}
          </span>
        ))}
      </div>
    </div>
  )
}
