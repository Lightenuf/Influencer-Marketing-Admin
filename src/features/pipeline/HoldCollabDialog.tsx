import { useEffect, useState } from 'react'
import { Button, Field, Input, Modal, Select, Textarea } from '@/components/ui'
import { HOLD_REASONS, type Collab, type HoldReason } from '@/data/types'
import { useHoldCollab, useInfluencers, useResumeCollab } from '@/hooks/queries'

/**
 * 보류 처리 창.
 * 거절(연락 금지)과 달리 "나중에 다시" 인 분들을 보류 명단으로 옮긴다.
 */
export default function HoldCollabDialog({
  collab,
  open,
  onClose,
}: {
  collab: Collab | null
  open: boolean
  onClose: () => void
}) {
  const holdCollab = useHoldCollab()
  const resume = useResumeCollab()
  const { data: influencers = [] } = useInfluencers()

  const [reason, setReason] = useState<HoldReason | ''>('')
  const [detail, setDetail] = useState('')
  const [recontactAt, setRecontactAt] = useState('')

  // 이미 보류 중인 건을 열면 기존 값을 채워 수정할 수 있게 한다.
  useEffect(() => {
    if (!open || !collab) return
    setReason(collab.holdReason ?? '')
    setDetail(collab.holdDetail ?? '')
    setRecontactAt(collab.recontactAt ?? '')
  }, [open, collab])

  if (!collab) return null
  const editing = collab.isOnHold
  const influencer = influencers.find((i) => i.id === collab.influencerId)

  const close = () => {
    setReason('')
    setDetail('')
    setRecontactAt('')
    onClose()
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!reason) return
    await holdCollab.mutateAsync({
      id: collab.id,
      change: { reason, detail: detail.trim(), recontactAt: recontactAt || null },
    })
    close()
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title={editing ? '보류 정보 수정' : '보류로 옮기기'}
      description={
        <>
          <b className="text-slate-700">{influencer?.name}</b> · {collab.stage}
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <Field label="보류 사유" required>
          <Select
            value={reason}
            onChange={(e) => setReason(e.target.value as HoldReason)}
            required
            autoFocus
          >
            <option value="" disabled>
              선택해주세요
            </option>
            {HOLD_REASONS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="다시 연락할 날" hint="정해두면 그날이 지났을 때 알려드립니다. 비워두셔도 됩니다.">
          <Input
            type="date"
            value={recontactAt}
            onChange={(e) => setRecontactAt(e.target.value)}
          />
        </Field>

        <Field label="메모">
          <Textarea
            rows={2}
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            placeholder="예) 11월에 첫 공구 예정이라 그 이후에 다시 연락 달라고 하심"
          />
        </Field>

        {!editing && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
            보드에서 숨겨지고 <b>보류 명단</b>으로 옮겨집니다. 연락 금지와 달리 언제든 다시
            불러올 수 있고, 복귀하면 <b>{collab.stage}</b> 단계로 돌아갑니다.
          </p>
        )}

        {editing && (
          <div className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-3">
            <p className="text-xs text-slate-600">
              다시 진행하기로 하셨다면 파이프라인으로 되돌립니다. 빠져나갔던{' '}
              <b>{collab.stage}</b> 단계로 돌아갑니다.
            </p>
            <Button
              type="button"
              size="sm"
              className="mt-2 w-full"
              onClick={async () => {
                await resume.mutateAsync(collab.id)
                close()
              }}
              disabled={resume.isPending}
            >
              파이프라인으로 복귀
            </Button>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={close}>
            닫기
          </Button>
          <Button type="submit" disabled={!reason || holdCollab.isPending}>
            {editing ? '저장' : '보류로 옮기기'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
