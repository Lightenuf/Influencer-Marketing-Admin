import { useState } from 'react'
import { useCurrentUser } from '@/auth/AuthProvider'
import TagPicker from '@/components/TagPicker'
import { Button, Field, Modal, Textarea } from '@/components/ui'
import type { Influencer } from '@/data/types'
import { useChangeDnc } from '@/hooks/queries'

export default function DncChangeDialog({
  influencer,
  open,
  onClose,
  presetReasons,
}: {
  influencer: Influencer | null
  open: boolean
  onClose: () => void
  /** 거절 사유를 그대로 쓸 때 넘긴다. 이 경우 사유를 다시 고르지 않고 메모만 받는다. */
  presetReasons?: string[]
}) {
  const user = useCurrentUser()
  const changeDnc = useChangeDnc(user.id)
  const [reasons, setReasons] = useState<string[]>([])
  const [detail, setDetail] = useState('')

  if (!influencer) return null

  const isUnsetting = influencer.doNotContact
  // 거절하면서 이미 사유를 고른 경우에는 같은 사유를 그대로 쓰고, 메모만 받는다.
  const inherited = !isUnsetting && (presetReasons?.length ?? 0) > 0 ? presetReasons! : null
  // 해제할 때도 사유를 따로 고르지 않고 메모로 남긴다.
  const memoOnly = isUnsetting || inherited !== null
  const effectiveReasons = isUnsetting ? [] : (inherited ?? reasons)
  const canSubmit = memoOnly ? detail.trim() !== '' : effectiveReasons.length > 0

  const close = () => {
    setReasons([])
    setDetail('')
    onClose()
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    changeDnc.mutate(
      {
        influencerId: influencer.id,
        action: isUnsetting ? 'unset' : 'set',
        reason: effectiveReasons.join(', '),
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
        {inherited && (
          <Field label="금지 사유" hint="거절할 때 고른 사유를 그대로 씁니다">
            <div className="flex flex-wrap gap-1.5 rounded-lg bg-slate-50 px-3 py-2.5">
              {inherited.map((reason) => (
                <span
                  key={reason}
                  className="rounded-md bg-rose-100 px-2 py-1 text-xs font-medium text-rose-700"
                >
                  {reason}
                </span>
              ))}
            </div>
          </Field>
        )}

        {!memoOnly && (
          <Field
            label="금지 사유"
            required
            hint="여러 개 고를 수 있고, 없는 사유는 새로 만들 수 있습니다"
          >
            <TagPicker selected={reasons} onChange={setReasons} />
          </Field>
        )}

        <Field
          label="상세 메모"
          required={memoOnly}
          hint={
            isUnsetting
              ? "나중에 '왜 풀었는지' 확인할 수 있도록 남겨주세요."
              : "나중에 '왜 막았는지' 확인할 수 있도록 통화·DM 내용 등을 남겨주세요."
          }
        >
          <Textarea
            rows={3}
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            placeholder={
              isUnsetting
                ? '예) 9/20 통화 — 다음 시즌에 다시 논의하기로 함'
                : '예) 9/12 DM 회신 — 건기식 카테고리는 협업하지 않는다고 함'
            }
            autoFocus={memoOnly}
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
            disabled={!canSubmit || changeDnc.isPending}
          >
            {isUnsetting ? '해제하기' : '연락 금지 등록'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
