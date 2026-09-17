import { useState } from 'react'
import { useCurrentUser } from '@/auth/AuthProvider'
import { Button, Field, Modal, Select, Textarea } from '@/components/ui'
import { DNC_REASONS, type Collab, type DncReason } from '@/data/types'
import {
  useCancelCollab,
  useChangeDnc,
  useDeleteCollab,
  useInfluencers,
} from '@/hooks/queries'

export default function CancelCollabDialog({
  collab,
  open,
  onClose,
}: {
  collab: Collab | null
  open: boolean
  onClose: () => void
}) {
  const user = useCurrentUser()
  const cancelCollab = useCancelCollab()
  const changeDnc = useChangeDnc(user.id)
  const deleteCollab = useDeleteCollab()
  const { data: influencers = [] } = useInfluencers()

  const [mode, setMode] = useState<'choose' | 'reject'>('choose')
  const [reason, setReason] = useState<DncReason | ''>('')
  const [detail, setDetail] = useState('')
  const [alsoBlock, setAlsoBlock] = useState(false)

  if (!collab) return null

  const influencer = influencers.find((i) => i.id === collab.influencerId)
  const alreadyBlocked = influencer?.doNotContact ?? false

  // 카드에 기록해 둔 내용이 있으면, 복귀할 때 함께 사라진다는 것을 알려준다.
  const recorded = [
    collab.seedingAccepted !== null && '씨딩 수락 여부',
    collab.sampleShipDate && '배송 날짜',
    collab.testFeedback && '음료 반응',
    collab.meetingAccepted !== null && '미팅 수락 여부',
    collab.meetingAt && '미팅 날짜',
    collab.marketDate && '마켓 날짜',
  ].filter(Boolean) as string[]

  const close = () => {
    setMode('choose')
    setReason('')
    setDetail('')
    setAlsoBlock(false)
    onClose()
  }

  const returnToList = () => {
    deleteCollab.mutate(collab.id, { onSuccess: close })
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!reason) return
    await cancelCollab.mutateAsync({ id: collab.id, reason, detail: detail.trim() })
    if (alsoBlock && !alreadyBlocked) {
      await changeDnc.mutateAsync({
        influencerId: collab.influencerId,
        action: 'set',
        reason,
        reasonDetail: detail.trim() || `${collab.title} 협업 취소로 인한 등록`,
      })
    }
    close()
  }

  const heading = (
    <>
      <b className="text-slate-700">{influencer?.name}</b>
      {influencer?.snsHandle && <span className="text-slate-400"> @{influencer.snsHandle}</span>}
    </>
  )

  // ── 1단계: 실수로 옮긴 것인지, 실제 거절인지 고른다 ──
  if (mode === 'choose') {
    return (
      <Modal open={open} onClose={close} title="취소 — 어떤 경우인가요?" description={heading}>
        <div className="space-y-3">
          <button
            type="button"
            onClick={returnToList}
            disabled={deleteCollab.isPending}
            className="w-full rounded-xl border border-slate-200 p-4 text-left transition hover:border-violet-300 hover:bg-violet-50 disabled:opacity-50"
          >
            <p className="text-sm font-semibold text-slate-900">리스트 복귀</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              실수로 '회신 받음'을 눌러 파이프라인에 올라온 경우입니다. 카드를 지우고 인플루언서
              목록으로 되돌립니다. 거절 기록도, 연락 금지도 남지 않아 언제든 다시 올릴 수 있습니다.
            </p>
            {recorded.length > 0 && (
              <p className="mt-1.5 text-xs text-amber-600">
                카드에 입력한 내용이 함께 지워집니다 — {recorded.join(' · ')}
              </p>
            )}
          </button>

          <button
            type="button"
            onClick={() => setMode('reject')}
            className="w-full rounded-xl border border-slate-200 p-4 text-left transition hover:border-rose-300 hover:bg-rose-50"
          >
            <p className="text-sm font-semibold text-slate-900">거절</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              크리에이터가 실제로 거절 의사를 밝힌 경우입니다. 사유를 남기고, 필요하면 연락 금지로
              함께 등록합니다.
            </p>
          </button>

          <div className="flex justify-end">
            <Button type="button" variant="secondary" onClick={close}>
              닫기
            </Button>
          </div>
        </div>
      </Modal>
    )
  }

  // ── 2단계: 거절 처리 ──
  return (
    <Modal open={open} onClose={close} title="거절 처리" description={heading}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="거절 사유" required>
          <Select
            value={reason}
            onChange={(e) => setReason(e.target.value as DncReason)}
            required
            autoFocus
          >
            <option value="" disabled>
              선택해주세요
            </option>
            {DNC_REASONS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="상세 메모">
          <Textarea rows={2} value={detail} onChange={(e) => setDetail(e.target.value)} />
        </Field>

        {alreadyBlocked ? (
          <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">
            이미 연락 금지로 등록된 크리에이터입니다.
          </p>
        ) : (
          <label className="flex cursor-pointer items-start gap-2 rounded-lg bg-slate-50 px-3 py-2.5">
            <input
              type="checkbox"
              checked={alsoBlock}
              onChange={(e) => setAlsoBlock(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-rose-600"
            />
            <span className="text-sm text-slate-700">
              이 크리에이터를 <b>연락 금지</b>로 함께 등록
              <span className="mt-0.5 block text-xs text-slate-500">
                앞으로 제안 명단에서 자동으로 제외됩니다. 이력에 기록이 남습니다.
              </span>
            </span>
          </label>
        )}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => setMode('choose')}>
            뒤로
          </Button>
          <Button
            type="submit"
            variant="danger"
            disabled={!reason || cancelCollab.isPending || changeDnc.isPending}
          >
            거절 처리
          </Button>
        </div>
      </form>
    </Modal>
  )
}
