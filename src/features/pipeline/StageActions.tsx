import clsx from 'clsx'
import { useEffect, useState } from 'react'
import type { Collab, CollabStage } from '@/data/types'
import { useMoveCollabStage, useUpdateCollab } from '@/hooks/queries'
import { daysSince, formatDate, formatNumber } from '@/utils/format'

/**
 * 음료를 보내고 이 일수가 지나도 반응 표시가 없으면 확인 알림을 띄운다.
 * 배송 1~2일 + 체험 기간을 감안한 값.
 */
const TEST_CHECK_DAYS = 4

const today = () => new Date().toISOString().slice(0, 10)

/** 오늘부터 해당 날짜까지 남은 일수. 지난 날짜면 음수. */
function daysUntil(date: string) {
  const target = new Date(`${date}T00:00:00`).getTime()
  const now = new Date(today() + 'T00:00:00').getTime()
  return Math.round((target - now) / 86_400_000)
}

const chip = 'rounded-md px-2 py-1 text-[11px] font-medium transition disabled:opacity-50'
const chipOff = 'bg-slate-100 text-slate-500 hover:bg-slate-200'

function DateRow({
  label,
  value,
  onChange,
}: {
  label: string
  value: string | null
  onChange: (v: string | null) => void
}) {
  return (
    <label className="block">
      <span className="text-[11px] text-slate-500">{label}</span>
      <input
        type="date"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || null)}
        className="mt-0.5 w-full rounded-md border border-slate-200 bg-white px-1.5 py-1 text-[11px] text-slate-700 focus:border-violet-400 focus:outline-none"
      />
    </label>
  )
}

/**
 * 숫자를 적는 줄 (금액·수량).
 * 글자를 칠 때마다 저장하면 목록이 계속 다시 그려지므로, 칸을 벗어날 때 한 번 저장한다.
 */
function AmountRow({
  label,
  unit,
  /** 적는 단위가 저장 단위와 다를 때 쓴다. '만원'으로 적고 원으로 저장하는 식. */
  scale = 1,
  value,
  hint,
  onCommit,
}: {
  label: string
  unit: string
  scale?: number
  value: number
  hint?: string
  onCommit: (value: number) => void
}) {
  const shown = value ? String(Math.round(value / scale)) : ''
  const [draft, setDraft] = useState(shown)

  useEffect(() => setDraft(shown), [shown])

  const commit = () => {
    const next = (Number(draft.replace(/[^\d]/g, '')) || 0) * scale
    if (next !== value) onCommit(next)
  }

  return (
    <label className="block">
      <span className="text-[11px] text-slate-500">{label}</span>
      <div className="mt-0.5 flex items-center gap-1">
        <input
          inputMode="numeric"
          value={draft}
          onChange={(e) => setDraft(e.target.value.replace(/[^\d]/g, ''))}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
          }}
          placeholder="0"
          className="w-full rounded-md border border-slate-200 bg-white px-1.5 py-1 text-right text-[11px] text-slate-700 focus:border-violet-400 focus:outline-none"
        />
        <span className="shrink-0 text-[11px] whitespace-nowrap text-slate-400">{unit}</span>
      </div>
      {hint && <span className="mt-0.5 block text-[10px] text-slate-400">{hint}</span>}
    </label>
  )
}

/**
 * 수락 / 거절 두 갈래를 고르는 줄. 아직 안 고른 상태(null)를 구분한다.
 * 고른 것을 다시 누르면 선택이 풀린다 — 잘못 눌렀을 때 되돌리기 위함.
 */
function AcceptChoice({
  label,
  value,
  onChange,
}: {
  label: string
  value: boolean | null
  onChange: (next: boolean | null) => void
}) {
  const pick = (next: boolean) => onChange(value === next ? null : next)
  return (
    <div>
      <span className="text-[11px] text-slate-500">{label}</span>
      <div className="mt-0.5 flex gap-1">
        <button
          type="button"
          title={value === true ? '다시 누르면 선택이 풀립니다' : undefined}
          onClick={() => pick(true)}
          className={clsx(
            chip,
            'flex-1',
            value === true
              ? 'bg-emerald-100 text-emerald-700'
              : chipOff + ' hover:bg-emerald-100 hover:text-emerald-700',
          )}
        >
          수락
        </button>
        <button
          type="button"
          title={value === false ? '다시 누르면 선택이 풀립니다' : undefined}
          onClick={() => pick(false)}
          className={clsx(
            chip,
            'flex-1',
            value === false
              ? 'bg-rose-100 text-rose-700'
              : chipOff + ' hover:bg-rose-100 hover:text-rose-700',
          )}
        >
          거절
        </button>
      </div>
    </div>
  )
}

export default function StageActions({
  collab,
  stage,
  onCompleteMarket,
}: {
  collab: Collab
  stage: CollabStage
  /** 마켓 성과를 남기는 창을 연다 */
  onCompleteMarket: () => void
}) {
  const update = useUpdateCollab()
  const moveStage = useMoveCollabStage()
  const patch = (fields: Parameters<typeof update.mutate>[0]['patch']) =>
    update.mutate({ id: collab.id, patch: fields })

  if (collab.isCancelled) return null

  // ── 회신완료: 씨딩을 수락했는지, 수락했다면 배송 날짜 ──
  if (stage === '회신완료') {
    return (
      <div className="mt-2 space-y-1.5">
        <p className="text-[11px] text-slate-500">회신 확인 {formatDate(collab.createdAt)}</p>

        <AcceptChoice
          label="씨딩 수락 여부"
          value={collab.seedingAccepted}
          onChange={(next) => patch({ seedingAccepted: next })}
        />

        {collab.seedingAccepted === true && (
          <DateRow
            label="배송 날짜"
            value={collab.sampleShipDate}
            onChange={(v) => {
              if (!v) return
              // 배송 날짜가 정해졌다는 건 곧 '테스트중' — 한 번에 넘긴다.
              patch({ sampleShipDate: v })
              moveStage.mutate({ id: collab.id, stage: '테스트중' })
            }}
          />
        )}

        {collab.seedingAccepted === false && (
          <p className="text-[11px] text-rose-600">씨딩 거절 — 취소 또는 보류 처리가 필요합니다</p>
        )}
      </div>
    )
  }

  // ── 테스트중: 받아본 반응 + 미팅 수락 여부 ──
  if (stage === '테스트중') {
    const sinceShip = collab.sampleShipDate ? daysSince(collab.sampleShipDate) : null
    const needsCheck =
      collab.testFeedback === null && sinceShip !== null && sinceShip >= TEST_CHECK_DAYS
    return (
      <div className="mt-2 space-y-1.5">
        {collab.sampleShipDate && (
          <p className="text-[11px] text-slate-500">배송 {formatDate(collab.sampleShipDate)}</p>
        )}

        <div className="flex gap-1">
          <button
            type="button"
            title={collab.testFeedback === '긍정' ? '다시 누르면 선택이 풀립니다' : undefined}
            onClick={() => patch({ testFeedback: collab.testFeedback === '긍정' ? null : '긍정' })}
            className={clsx(
              chip,
              'flex-1',
              collab.testFeedback === '긍정'
                ? 'bg-violet-100 text-violet-700'
                : chipOff + ' hover:bg-violet-100 hover:text-violet-700',
            )}
          >
            통과
          </button>
          <button
            type="button"
            title={collab.testFeedback === '부정' ? '다시 누르면 선택이 풀립니다' : undefined}
            onClick={() => patch({ testFeedback: collab.testFeedback === '부정' ? null : '부정' })}
            className={clsx(
              chip,
              'flex-1',
              collab.testFeedback === '부정'
                ? 'bg-rose-100 text-rose-700'
                : chipOff + ' hover:bg-rose-100 hover:text-rose-700',
            )}
          >
            탈락
          </button>
        </div>

        {needsCheck && (
          <p className="text-[11px] font-medium text-amber-600">
            체험 확인 연락 필요 — 보낸 지 {sinceShip}일
          </p>
        )}

        {collab.testFeedback === '부정' && (
          <p className="text-[11px] text-rose-600">탈락 — 취소 또는 보류 처리가 필요합니다</p>
        )}

        <AcceptChoice
          label="미팅 수락 여부"
          value={collab.meetingAccepted}
          onChange={(next) => {
            patch({ meetingAccepted: next })
            if (next === true) moveStage.mutate({ id: collab.id, stage: '테스트 통과' })
          }}
        />

        {collab.meetingAccepted === false && (
          <p className="text-[11px] text-rose-600">미팅 거절 — 취소 또는 보류 처리가 필요합니다</p>
        )}
      </div>
    )
  }

  // ── 테스트 통과: 미팅 날짜만 잡는다 ──
  if (stage === '테스트 통과') {
    return (
      <div className="mt-2">
        <DateRow
          label="미팅 날짜가 잡히면 입력"
          value={collab.meetingAt}
          onChange={(v) => {
            if (!v) return
            // 날짜가 정해졌다는 건 곧 '미팅 확정' — 한 번에 넘긴다.
            patch({ meetingAt: v })
            moveStage.mutate({ id: collab.id, stage: '미팅 확정' })
          }}
        />
      </div>
    )
  }

  // ── 미팅 확정: 미팅 날짜 ──
  if (stage === '미팅 확정') {
    const left = collab.meetingAt ? daysUntil(collab.meetingAt) : null
    return (
      <div className="mt-2 space-y-1.5">
        <DateRow
          label="미팅 날짜"
          value={collab.meetingAt}
          onChange={(v) => patch({ meetingAt: v })}
        />

        {left !== null && (
          <p
            className={clsx(
              'text-[11px]',
              left < 0 ? 'font-medium text-amber-600' : 'text-slate-500',
            )}
          >
            {left > 0
              ? `미팅 D-${left}`
              : left === 0
                ? '오늘 미팅'
                : `미팅일이 ${-left}일 지났습니다`}
          </p>
        )}

        <DateRow
          label="마켓 날짜가 정해지면 입력"
          value={collab.marketDate}
          onChange={(v) => {
            if (!v) return
            // 마켓 날짜가 잡혔으면 곧 '마켓 대기중'.
            patch({ marketDate: v })
            moveStage.mutate({ id: collab.id, stage: '마켓 대기중' })
          }}
        />
      </div>
    )
  }

  // ── 마켓 대기중: 마켓 여는 날짜 + 끝나면 성과 남기기 ──
  if (stage === '마켓 대기중') {
    const left = collab.marketDate ? daysUntil(collab.marketDate) : null
    return (
      <div className="mt-2 space-y-1.5">
        <DateRow
          label="마켓 예정일"
          value={collab.marketDate}
          onChange={(v) => patch({ marketDate: v })}
        />
        {left !== null && (
          <p
            className={clsx(
              'text-[11px]',
              left <= 3 ? 'font-medium text-amber-600' : 'text-slate-500',
            )}
          >
            {left > 0
              ? `마켓 D-${left}`
              : left === 0
                ? '오늘 마켓'
                : `마켓일이 ${-left}일 지났습니다`}
          </p>
        )}

        <AmountRow
          label="목표 매출"
          unit="만원"
          scale={10_000}
          value={collab.targetRevenue}
          onCommit={(value) => patch({ targetRevenue: value })}
        />
        <AmountRow
          label="예상 소요량"
          unit="개"
          value={collab.plannedUnits}
          hint={
            collab.targetRevenue > 0 && collab.plannedUnits > 0
              ? `개당 ${formatNumber(Math.round(collab.targetRevenue / collab.plannedUnits))}원`
              : undefined
          }
          onCommit={(value) => patch({ plannedUnits: value })}
        />

        <button
          type="button"
          onClick={onCompleteMarket}
          className={clsx(chip, 'w-full bg-emerald-100 text-emerald-700 hover:bg-emerald-200')}
        >
          마켓 완료 처리
        </button>
      </div>
    )
  }

  // ── 마켓 완료: 남긴 성과를 보여준다 ──
  if (stage === '마켓 완료') {
    return (
      <div className="mt-2 space-y-1">
        <p className="text-sm font-semibold text-slate-900">
          {formatNumber(collab.marketRevenue)}원
        </p>
        <p className="text-[11px] text-slate-500">
          {formatNumber(collab.marketUnits)}개 · {formatDate(collab.marketDate)}
          {collab.isSettled ? ' · 정산 완료' : ' · 정산 전'}
        </p>
        {collab.contentLinks.length > 0 && (
          <p className="text-[11px] text-slate-400">콘텐츠 {collab.contentLinks.length}개</p>
        )}
        <button type="button" onClick={onCompleteMarket} className={clsx(chip, 'w-full', chipOff)}>
          성과 수정
        </button>
      </div>
    )
  }

  return null
}
