import clsx from 'clsx'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CollabTypeBadge, DncBadge } from '@/components/badges'
import { Button, Card, EmptyState, Spinner } from '@/components/ui'
import { COLLAB_STAGES, type Collab, type CollabStage } from '@/data/types'
import CancelCollabDialog from '@/features/pipeline/CancelCollabDialog'
import CollabFormDialog from '@/features/pipeline/CollabFormDialog'
import { useCollabs, useInfluencers, useMoveCollabStage } from '@/hooks/queries'
import { daysSince, formatDate } from '@/utils/format'

const STALE_DAYS = 15

export default function PipelinePage() {
  const { data: collabs, isLoading } = useCollabs()
  const { data: influencers = [] } = useInfluencers()
  const moveStage = useMoveCollabStage()

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Collab | null>(null)
  const [cancelTarget, setCancelTarget] = useState<Collab | null>(null)

  const influencerOf = (id: string) => influencers.find((i) => i.id === id)

  const openNew = () => {
    setEditing(null)
    setFormOpen(true)
  }

  const openEdit = (collab: Collab) => {
    setEditing(collab)
    setFormOpen(true)
  }

  const move = (collab: Collab, direction: -1 | 1) => {
    const index = COLLAB_STAGES.indexOf(collab.stage)
    const next = COLLAB_STAGES[index + direction]
    if (next) moveStage.mutate({ id: collab.id, stage: next as CollabStage })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">협업 파이프라인</h1>
          <p className="mt-1 text-sm text-slate-500">
            단계별 진행 상황과 오래 멈춰 있는 건을 확인하세요. ({STALE_DAYS}일 이상 대기 시 경고)
          </p>
        </div>
        <Button onClick={openNew} disabled={influencers.length === 0}>
          + 협업 추가
        </Button>
      </div>

      {isLoading ? (
        <Spinner />
      ) : influencers.length === 0 ? (
        <Card>
          <EmptyState
            title="먼저 인플루언서를 등록해주세요"
            description="협업 건은 등록된 인플루언서에 연결됩니다."
          />
        </Card>
      ) : (
        <div className="grid gap-3 lg:grid-cols-4">
          {COLLAB_STAGES.map((stage) => {
            const items = (collabs ?? []).filter((collab) => collab.stage === stage)
            return (
              <div key={stage} className="rounded-xl bg-slate-200/60 p-2">
                <div className="flex items-center justify-between px-2 py-1.5">
                  <span className="text-sm font-semibold text-slate-700">{stage}</span>
                  <span className="text-xs text-slate-500">{items.length}</span>
                </div>

                <div className="space-y-2">
                  {items.length === 0 && (
                    <p className="px-2 py-6 text-center text-xs text-slate-400">비어 있음</p>
                  )}
                  {items.map((collab) => {
                    const influencer = influencerOf(collab.influencerId)
                    const waiting = daysSince(collab.stageEnteredAt)
                    const isStale = waiting >= STALE_DAYS && stage !== '종료'
                    return (
                      <Card key={collab.id} className="p-3">
                        <div className="flex items-start justify-between gap-2">
                          <Link
                            to={`/influencers/${collab.influencerId}`}
                            className="text-sm font-medium text-slate-900 hover:text-violet-600"
                          >
                            {influencer?.name ?? '삭제된 크리에이터'}
                          </Link>
                          <CollabTypeBadge type={collab.collabType} />
                        </div>

                        <p className="mt-1 text-xs text-slate-500">{collab.title}</p>

                        {influencer?.doNotContact && (
                          <div className="mt-1.5">
                            <DncBadge compact />
                          </div>
                        )}

                        <div className="mt-2 space-y-0.5 text-[11px] text-slate-400">
                          {collab.sampleShipDate && (
                            <p>샘플 발송 {formatDate(collab.sampleShipDate)}</p>
                          )}
                          {collab.contentDueDate && (
                            <p>콘텐츠 마감 {formatDate(collab.contentDueDate)}</p>
                          )}
                          <p className={clsx(isStale && 'font-semibold text-amber-600')}>
                            {collab.isCancelled
                              ? `취소됨 · ${collab.cancelReason}`
                              : `${waiting}일째 ${stage}`}
                            {isStale && ' ⚠️'}
                          </p>
                        </div>

                        <div className="mt-2.5 flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => move(collab, -1)}
                            disabled={stage === '요청'}
                          >
                            ←
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => move(collab, 1)}
                            disabled={stage === '종료'}
                          >
                            →
                          </Button>
                          <span className="flex-1" />
                          <Button size="sm" variant="ghost" onClick={() => openEdit(collab)}>
                            수정
                          </Button>
                          {!collab.isCancelled && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-rose-500 hover:bg-rose-50"
                              onClick={() => setCancelTarget(collab)}
                            >
                              취소
                            </Button>
                          )}
                        </div>
                      </Card>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <CollabFormDialog open={formOpen} onClose={() => setFormOpen(false)} editing={editing} />
      <CancelCollabDialog
        collab={cancelTarget}
        open={cancelTarget !== null}
        onClose={() => setCancelTarget(null)}
      />
    </div>
  )
}
