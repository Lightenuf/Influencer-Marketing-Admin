import clsx from 'clsx'
import type { CollabStage, CollabType, InfluencerStatus, ShipmentStatus } from '@/data/types'

const base = 'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap'

const statusTone: Record<InfluencerStatus, string> = {
  제안중: 'bg-slate-100 text-slate-600',
  협의중: 'bg-amber-100 text-amber-700',
  진행중: 'bg-violet-100 text-violet-700',
  완료: 'bg-emerald-100 text-emerald-700',
  취소: 'bg-slate-200 text-slate-500',
  재협업대상: 'bg-sky-100 text-sky-700',
}

export function StatusBadge({ status }: { status: InfluencerStatus }) {
  return <span className={clsx(base, statusTone[status])}>{status}</span>
}

const stageTone: Record<CollabStage, string> = {
  회신완료: 'bg-slate-100 text-slate-600',
  테스트중: 'bg-amber-100 text-amber-700',
  '테스트 통과': 'bg-sky-100 text-sky-700',
  '미팅 확정': 'bg-violet-100 text-violet-700',
  '마켓 대기중': 'bg-emerald-100 text-emerald-700',
  '마켓 완료': 'bg-emerald-600 text-white',
}

export function StageBadge({ stage }: { stage: CollabStage }) {
  return <span className={clsx(base, stageTone[stage])}>{stage}</span>
}

const shipmentTone: Record<ShipmentStatus, string> = {
  배송준비중: 'bg-amber-100 text-amber-700',
  배송중: 'bg-sky-100 text-sky-700',
  완료: 'bg-emerald-100 text-emerald-700',
  취소요청: 'bg-rose-100 text-rose-700',
  취소: 'bg-slate-200 text-slate-500',
}

export function ShipmentStatusBadge({ status }: { status: ShipmentStatus }) {
  return <span className={clsx(base, shipmentTone[status])}>{status}</span>
}

const typeTone: Record<CollabType, string> = {
  마켓: 'bg-indigo-50 text-indigo-600 border border-indigo-100',
  샘플: 'bg-teal-50 text-teal-600 border border-teal-100',
  유가광고: 'bg-fuchsia-50 text-fuchsia-600 border border-fuchsia-100',
}

export function CollabTypeBadge({ type }: { type: CollabType }) {
  return <span className={clsx(base, typeTone[type])}>{type}</span>
}

export function DncBadge({ compact = false }: { compact?: boolean }) {
  return (
    <span className={clsx(base, 'bg-rose-100 text-rose-700')}>
      <span aria-hidden>⛔</span>
      {compact ? '금지' : '연락 금지'}
    </span>
  )
}
