import { useState } from 'react'
import { useCurrentUser } from '@/auth/AuthProvider'
import { Button, Field, Modal, Select, Textarea } from '@/components/ui'
import { DNC_REASONS, type DncReason, type Influencer } from '@/data/types'
import { useChangeDnc } from '@/hooks/queries'

export default function DncChangeDialog({
  influencer,
  open,
  onClose,
}: {
  influencer: Influencer | null
  open: boolean
  onClose: () => void
}) {
  const user = useCurrentUser()
  const changeDnc = useChangeDnc(user.id)
  const [reason, setReason] = useState<DncReason | ''>('')
  const [detail, setDetail] = useState('')

  if (!influencer) return null

  const isUnsetting = influencer.doNotContact
  const close = () => {
    setReason('')
    setDetail('')
    onClose()
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!reason) return
    changeDnc.mutate(
      {
        influencerId: influencer.id,
        action: isUnsetting ? 'unset' : 'set',
        reason,
        reasonDetail: detail.trim(),
      },
      { onSuccess: close },
    )
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title={isUnsetting ? '연락 금지 해제' : '연락 금지 등록'}
      description={
        <>
          <b className="text-slate-700">{influencer.name}</b>
          {isUnsetting
            ? ' 님을 다시 연락 가능한 상태로 되돌립니다.'
            : ' 님에게 앞으로 협업 제안이 나가지 않도록 차단합니다.'}
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <Field label={isUnsetting ? '해제 사유' : '금지 사유'} required>
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

        <Field
          label="상세 메모"
          hint="나중에 '왜 막았는지' 확인할 수 있도록 통화·DM 내용 등을 남겨주세요."
        >
          <Textarea
            rows={3}
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            placeholder="예) 9/12 DM 회신 — 건기식 카테고리는 협업하지 않는다고 함"
          />
        </Field>

        <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-500">
          이 변경은 <b>{user.displayName}</b> 이름으로 이력에 영구 기록됩니다. 기록은 수정하거나
          삭제할 수 없습니다.
        </p>

        {changeDnc.isError && (
          <p className="text-xs text-rose-600">저장에 실패했습니다. 다시 시도해주세요.</p>
        )}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={close}>
            취소
          </Button>
          <Button
            type="submit"
            variant={isUnsetting ? 'primary' : 'danger'}
            disabled={!reason || changeDnc.isPending}
          >
            {isUnsetting ? '해제하기' : '연락 금지 등록'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
