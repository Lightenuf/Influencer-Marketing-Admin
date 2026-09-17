import { useState } from 'react'
import { Link } from 'react-router-dom'
import { DncBadge } from '@/components/badges'
import { Button, Card, EmptyState, Spinner } from '@/components/ui'
import type { Influencer } from '@/data/types'
import DncChangeDialog from '@/features/dnc/DncChangeDialog'
import { useCollabs, useInfluencers } from '@/hooks/queries'
import { formatDate, formatNumber } from '@/utils/format'

export default function RejectedListPage() {
  const { data: collabs, isLoading } = useCollabs()
  const { data: influencers = [] } = useInfluencers()
  const [dncTarget, setDncTarget] = useState<Influencer | null>(null)

  const rejected = (collabs ?? [])
    .filter((collab) => collab.isCancelled)
    .sort((a, b) => (b.cancelledAt ?? '').localeCompare(a.cancelledAt ?? ''))

  const blockedCount = rejected.filter(
    (collab) => influencers.find((i) => i.id === collab.influencerId)?.doNotContact,
  ).length

  if (isLoading) return <Spinner />

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900">거절 명단</h1>
        <p className="mt-1 text-sm text-slate-500">
          거절 의사를 밝혀 협업이 무산된 분들입니다. 총 {formatNumber(rejected.length)}건 · 그중
          연락 금지 <span className="font-medium text-rose-600">{formatNumber(blockedCount)}명</span>
        </p>
      </div>

      {rejected.length === 0 ? (
        <Card>
          <EmptyState
            title="거절된 건이 없습니다"
            description="파이프라인 카드의 '취소 → 거절'을 누르면 여기로 옮겨집니다."
          />
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {rejected.map((collab) => {
            const influencer = influencers.find((i) => i.id === collab.influencerId)
            return (
              <Card key={collab.id} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link
                      to={`/influencers/${collab.influencerId}`}
                      className="block truncate text-sm font-medium text-slate-900 hover:text-violet-600"
                    >
                      {influencer?.name ?? '삭제된 크리에이터'}
                    </Link>
                    {influencer && (
                      <p className="truncate text-xs text-slate-400">
                        @{influencer.snsHandle} · 팔로워 {formatNumber(influencer.followerCount)}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-wrap justify-end gap-1">
                    {collab.cancelReasons.map((reason) => (
                      <span
                        key={reason}
                        className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-700"
                      >
                        {reason}
                      </span>
                    ))}
                  </div>
                </div>

                {influencer?.doNotContact && (
                  <div className="mt-2">
                    <DncBadge compact />
                  </div>
                )}

                {collab.cancelReasonDetail && (
                  <p className="mt-2 rounded-lg bg-slate-50 px-2.5 py-2 text-xs leading-relaxed text-slate-600">
                    {collab.cancelReasonDetail}
                  </p>
                )}

                <p className="mt-3 text-[11px] text-slate-400">
                  거절 {formatDate(collab.cancelledAt)} · {collab.stage} 단계에서
                </p>

                {influencer && (
                  <div className="mt-3">
                    <Button
                      size="sm"
                      variant="secondary"
                      className="w-full"
                      onClick={() => setDncTarget(influencer)}
                    >
                      {influencer.doNotContact ? '연락 금지 해제' : '연락 금지 등록'}
                    </Button>
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}

      <DncChangeDialog
        influencer={dncTarget}
        open={dncTarget !== null}
        onClose={() => setDncTarget(null)}
      />
    </div>
  )
}
