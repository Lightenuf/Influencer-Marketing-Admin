import { useState } from 'react'
import { useCurrentUser } from '@/auth/AuthProvider'
import { Button, Field, Modal, Select, Textarea } from '@/components/ui'
import { DNC_REASONS, type Collab, type DncReason } from '@/data/types'
import { useCancelCollab, useChangeDnc, useInfluencers } from '@/hooks/queries'

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
  const { data: influencers = [] } = useInfluencers()

  const [reason, setReason] = useState<DncReason | ''>('')
  const [detail, setDetail] = useState('')
  const [alsoBlock, setAlsoBlock] = useState(false)

  if (!collab) return null

  const influencer = influencers.find((i) => i.id === collab.influencerId)
  const alreadyBlocked = influencer?.doNotContact ?? false

  const close = () => {
    setReason('')
    setDetail('')
    setAlsoBlock(false)
    onClose()
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

  return (
    <Modal
      open={open}
      onClose={close}
      title="협업 취소"
      description={
        <>
          <b className="text-slate-700">{influencer?.name}</b> · {collab.title}
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <Field label="취소 사유" required>
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
          <Button type="button" variant="secondary" onClick={close}>
            닫기
          </Button>
          <Button
            type="submit"
            variant="danger"
            disabled={!reason || cancelCollab.isPending || changeDnc.isPending}
          >
            취소 처리
          </Button>
        </div>
      </form>
    </Modal>
  )
}
