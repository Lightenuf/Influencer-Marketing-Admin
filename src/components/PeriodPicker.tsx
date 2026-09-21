import type { MetaPeriod } from '@/data/metaRepository'

const toKey = (date: Date) => date.toISOString().slice(0, 10)

const shiftDays = (days: number) => {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return toKey(date)
}

export const PERIOD_PRESETS = [
  { key: 'day', label: '일', hint: '오늘' },
  { key: 'week', label: '주', hint: '최근 7일' },
  { key: 'month', label: '월', hint: '최근 30일' },
  { key: 'custom', label: '직접', hint: '기간 고르기' },
] as const

export type PeriodPreset = (typeof PERIOD_PRESETS)[number]['key']

export function presetPeriod(preset: Exclude<PeriodPreset, 'custom'>): MetaPeriod {
  const today = toKey(new Date())
  if (preset === 'day') return { from: today, to: today }
  if (preset === 'week') return { from: shiftDays(-6), to: today }
  return { from: shiftDays(-29), to: today }
}

/** 지금 보고 있는 기간과 길이가 같은 바로 앞 기간 — 증감을 견주는 데 쓴다 */
export function previousPeriod(period: MetaPeriod): MetaPeriod {
  const from = new Date(`${period.from}T00:00:00Z`)
  const to = new Date(`${period.to}T00:00:00Z`)
  const days = Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1
  const prevTo = new Date(from)
  prevTo.setUTCDate(prevTo.getUTCDate() - 1)
  const prevFrom = new Date(prevTo)
  prevFrom.setUTCDate(prevFrom.getUTCDate() - (days - 1))
  return { from: toKey(prevFrom), to: toKey(prevTo) }
}

export function periodDays(period: MetaPeriod): number {
  const from = new Date(`${period.from}T00:00:00Z`).getTime()
  const to = new Date(`${period.to}T00:00:00Z`).getTime()
  return Math.max(1, Math.round((to - from) / 86_400_000) + 1)
}

export default function PeriodPicker({
  preset,
  period,
  onChange,
}: {
  preset: PeriodPreset
  period: MetaPeriod
  onChange: (preset: PeriodPreset, period: MetaPeriod) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5">
        {PERIOD_PRESETS.map((item) => (
          <button
            key={item.key}
            type="button"
            title={item.hint}
            onClick={() =>
              onChange(
                item.key,
                item.key === 'custom' ? period : presetPeriod(item.key as 'day' | 'week' | 'month'),
              )
            }
            className={
              preset === item.key
                ? 'rounded-md bg-violet-600 px-4 py-1.5 text-sm font-medium text-white'
                : 'rounded-md px-4 py-1.5 text-sm text-slate-600 hover:bg-slate-50'
            }
          >
            {item.label}
          </button>
        ))}
      </div>

      {preset === 'custom' ? (
        <div className="flex items-center gap-1.5 text-sm text-slate-600">
          <input
            type="date"
            value={period.from}
            max={period.to}
            onChange={(e) => onChange('custom', { ...period, from: e.target.value })}
            className="rounded-md border border-slate-200 bg-white px-2 py-1 text-sm focus:border-violet-400 focus:outline-none"
          />
          <span className="text-slate-400">~</span>
          <input
            type="date"
            value={period.to}
            min={period.from}
            max={toKey(new Date())}
            onChange={(e) => onChange('custom', { ...period, to: e.target.value })}
            className="rounded-md border border-slate-200 bg-white px-2 py-1 text-sm focus:border-violet-400 focus:outline-none"
          />
        </div>
      ) : (
        <span className="text-xs text-slate-400">
          {period.from} ~ {period.to}
        </span>
      )}
    </div>
  )
}
