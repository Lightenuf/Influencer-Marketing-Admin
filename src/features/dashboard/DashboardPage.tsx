import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { CollabTypeBadge, StageBadge } from '@/components/badges'
import { Button, Card, CardHeader, EmptyState, linkButtonClass, Spinner } from '@/components/ui'
import { isMockMode } from '@/data'
import { COLLAB_STAGES, INFLUENCER_STATUSES } from '@/data/types'
import { useCollabs, useDemoData, useInfluencers, useShipments } from '@/hooks/queries'
import { daysSince, formatDate, formatNumber } from '@/utils/format'

const STALE_DAYS = 15
const LAST_STAGE = COLLAB_STAGES[COLLAB_STAGES.length - 1]

const STATUS_COLORS: Record<string, string> = {
  제안중: '#94a3b8',
  협의중: '#f59e0b',
  진행중: '#7c3aed',
  완료: '#10b981',
  취소: '#cbd5e1',
  재협업대상: '#0ea5e9',
}

function StatCard({
  label,
  value,
  sub,
  tone = 'default',
}: {
  label: string
  value: string
  sub?: string
  tone?: 'default' | 'danger' | 'success'
}) {
  return (
    <Card className="p-5">
      <p className="text-sm text-slate-500">{label}</p>
      <p
        className={
          tone === 'danger'
            ? 'mt-1 text-2xl font-bold text-rose-600'
            : tone === 'success'
              ? 'mt-1 text-2xl font-bold text-emerald-600'
              : 'mt-1 text-2xl font-bold text-slate-900'
        }
      >
        {value}
      </p>
      {sub && <p className="mt-0.5 text-xs text-slate-400">{sub}</p>}
    </Card>
  )
}

export default function DashboardPage() {
  const { data: influencers, isLoading } = useInfluencers()
  const { data: collabs = [] } = useCollabs()
  const { data: shipments = [] } = useShipments()
  const demo = useDemoData()

  const stats = useMemo(() => {
    const all = influencers ?? []
    const blocked = all.filter((i) => i.doNotContact)
    const activeCollabs = collabs.filter((c) => !c.isCancelled)
    const cancelled = collabs.filter((c) => c.isCancelled)

    const sampledIds = new Set(
      shipments.filter((s) => s.collabType === '샘플').map((s) => s.influencerId),
    )
    const convertedIds = new Set(
      collabs
        .filter((c) => c.collabType !== '샘플' && sampledIds.has(c.influencerId))
        .map((c) => c.influencerId),
    )

    return {
      total: all.length,
      blocked: blocked.length,
      contactable: all.length - blocked.length,
      activeCollabs: activeCollabs.length,
      cancelRate: collabs.length ? Math.round((cancelled.length / collabs.length) * 100) : 0,
      conversionRate: sampledIds.size
        ? Math.round((convertedIds.size / sampledIds.size) * 100)
        : 0,
      sampledCount: sampledIds.size,
    }
  }, [influencers, collabs, shipments])

  const statusData = useMemo(
    () =>
      INFLUENCER_STATUSES.map((status) => ({
        status,
        count: (influencers ?? []).filter((i) => i.status === status).length,
      })),
    [influencers],
  )

  const stalled = useMemo(
    () =>
      collabs
        .filter((c) => !c.isCancelled && c.stage !== LAST_STAGE && daysSince(c.stageEnteredAt) >= STALE_DAYS)
        .sort((a, b) => a.stageEnteredAt.localeCompare(b.stageEnteredAt)),
    [collabs],
  )

  const recentlyBlocked = useMemo(
    () =>
      (influencers ?? [])
        .filter((i) => i.doNotContact)
        .sort((a, b) => (b.dncSetAt ?? '').localeCompare(a.dncSetAt ?? ''))
        .slice(0, 5),
    [influencers],
  )

  const nameOf = (id: string) =>
    (influencers ?? []).find((i) => i.id === id)?.name ?? '삭제된 크리에이터'

  if (isLoading) return <Spinner />

  if ((influencers ?? []).length === 0) {
    return (
      <Card>
        <EmptyState
          title="환영합니다 👋"
          description="인플루언서를 등록하면 이곳에 현황이 표시됩니다. 화면을 먼저 둘러보고 싶다면 예시 데이터를 넣어보세요."
          action={
            <div className="flex gap-2">
              <Link to="/influencers/new" className={linkButtonClass}>
                인플루언서 등록
              </Link>
              {isMockMode && (
                <Button
                  variant="secondary"
                  onClick={() => demo.mutate('load')}
                  disabled={demo.isPending}
                >
                  예시 데이터 넣기
                </Button>
              )}
            </div>
          }
        />
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">대시보드</h1>
          <p className="mt-1 text-sm text-slate-500">인플루언서 관계와 협업 현황 요약</p>
        </div>
        {isMockMode && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (confirm('모든 데이터를 삭제하고 빈 상태로 되돌릴까요?')) demo.mutate('reset')
            }}
          >
            데이터 초기화
          </Button>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
        <StatCard
          label="전체 인플루언서"
          value={`${formatNumber(stats.total)}명`}
          sub={`연락 가능 ${formatNumber(stats.contactable)}명`}
        />
        <StatCard
          label="연락 금지"
          value={`${formatNumber(stats.blocked)}명`}
          sub="제안 발송 시 제외"
          tone="danger"
        />
        <StatCard label="진행중 협업" value={`${formatNumber(stats.activeCollabs)}건`} />
        <StatCard label="협업 취소율" value={`${stats.cancelRate}%`} sub={`전체 ${collabs.length}건 기준`} />
        <StatCard
          label="샘플 → 협업 전환율"
          value={`${stats.conversionRate}%`}
          sub={`샘플 발송 ${stats.sampledCount}명 기준`}
          tone="success"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="상태별 인플루언서 분포" />
          <div className="h-64 p-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={statusData} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="status" tick={{ fontSize: 12, fill: '#64748b' }} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                <Tooltip cursor={{ fill: '#f8fafc' }} />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {statusData.map((entry) => (
                    <Cell key={entry.status} fill={STATUS_COLORS[entry.status]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <CardHeader
            title={`${STALE_DAYS}일 이상 멈춘 협업`}
            description="단계가 오래 바뀌지 않은 건입니다"
            action={
              <Link to="/pipeline" className="text-sm text-violet-600 hover:underline">
                파이프라인 →
              </Link>
            }
          />
          {stalled.length === 0 ? (
            <EmptyState title="정체된 협업이 없습니다 👍" />
          ) : (
            <ul className="divide-y divide-slate-100">
              {stalled.slice(0, 6).map((collab) => (
                <li key={collab.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <Link
                      to={`/influencers/${collab.influencerId}`}
                      className="text-sm font-medium text-slate-800 hover:text-violet-600"
                    >
                      {nameOf(collab.influencerId)}
                    </Link>
                    <p className="truncate text-xs text-slate-400">{collab.title}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <CollabTypeBadge type={collab.collabType} />
                    <StageBadge stage={collab.stage} />
                    <span className="text-xs font-semibold text-amber-600">
                      {daysSince(collab.stageEnteredAt)}일
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card>
        <CardHeader
          title="최근 연락 금지 등록"
          action={
            <Link to="/rejected" className="text-sm text-violet-600 hover:underline">
              전체 보기 →
            </Link>
          }
        />
        {recentlyBlocked.length === 0 ? (
          <EmptyState title="연락 금지 대상이 없습니다" />
        ) : (
          <ul className="divide-y divide-slate-100">
            {recentlyBlocked.map((influencer) => (
              <li key={influencer.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <Link
                  to={`/influencers/${influencer.id}`}
                  className="text-sm font-medium text-slate-800 hover:text-violet-600"
                >
                  {influencer.name}
                  <span className="ml-1.5 text-xs text-slate-400">@{influencer.snsHandle}</span>
                </Link>
                <span className="text-xs text-slate-500">
                  {influencer.dncReason} · {formatDate(influencer.dncSetAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
