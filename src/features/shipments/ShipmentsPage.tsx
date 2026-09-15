import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CollabTypeBadge } from '@/components/badges'
import { Button, Card, EmptyState, Select, Spinner } from '@/components/ui'
import { COLLAB_TYPES, SHIPMENT_STATUSES, type Shipment, type ShipmentStatus } from '@/data/types'
import ShipmentFormDialog from '@/features/shipments/ShipmentFormDialog'
import { useDeleteShipment, useInfluencers, useShipments, useUpdateShipment } from '@/hooks/queries'
import { downloadCsv } from '@/utils/csv'
import { formatDate } from '@/utils/format'

export default function ShipmentsPage() {
  const { data: shipments, isLoading } = useShipments()
  const { data: influencers = [] } = useInfluencers()
  const updateShipment = useUpdateShipment()
  const deleteShipment = useDeleteShipment()

  const [status, setStatus] = useState('')
  const [type, setType] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Shipment | null>(null)

  const nameOf = (id: string) => influencers.find((i) => i.id === id)?.name ?? '삭제된 크리에이터'

  const filtered = useMemo(
    () =>
      (shipments ?? []).filter((shipment) => {
        if (status && shipment.status !== status) return false
        if (type && shipment.collabType !== type) return false
        return true
      }),
    [shipments, status, type],
  )

  const exportCsv = () =>
    downloadCsv(
      '출고_목록',
      filtered.map((shipment) => ({
        크리에이터: nameOf(shipment.influencerId),
        구분: shipment.collabType,
        상태: shipment.status,
        상품명: shipment.productName,
        수량: shipment.quantity,
        택배사: shipment.carrier,
        송장번호: shipment.trackingNumber,
        요청일: formatDate(shipment.requestedAt),
        발송일: formatDate(shipment.shippedAt),
        도착일: formatDate(shipment.deliveredAt),
      })),
    )

  const openNew = () => {
    setEditing(null)
    setFormOpen(true)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">출고 관리</h1>
          <p className="mt-1 text-sm text-slate-500">샘플·마켓 상품 발송 현황을 추적합니다.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={exportCsv} disabled={filtered.length === 0}>
            엑셀 다운로드
          </Button>
          <Button onClick={openNew} disabled={influencers.length === 0}>
            + 출고 등록
          </Button>
        </div>
      </div>

      <Card className="flex flex-wrap gap-3 p-4">
        <div className="w-44">
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">출고 상태 전체</option>
            {SHIPMENT_STATUSES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </Select>
        </div>
        <div className="w-44">
          <Select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">출고 구분 전체</option>
            {COLLAB_TYPES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </Select>
        </div>
      </Card>

      <Card>
        {isLoading ? (
          <Spinner />
        ) : filtered.length === 0 ? (
          <EmptyState
            title="출고 건이 없습니다"
            description="샘플이나 마켓 상품을 발송하면 이곳에서 상태를 관리할 수 있습니다."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-y border-slate-100 bg-slate-50 text-xs text-slate-500">
                <tr>
                  <th className="px-5 py-2.5 text-left font-medium">크리에이터</th>
                  <th className="px-3 py-2.5 text-left font-medium">구분</th>
                  <th className="px-3 py-2.5 text-left font-medium">상품</th>
                  <th className="px-3 py-2.5 text-left font-medium">송장</th>
                  <th className="px-3 py-2.5 text-left font-medium">요청일</th>
                  <th className="px-3 py-2.5 text-left font-medium">상태</th>
                  <th className="px-5 py-2.5 text-right font-medium">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((shipment) => (
                  <tr key={shipment.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3">
                      <Link
                        to={`/influencers/${shipment.influencerId}`}
                        className="font-medium text-slate-900 hover:text-violet-600"
                      >
                        {nameOf(shipment.influencerId)}
                      </Link>
                    </td>
                    <td className="px-3 py-3">
                      <CollabTypeBadge type={shipment.collabType} />
                    </td>
                    <td className="px-3 py-3 text-slate-700">
                      {shipment.productName}
                      <span className="ml-1 text-slate-400">× {shipment.quantity}</span>
                    </td>
                    <td className="px-3 py-3 text-slate-500">
                      {shipment.trackingNumber ? (
                        <>
                          {shipment.carrier} {shipment.trackingNumber}
                        </>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="px-3 py-3 text-slate-500">{formatDate(shipment.requestedAt)}</td>
                    <td className="px-3 py-3">
                      <div className="w-32">
                        <Select
                          value={shipment.status}
                          onChange={(e) =>
                            updateShipment.mutate({
                              id: shipment.id,
                              patch: { status: e.target.value as ShipmentStatus },
                            })
                          }
                        >
                          {SHIPMENT_STATUSES.map((item) => (
                            <option key={item} value={item}>
                              {item}
                            </option>
                          ))}
                        </Select>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-right whitespace-nowrap">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditing(shipment)
                          setFormOpen(true)
                        }}
                      >
                        수정
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-rose-500 hover:bg-rose-50"
                        onClick={() => {
                          if (confirm('이 출고 건을 삭제할까요?')) deleteShipment.mutate(shipment.id)
                        }}
                      >
                        삭제
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <ShipmentFormDialog open={formOpen} onClose={() => setFormOpen(false)} editing={editing} />
    </div>
  )
}
