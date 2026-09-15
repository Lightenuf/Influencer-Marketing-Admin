import { useEffect, useState } from 'react'
import { Button, Field, Input, Modal, Select } from '@/components/ui'
import {
  COLLAB_TYPES,
  SHIPMENT_STATUSES,
  type CollabType,
  type Shipment,
  type ShipmentStatus,
} from '@/data/types'
import { useCollabs, useCreateShipment, useInfluencers, useUpdateShipment } from '@/hooks/queries'
import { toDateInputValue } from '@/utils/format'

const emptyForm = {
  influencerId: '',
  collabId: '',
  status: '배송준비중' as ShipmentStatus,
  collabType: '샘플' as CollabType,
  productName: '',
  quantity: 1,
  carrier: '',
  trackingNumber: '',
  shippedAt: '',
  deliveredAt: '',
}

export default function ShipmentFormDialog({
  open,
  onClose,
  editing,
}: {
  open: boolean
  onClose: () => void
  editing?: Shipment | null
}) {
  const { data: influencers = [] } = useInfluencers()
  const { data: collabs = [] } = useCollabs()
  const createShipment = useCreateShipment()
  const updateShipment = useUpdateShipment()
  const [form, setForm] = useState(emptyForm)

  useEffect(() => {
    if (editing) {
      setForm({
        influencerId: editing.influencerId,
        collabId: editing.collabId ?? '',
        status: editing.status,
        collabType: editing.collabType,
        productName: editing.productName,
        quantity: editing.quantity,
        carrier: editing.carrier,
        trackingNumber: editing.trackingNumber,
        shippedAt: toDateInputValue(editing.shippedAt),
        deliveredAt: toDateInputValue(editing.deliveredAt),
      })
    } else {
      setForm(emptyForm)
    }
  }, [editing, open])

  const linkableCollabs = collabs.filter((collab) => collab.influencerId === form.influencerId)

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const payload = {
      influencerId: form.influencerId,
      collabId: form.collabId || null,
      status: form.status,
      collabType: form.collabType,
      productName: form.productName.trim(),
      quantity: Number(form.quantity) || 1,
      carrier: form.carrier.trim(),
      trackingNumber: form.trackingNumber.trim(),
      requestedAt: editing?.requestedAt ?? new Date().toISOString(),
      shippedAt: form.shippedAt || null,
      deliveredAt: form.deliveredAt || null,
    }
    if (editing) {
      updateShipment.mutate({ id: editing.id, patch: payload }, { onSuccess: onClose })
    } else {
      createShipment.mutate(payload, { onSuccess: onClose })
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={editing ? '출고 정보 수정' : '출고 등록'}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="크리에이터" required>
          <Select
            value={form.influencerId}
            onChange={(e) => setForm({ ...form, influencerId: e.target.value, collabId: '' })}
            required
            disabled={Boolean(editing)}
          >
            <option value="" disabled>
              선택해주세요
            </option>
            {influencers.map((influencer) => (
              <option key={influencer.id} value={influencer.id}>
                {influencer.name} (@{influencer.snsHandle})
              </option>
            ))}
          </Select>
        </Field>

        {linkableCollabs.length > 0 && (
          <Field label="연결할 협업" hint="선택하지 않아도 됩니다">
            <Select
              value={form.collabId}
              onChange={(e) => setForm({ ...form, collabId: e.target.value })}
            >
              <option value="">연결 안 함</option>
              {linkableCollabs.map((collab) => (
                <option key={collab.id} value={collab.id}>
                  {collab.title}
                </option>
              ))}
            </Select>
          </Field>
        )}

        <Field label="상품명" required>
          <Input
            value={form.productName}
            onChange={(e) => setForm({ ...form, productName: e.target.value })}
            placeholder="예) 브리보 프리바이오틱스 애사비 355ml"
            required
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="수량">
            <Input
              type="number"
              min={1}
              value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })}
            />
          </Field>
          <Field label="출고 구분">
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
          <Field label="상태">
            <Select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as ShipmentStatus })}
            >
              {SHIPMENT_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="택배사">
            <Input
              value={form.carrier}
              onChange={(e) => setForm({ ...form, carrier: e.target.value })}
            />
          </Field>
          <Field label="송장번호">
            <Input
              value={form.trackingNumber}
              onChange={(e) => setForm({ ...form, trackingNumber: e.target.value })}
            />
          </Field>
          <Field label="발송일">
            <Input
              type="date"
              value={form.shippedAt}
              onChange={(e) => setForm({ ...form, shippedAt: e.target.value })}
            />
          </Field>
          <Field label="도착일">
            <Input
              type="date"
              value={form.deliveredAt}
              onChange={(e) => setForm({ ...form, deliveredAt: e.target.value })}
            />
          </Field>
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            취소
          </Button>
          <Button type="submit" disabled={!form.influencerId || !form.productName.trim()}>
            {editing ? '저장' : '등록'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
