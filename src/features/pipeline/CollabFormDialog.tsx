import { useEffect, useState } from 'react'
import { Button, Field, Input, Modal, Select } from '@/components/ui'
import { COLLAB_STAGES, COLLAB_TYPES, type Collab, type CollabStage, type CollabType } from '@/data/types'
import { useCreateCollab, useInfluencers, useUpdateCollab } from '@/hooks/queries'
import { toDateInputValue } from '@/utils/format'

const emptyForm = {
  influencerId: '',
  title: '',
  collabType: '마켓' as CollabType,
  stage: '요청' as CollabStage,
  startDate: '',
  endDate: '',
  sampleShipDate: '',
  contentDueDate: '',
  fee: 0,
}

export default function CollabFormDialog({
  open,
  onClose,
  editing,
}: {
  open: boolean
  onClose: () => void
  editing?: Collab | null
}) {
  const { data: influencers = [] } = useInfluencers()
  const createCollab = useCreateCollab()
  const updateCollab = useUpdateCollab()
  const [form, setForm] = useState(emptyForm)

  useEffect(() => {
    if (editing) {
      setForm({
        influencerId: editing.influencerId,
        title: editing.title,
        collabType: editing.collabType,
        stage: editing.stage,
        startDate: toDateInputValue(editing.startDate),
        endDate: toDateInputValue(editing.endDate),
        sampleShipDate: toDateInputValue(editing.sampleShipDate),
        contentDueDate: toDateInputValue(editing.contentDueDate),
        fee: editing.fee,
      })
    } else {
      setForm(emptyForm)
    }
  }, [editing, open])

  const selected = influencers.find((i) => i.id === form.influencerId)

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const payload = {
      influencerId: form.influencerId,
      title: form.title.trim(),
      collabType: form.collabType,
      stage: form.stage,
      startDate: form.startDate || null,
      endDate: form.endDate || null,
      sampleShipDate: form.sampleShipDate || null,
      contentDueDate: form.contentDueDate || null,
      fee: Number(form.fee) || 0,
    }
    if (editing) {
      updateCollab.mutate({ id: editing.id, patch: payload }, { onSuccess: onClose })
    } else {
      createCollab.mutate(payload, { onSuccess: onClose })
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={editing ? '협업 수정' : '협업 추가'}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="크리에이터" required>
          <Select
            value={form.influencerId}
            onChange={(e) => setForm({ ...form, influencerId: e.target.value })}
            required
            disabled={Boolean(editing)}
          >
            <option value="" disabled>
              선택해주세요
            </option>
            {influencers.map((influencer) => (
              <option key={influencer.id} value={influencer.id}>
                {influencer.name} (@{influencer.snsHandle})
                {influencer.doNotContact ? ' — 연락 금지' : ''}
              </option>
            ))}
          </Select>
        </Field>

        {selected?.doNotContact && (
          <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">
            ⛔ 연락 금지로 등록된 크리에이터입니다. 사유: {selected.dncReason}
          </p>
        )}

        <Field label="협업명" required>
          <Input
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="예) 10월 마켓 공동구매"
            required
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="구분">
            <Select
              value={form.collabType}
              onChange={(e) => setForm({ ...form, collabType: e.target.value as CollabType })}
            >
              {COLLAB_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="단계">
            <Select
              value={form.stage}
              onChange={(e) => setForm({ ...form, stage: e.target.value as CollabStage })}
            >
              {COLLAB_STAGES.map((stage) => (
                <option key={stage} value={stage}>
                  {stage}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="협업 시작일">
            <Input
              type="date"
              value={form.startDate}
              onChange={(e) => setForm({ ...form, startDate: e.target.value })}
            />
          </Field>
          <Field label="협업 종료일">
            <Input
              type="date"
              value={form.endDate}
              onChange={(e) => setForm({ ...form, endDate: e.target.value })}
            />
          </Field>
          <Field label="샘플 발송일">
            <Input
              type="date"
              value={form.sampleShipDate}
              onChange={(e) => setForm({ ...form, sampleShipDate: e.target.value })}
            />
          </Field>
          <Field label="콘텐츠 마감일">
            <Input
              type="date"
              value={form.contentDueDate}
              onChange={(e) => setForm({ ...form, contentDueDate: e.target.value })}
            />
          </Field>
          <Field label="협업비 (원)">
            <Input
              type="number"
              min={0}
              value={form.fee}
              onChange={(e) => setForm({ ...form, fee: Number(e.target.value) })}
            />
          </Field>
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            취소
          </Button>
          <Button type="submit" disabled={!form.influencerId || !form.title.trim()}>
            {editing ? '저장' : '추가'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
