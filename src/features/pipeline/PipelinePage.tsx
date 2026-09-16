import clsx from 'clsx'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { DncBadge } from '@/components/badges'
import { Button, Card, EmptyState, Spinner } from '@/components/ui'
import { COLLAB_STAGES, type Collab, type CollabStage } from '@/data/types'
import CancelCollabDialog from '@/features/pipeline/CancelCollabDialog'
import CollabFormDialog from '@/features/pipeline/CollabFormDialog'
import StageActions from '@/features/pipeline/StageActions'
import { useCollabs, useInfluencers, useMoveCollabStage } from '@/hooks/queries'
import { daysSince } from '@/utils/format'

const STALE_DAYS = 15
const FIRST_STAGE = COLLAB_STAGES[0]
const LAST_STAGE = COLLAB_STAGES[COLLAB_STAGES.length - 1]

export default function PipelinePage() {
  const { data: collabs, isLoading } = useCollabs()
  const { data: influencers = [] } = useInfluencers()
  const moveStage = useMoveCollabStage()

  const [formOpen, setFormOpen] = useState(false)
  const [cancelTarget, setCancelTarget] = useState<Collab | null>(null)

  const influencerOf = (id: string) => influencers.find((i) => i.id === id)

  const openNew = () => setFormOpen(true)

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
          + 크리에이터 추가
        </Button>
      </div>

      {isLoading ? (
        <Spinner />
      ) : influencers.length === 0 ? (
        <Card>
          <EmptyState
            title="먼저 인플루언서를 등록해주세요"
            description="파이프라인 카드는 등록된 크리에이터 한 명에 해당합니다."
          />
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
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
                    const isStale = waiting >= STALE_DAYS && stage !== LAST_STAGE
                    return (
                      <Card key={collab.id} className="p-3">
                        <Link
                          to={`/influencers/${collab.influencerId}`}
                          className="block text-sm font-medium text-slate-900 hover:text-violet-600"
                        >
                          {influencer?.name ?? '삭제된 크리에이터'}
                        </Link>

                        {influencer?.snsHandle && (
                          <p className="mt-0.5 text-[11px] text-slate-400">@{influencer.snsHandle}</p>
                        )}

                        {influencer?.doNotContact && (
                          <div className="mt-1.5">
                            <DncBadge compact />
                          </div>
                        )}

                        <StageActions
                          collab={collab}
                          stage={stage}
                          onReject={() => setCancelTarget(collab)}
                        />

                        <div className="mt-2 space-y-0.5 text-[11px] text-slate-400">
                          <p className={clsx(isStale && 'font-semibold text-amber-600')}>
                            {collab.isCancelled
                              ? `취소됨 · ${collab.cancelReason}`
                              : `${waiting}일째 ${stage}`}
                            {isStale && ' ⚠️'}
                          </p>
                        </div>

                        <div className="mt-2.5 flex items-center gap-0.5 whitespace-nowrap">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="px-1.5"
                            onClick={() => move(collab, -1)}
                            disabled={stage === FIRST_STAGE}
                          >
                            ←
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="px-1.5"
                            onClick={() => move(collab, 1)}
                            disabled={stage === LAST_STAGE}
                          >
                            →
                          </Button>
                          <span className="flex-1" />
                          {!collab.isCancelled && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="px-1.5 text-rose-500 hover:bg-rose-50"
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

      <CollabFormDialog open={formOpen} onClose={() => setFormOpen(false)} />
      <CancelCollabDialog
        collab={cancelTarget}
        open={cancelTarget !== null}
        onClose={() => setCancelTarget(null)}
      />
    </div>
  )
}
