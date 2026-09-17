import clsx from 'clsx'
import type { Collab, CollabStage } from '@/data/types'
import { useMoveCollabStage, useUpdateCollab } from '@/hooks/queries'
import { daysSince, formatDate } from '@/utils/format'

/** 연락한 지 이 일수가 지나면 '재연락' 표시가 뜬다. */
const RECONTACT_DAYS = 3

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

const chip =
  'rounded-md px-2 py-1 text-[11px] font-medium transition disabled:opacity-50'
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

/** 수락 / 거절 두 갈래를 고르는 줄. 아직 안 고른 상태(null)를 구분한다. */
function AcceptChoice({
  label,
  value,
  onAccept,
  onDecline,
}: {
  label: string
  value: boolean | null
  onAccept: () => void
  onDecline: () => void
}) {
  return (
    <div>
      <span className="text-[11px] text-slate-500">{label}</span>
      <div className="mt-0.5 flex gap-1">
        <button
          type="button"
          onClick={onAccept}
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
          onClick={onDecline}
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
  onReject,
}: {
  collab: Collab
  stage: CollabStage
  /** '불만족'을 눌렀을 때 — 사유를 남기고 연락 금지로 보내는 창을 연다. */
  onReject: () => void
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
          onAccept={() => patch({ seedingAccepted: true })}
          onDecline={() => patch({ seedingAccepted: false })}
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
            onClick={() => patch({ testFeedback: '긍정' })}
            className={clsx(
              chip,
              'flex-1',
              collab.testFeedback === '긍정'
                ? 'bg-violet-100 text-violet-700'
                : chipOff + ' hover:bg-violet-100 hover:text-violet-700',
            )}
          >
            만족
          </button>
          <button
            type="button"
            onClick={() => {
              patch({ testFeedback: '부정' })
              onReject()
            }}
            className={clsx(
              chip,
              'flex-1',
              collab.testFeedback === '부정'
                ? 'bg-rose-100 text-rose-700'
                : chipOff + ' hover:bg-rose-100 hover:text-rose-700',
            )}
          >
            불만족
          </button>
        </div>

        {needsCheck && (
          <p className="text-[11px] font-medium text-amber-600">
            체험 확인 연락 필요 — 보낸 지 {sinceShip}일
          </p>
        )}

        {collab.testFeedback === '부정' && (
          <p className="text-[11px] text-rose-600">불만족 — 취소 처리가 필요합니다</p>
        )}

        <AcceptChoice
          label="미팅 수락 여부"
          value={collab.meetingAccepted}
          onAccept={() => {
            patch({ meetingAccepted: true })
            moveStage.mutate({ id: collab.id, stage: '미팅 조율중' })
          }}
          onDecline={() => patch({ meetingAccepted: false })}
        />

        {collab.meetingAccepted === false && (
          <p className="text-[11px] text-rose-600">미팅 거절 — 취소 또는 보류 처리가 필요합니다</p>
        )}
      </div>
    )
  }

  // ── 미팅 조율중: 연락을 보냈는지, 답이 없으면 재연락 알림 ──
  if (stage === '미팅 조율중') {
    const contacted = Boolean(collab.lastContactedAt)
    const waited = collab.lastContactedAt ? daysSince(collab.lastContactedAt) : null
    const needsRecontact = waited !== null && waited >= RECONTACT_DAYS
    return (
      <div className="mt-2 space-y-1.5">
        <button
          type="button"
          title={contacted ? '다시 누르면 오늘 날짜로 갱신됩니다' : undefined}
          onClick={() => patch({ lastContactedAt: today() })}
          className={clsx(
            chip,
            'w-full',
            contacted ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : chipOff,
          )}
        >
          {contacted ? '✓ 연락함' : '연락 전'}
        </button>

        {needsRecontact && (
          <p className="text-[11px] font-medium text-amber-600">
            재연락 필요 — 연락한 지 {waited}일
          </p>
        )}

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
        <DateRow label="미팅 날짜" value={collab.meetingAt} onChange={(v) => patch({ meetingAt: v })} />

        {left !== null && (
          <p
            className={clsx(
              'text-[11px]',
              left < 0 ? 'font-medium text-amber-600' : 'text-slate-500',
            )}
          >
            {left > 0 ? `미팅 D-${left}` : left === 0 ? '오늘 미팅' : `미팅일이 ${-left}일 지났습니다`}
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

  // ── 마켓 대기중: 마켓 여는 날짜 ──
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
            {left > 0 ? `마켓 D-${left}` : left === 0 ? '오늘 마켓' : `마켓일이 ${-left}일 지났습니다`}
          </p>
        )}
      </div>
    )
  }

  return null
}
