import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { CollabTypeBadge, DncBadge, ShipmentStatusBadge, StageBadge, StatusBadge } from '@/components/badges'
import {
  Button,
  Card,
  CardHeader,
  EmptyState,
  secondaryLinkButtonClass,
  Spinner,
} from '@/components/ui'
import { SNS_PLATFORM_LABELS } from '@/data/types'
import CommunicationLogSection from '@/features/communication/CommunicationLogSection'
import DncAuditHistory from '@/features/dnc/DncAuditHistory'
import DncChangeDialog from '@/features/dnc/DncChangeDialog'
import {
  useCollabs,
  useDeleteInfluencer,
  useInfluencer,
  useShipments,
  useTeamMembers,
} from '@/hooks/queries'
import { formatDate, formatDateTime, formatNumber } from '@/utils/format'

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-3 py-1.5 text-sm">
      <span className="w-24 shrink-0 text-slate-400">{label}</span>
      <span className="min-w-0 break-words text-slate-700">{value || '-'}</span>
    </div>
  )
}

export default function InfluencerDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { data: influencer, isLoading } = useInfluencer(id)
  const { data: collabs = [] } = useCollabs()
  const { data: shipments = [] } = useShipments()
  const { data: members = [] } = useTeamMembers()
  const deleteInfluencer = useDeleteInfluencer()
  const [dncOpen, setDncOpen] = useState(false)

  if (isLoading) return <Spinner />
  if (!influencer) {
    return <EmptyState title="인플루언서를 찾을 수 없습니다." />
  }

  const myCollabs = collabs.filter((c) => c.influencerId === influencer.id)
  const myShipments = shipments.filter((s) => s.influencerId === influencer.id)
  const nameOf = (userId: string | null) =>
    members.find((m) => m.id === userId)?.displayName ?? '알 수 없음'

  const remove = () => {
    if (!confirm(`${influencer.name} 님을 삭제할까요? 협업·출고 기록도 함께 삭제됩니다.`)) return
    deleteInfluencer.mutate(influencer.id, { onSuccess: () => navigate('/influencers') })
  }

  return (
    <div className="space-y-4">
      <Link to="/influencers" className="text-sm text-slate-500 hover:text-slate-700">
        ← 인플루언서 목록
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900">{influencer.name}</h1>
            <StatusBadge status={influencer.status} />
            {influencer.doNotContact && <DncBadge />}
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {SNS_PLATFORM_LABELS[influencer.snsPlatform]} @{influencer.snsHandle} · 팔로워{' '}
            {formatNumber(influencer.followerCount)}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={remove}>
            삭제
          </Button>
          <Link to={`/influencers/${influencer.id}/edit`} className={secondaryLinkButtonClass}>
            정보 수정
          </Link>
          <Button
            variant={influencer.doNotContact ? 'secondary' : 'danger'}
            onClick={() => setDncOpen(true)}
          >
            {influencer.doNotContact ? '연락 금지 해제' : '연락 금지 등록'}
          </Button>
        </div>
      </div>

      {influencer.doNotContact && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-5 py-4">
          <p className="text-sm font-semibold text-rose-700">
            ⛔ 이 크리에이터에게는 협업 제안을 보내지 마세요.
          </p>
          <p className="mt-1 text-sm text-rose-600">
            사유: {influencer.dncReason} · 등록자 {nameOf(influencer.dncSetBy)} ·{' '}
            {formatDateTime(influencer.dncSetAt)}
          </p>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader title="협업 이력" description={`총 ${myCollabs.length}건`} />
            {myCollabs.length === 0 ? (
              <EmptyState title="아직 협업 기록이 없습니다." />
            ) : (
              <ul className="divide-y divide-slate-100">
                {myCollabs.map((collab) => (
                  <li key={collab.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-800">{collab.title}</p>
                      <p className="mt-0.5 text-xs text-slate-400">
                        {formatDate(collab.startDate)} ~ {formatDate(collab.endDate)}
                        {collab.isCancelled && (
                          <span className="ml-2 text-rose-500">취소됨 · {collab.cancelReasons.join(', ')}</span>
                        )}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1.5">
                      <CollabTypeBadge type={collab.collabType} />
                      <StageBadge stage={collab.stage} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title="출고 내역" description={`총 ${myShipments.length}건`} />
            {myShipments.length === 0 ? (
              <EmptyState title="출고 기록이 없습니다." />
            ) : (
              <ul className="divide-y divide-slate-100">
                {myShipments.map((shipment) => (
                  <li
                    key={shipment.id}
                    className="flex items-center justify-between gap-3 px-5 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm text-slate-800">
                        {shipment.productName} × {shipment.quantity}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-400">
                        요청 {formatDate(shipment.requestedAt)}
                        {shipment.trackingNumber && ` · 송장 ${shipment.trackingNumber}`}
                      </p>
                    </div>
                    <ShipmentStatusBadge status={shipment.status} />
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title="커뮤니케이션 기록" />
            <div className="p-5">
              <CommunicationLogSection influencerId={influencer.id} />
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader title="프로필" />
            <div className="px-5 py-3">
              <InfoRow label="플랫폼" value={SNS_PLATFORM_LABELS[influencer.snsPlatform]} />
              <InfoRow
                label="프로필 링크"
                value={
                  influencer.snsUrl ? (
                    <a
                      href={influencer.snsUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-violet-600 hover:underline"
                    >
                      {influencer.snsUrl}
                    </a>
                  ) : null
                }
              />
              <InfoRow label="팔로워" value={formatNumber(influencer.followerCount)} />
              <InfoRow label="카테고리" value={influencer.categories.join(', ')} />
              <InfoRow label="평균 매출" value={influencer.avgRevenueBand} />
              <InfoRow label="이메일" value={influencer.contactEmail} />
              <InfoRow label="연락처" value={influencer.contactPhone} />
              <InfoRow label="기타" value={influencer.contactEtc} />
              <InfoRow label="등록일" value={formatDate(influencer.createdAt)} />
              {influencer.memo && (
                <div className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-sm whitespace-pre-wrap text-slate-600">
                  {influencer.memo}
                </div>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="연락 금지 이력" description="기록은 삭제되지 않습니다" />
            <div className="p-5">
              <DncAuditHistory influencerId={influencer.id} />
            </div>
          </Card>
        </div>
      </div>

      <DncChangeDialog
        influencer={influencer}
        open={dncOpen}
        onClose={() => setDncOpen(false)}
      />
    </div>
  )
}
