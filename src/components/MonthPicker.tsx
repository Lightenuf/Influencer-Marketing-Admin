import { Button } from '@/components/ui'

/**
 * 달을 옮겨가며 보는 선택기. null이면 전체 기간을 뜻한다.
 * 거절 명단과 대시보드 차트가 같은 방식으로 달을 고르도록 함께 쓴다.
 */
export default function MonthPicker({
  value,
  onChange,
  compact = false,
}: {
  value: Date | null
  onChange: (next: Date | null) => void
  /** 카드 머리말처럼 좁은 자리에서는 '이번 달' 버튼을 감춘다 */
  compact?: boolean
}) {
  const shift = (delta: number) => {
    const base = value ?? new Date()
    onChange(new Date(base.getFullYear(), base.getMonth() + delta, 1))
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="inline-flex items-center rounded-lg border border-slate-200 bg-white p-0.5">
        <button
          type="button"
          aria-label="이전 달"
          onClick={() => shift(-1)}
          className="rounded-md px-2.5 py-1.5 text-sm text-slate-500 hover:bg-slate-50"
        >
          ‹
        </button>
        <span className="min-w-24 px-2 text-center text-sm font-medium text-slate-800">
          {value ? `${value.getFullYear()}년 ${value.getMonth() + 1}월` : '전체 기간'}
        </span>
        <button
          type="button"
          aria-label="다음 달"
          onClick={() => shift(1)}
          className="rounded-md px-2.5 py-1.5 text-sm text-slate-500 hover:bg-slate-50"
        >
          ›
        </button>
      </div>

      {!compact && (
        <Button variant="secondary" size="sm" onClick={() => onChange(new Date())}>
          이번 달
        </Button>
      )}
      <Button
        variant={value === null ? 'primary' : 'secondary'}
        size="sm"
        onClick={() => onChange(value === null ? new Date() : null)}
      >
        전체 기간
      </Button>
    </div>
  )
}

/** 'YYYY-MM' 형태로 바꾼다. null이면 기간 제한이 없다는 뜻. */
export const monthKeyOf = (value: Date | null) =>
  value ? `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}` : null
