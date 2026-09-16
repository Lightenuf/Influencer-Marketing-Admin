import clsx from 'clsx'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { DncBadge } from '@/components/badges'
import { Button, Card, EmptyState, Spinner } from '@/components/ui'
import type { Collab } from '@/data/types'
import HoldCollabDialog from '@/features/pipeline/HoldCollabDialog'
import { useCollabs, useInfluencers } from '@/hooks/queries'
import { formatDate, formatNumber } from '@/utils/format'

const today = () => new Date().toISOString().slice(0, 10)

/** 다시 연락하기로 한 날까지 남은 일수. 지난 날짜면 음수. */
function daysUntil(date: string) {
  const target = new Date(`${date}T00:00:00`).getTime()
  const now = new Date(`${today()}T00:00:00`).getTime()
  return Math.round((target - now) / 86_400_000)
}

export default function HoldListPage() {
  const { data: collabs, isLoading } = useCollabs()
  const { data: influencers = [] } = useInfluencers()
  const [editing, setEditing] = useState<Collab | null>(null)

  const held = (collabs ?? [])
    .filter((c) => c.isOnHold && !c.isCancelled)
    .sort((a, b) => {
      // 다시 연락할 날이 가까운 순서. 날짜 없는 건 뒤로.
      if (a.recontactAt && b.recontactAt) return a.recontactAt.localeCompare(b.recontactAt)
      if (a.recontactAt) return -1
      if (b.recontactAt) return 1
      return (b.heldAt ?? '').localeCompare(a.heldAt ?? '')
    })

  const dueCount = held.filter((c) => c.recontactAt && daysUntil(c.recontactAt) <= 0).length

  if (isLoading) return <Spinner />

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900">보류 명단</h1>
        <p className="mt-1 text-sm text-slate-500">
          거절은 아니지만 지금은 진행할 수 없는 분들입니다. 때가 되면 다시 파이프라인으로
          불러오세요.
        </p>
      </div>

      {dueCount > 0 && (
        <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm font-medium text-amber-700">
          다시 연락할 때가 된 분이 {dueCount}명 있습니다.
        </p>
      )}

      {held.length === 0 ? (
        <Card>
          <EmptyState
            title="보류 중인 분이 없습니다"
            description="파이프라인 카드의 '보류' 버튼을 누르면 여기로 옮겨집니다."
          />
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {held.map((collab) => {
            const influencer = influencers.find((i) => i.id === collab.influencerId)
            const left = collab.recontactAt ? daysUntil(collab.recontactAt) : null
            const due = left !== null && left <= 0
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
                  <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                    {collab.holdReason}
                  </span>
                </div>

                {influencer?.doNotContact && (
                  <div className="mt-2">
                    <DncBadge compact />
                  </div>
                )}

                {collab.holdDetail && (
                  <p className="mt-2 rounded-lg bg-slate-50 px-2.5 py-2 text-xs leading-relaxed text-slate-600">
                    {collab.holdDetail}
                  </p>
                )}

                <div className="mt-3 space-y-0.5 text-[11px] text-slate-400">
                  <p>
                    보류 {formatDate(collab.heldAt)} · 복귀하면 {collab.stage}
                  </p>
                  {left !== null && (
                    <p className={clsx(due && 'font-semibold text-amber-600')}>
                      다시 연락 {formatDate(collab.recontactAt)}
                      {left > 0 ? ` · D-${left}` : left === 0 ? ' · 오늘' : ` · ${-left}일 지남`}
                    </p>
                  )}
                </div>

                <div className="mt-3">
                  <Button
                    size="sm"
                    variant={due ? 'primary' : 'secondary'}
                    className="w-full"
                    onClick={() => setEditing(collab)}
                  >
                    수정
                  </Button>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      <HoldCollabDialog
        collab={editing}
        open={editing !== null}
        onClose={() => setEditing(null)}
      />
    </div>
  )
}
