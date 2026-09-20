import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { CollabTypeBadge, StageBadge } from '@/components/badges'
import { Button, Card, CardHeader, EmptyState, linkButtonClass, Spinner } from '@/components/ui'
import MonthPicker, { monthKeyOf } from '@/components/MonthPicker'
import { isMockMode } from '@/data'
import { COLLAB_STAGES } from '@/data/types'
import type { Collab, CollabStage } from '@/data/types'
import { useCollabs, useDemoData, useInfluencers } from '@/hooks/queries'
import { daysSince, formatDate, formatNumber } from '@/utils/format'

const STALE_DAYS = 15
const LAST_STAGE = COLLAB_STAGES[COLLAB_STAGES.length - 1]

/** 거절은 진행 중인 막대와 구분되도록 옅은 붉은색으로 얹는다. */
const REJECTED_COLOR = '#fecdd3'

/** 단계가 뒤로 갈수록 진해지게 해서, 어디까지 왔는지 색으로도 읽히게 한다. */
const STAGE_COLORS: Record<string, string> = {
  회신완료: '#c4b5fd',
  테스트중: '#a78bfa',
  '테스트 통과': '#8b5cf6',
  '미팅 확정': '#7c3aed',
  '마켓 대기중': '#5b21b6',
}

function StatCard({
  label,
  basis,
  value,
  sub,
  tone = 'default',
}: {
  label: string
  /** 무엇으로 나눈 값인지 — 카드마다 분모가 달라 헷갈리지 않게 함께 적는다. */
  basis?: string
  value: string
  sub?: string
  tone?: 'default' | 'danger' | 'success'
}) {
  return (
    <Card className="p-5">
      <p className="text-sm text-slate-500">
        {label}
        {basis && <span className="ml-1 text-xs text-slate-400">({basis} 대비)</span>}
      </p>
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

const PERIODS = [
  { key: 'week', label: '주', description: '최근 7일' },
  { key: 'month', label: '월', description: '최근 1개월' },
  { key: 'year', label: '연', description: '최근 1년' },
] as const
type Period = (typeof PERIODS)[number]['key']

export default function DashboardPage() {
  const { data: influencers, isLoading } = useInfluencers()
  const { data: collabs = [] } = useCollabs()
  const demo = useDemoData()
  const [period, setPeriod] = useState<Period>('month')
  // 차트는 위의 기간 버튼과 별개로, 달을 골라서 본다.
  const [chartMonth, setChartMonth] = useState<Date | null>(() => new Date())

  /**
   * 기간 내에 '등록한 인플루언서'를 한 묶음으로 보고, 그들이 어디까지 갔는지 센다.
   * 같은 묶음을 계속 따라가므로 단계가 뒤로 갈수록 수가 줄고, 비율이 100%를 넘지 않는다.
   */
  const stats = useMemo(() => {
    const since = new Date()
    if (period === 'week') since.setDate(since.getDate() - 7)
    if (period === 'month') since.setMonth(since.getMonth() - 1)
    if (period === 'year') since.setFullYear(since.getFullYear() - 1)
    const from = since.toISOString()

    const cohort = (influencers ?? []).filter((influencer) => influencer.createdAt >= from)
    const cohortIds = new Set(cohort.map((influencer) => influencer.id))
    const cohortCollabs = collabs.filter((collab) => cohortIds.has(collab.influencerId))

    // 단계는 앞뒤 순서가 있으므로, '그 단계까지 갔던 적이 있는가'로 센다.
    // (거절된 건도 어디까지 갔었는지는 단계에 남아 있다)
    const reached = (collab: Collab, stage: CollabStage) =>
      COLLAB_STAGES.indexOf(collab.stage) >= COLLAB_STAGES.indexOf(stage)

    // 한 사람이 협업 카드를 여러 장 가질 수 있으므로 사람 단위로 센다.
    const peopleWhere = (predicate: (collab: Collab) => boolean) =>
      new Set(cohortCollabs.filter(predicate).map((collab) => collab.influencerId))

    const contacted = cohort.length
    // 회신 = 협업 카드가 만들어진 사람. 이후 거절한 분도 회신은 온 것이므로 포함한다.
    const replied = peopleWhere(() => true)
    // 샘플을 보낸 것과 테스트 단계에 들어간 것은 같은 일이다.
    // 배송일이 비어 있어도 테스트 단계에 있으면 씨딩한 것으로 본다.
    const seeded = peopleWhere(
      (collab) => collab.sampleShipDate !== null || reached(collab, '테스트중'),
    )
    const passed = peopleWhere((collab) => reached(collab, '테스트 통과'))
    const meeting = peopleWhere((collab) => reached(collab, '미팅 확정'))
    const market = peopleWhere((collab) => reached(collab, '마켓 대기중'))

    // 씨딩으로 세긴 했지만 배송일이 비어 있는 사람 — 캘린더와 기록에서 빠진다.
    const seededWithoutDate = [...seeded].filter(
      (id) =>
        !cohortCollabs.some((collab) => collab.influencerId === id && collab.sampleShipDate),
    ).length

    const rate = (value: number, base: number) => (base ? Math.round((value / base) * 100) : 0)

    return {
      from,
      contacted,
      replied: replied.size,
      seeded: seeded.size,
      passed: passed.size,
      meeting: meeting.size,
      market: market.size,
      seededWithoutDate,
      replyRate: rate(replied.size, contacted),
      seedRate: rate(seeded.size, replied.size),
      passRate: rate(passed.size, replied.size),
      meetingRate: rate(meeting.size, replied.size),
      confirmRate: rate(market.size, replied.size),
    }
  }, [influencers, collabs, period])

  /**
   * 고른 달에 회신이 온 카드를 지금 단계별로 센다.
   * 거절은 '거절한 날' 기준으로 세어 '회신완료' 막대에 함께 쌓는다.
   * (예전에 거절한 분을 뒤늦게 입력해도, 거절일을 고치면 그달로 옮겨간다)
   */
  const stageData = useMemo(() => {
    const key = monthKeyOf(chartMonth)
    const inMonth = collabs.filter((collab) => !key || collab.createdAt.slice(0, 7) === key)
    const rejected = collabs.filter(
      (collab) =>
        collab.isCancelled &&
        (!key || (collab.cancelledAt ?? collab.createdAt).slice(0, 7) === key),
    ).length
    return COLLAB_STAGES.map((stage) => ({
      stage,
      진행: inMonth.filter((collab) => collab.stage === stage && !collab.isCancelled).length,
      거절: stage === COLLAB_STAGES[0] ? rejected : 0,
    }))
  }, [collabs, chartMonth])

  const stageTotals = useMemo(
    () =>
      stageData.reduce(
        (sum, item) => ({ 진행: sum.진행 + item.진행, 거절: sum.거절 + item.거절 }),
        { 진행: 0, 거절: 0 },
      ),
    [stageData],
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

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5">
          {PERIODS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setPeriod(item.key)}
              className={
                period === item.key
                  ? 'rounded-md bg-violet-600 px-4 py-1.5 text-sm font-medium text-white'
                  : 'rounded-md px-4 py-1.5 text-sm text-slate-600 hover:bg-slate-50'
              }
            >
              {item.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-400">
          {PERIODS.find((item) => item.key === period)?.description} 동안 등록한 인플루언서 기준 ·{' '}
          {formatDate(stats.from)}부터
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <StatCard
          label="전체 컨택"
          value={`${formatNumber(stats.contacted)}명`}
          sub="기간 내 등록한 인플루언서"
        />
        <StatCard
          label="회신율"
          basis="전체 컨택"
          value={`${stats.replyRate}%`}
          sub={`회신 ${formatNumber(stats.replied)}명 / 컨택 ${formatNumber(stats.contacted)}명`}
        />
        <StatCard
          label="씨딩율"
          basis="회신"
          value={`${stats.seedRate}%`}
          sub={`씨딩 ${formatNumber(stats.seeded)}명 / 회신 ${formatNumber(stats.replied)}명`}
        />
        <StatCard
          label="테스트통과율"
          basis="회신"
          value={`${stats.passRate}%`}
          sub={`통과 ${formatNumber(stats.passed)}명 / 회신 ${formatNumber(stats.replied)}명`}
        />
        <StatCard
          label="미팅전환율"
          basis="회신"
          value={`${stats.meetingRate}%`}
          sub={`미팅 확정 ${formatNumber(stats.meeting)}명 / 회신 ${formatNumber(stats.replied)}명`}
        />
        <StatCard
          label="확정율"
          basis="회신"
          value={`${stats.confirmRate}%`}
          sub={`마켓 확정 ${formatNumber(stats.market)}명 / 회신 ${formatNumber(stats.replied)}명`}
          tone="success"
        />
      </div>

      {stats.seededWithoutDate > 0 && (
        <Card className="border-amber-200 bg-amber-50 p-4">
          <p className="text-sm text-amber-800">
            <b>배송 날짜가 비어 있는 씨딩 {formatNumber(stats.seededWithoutDate)}명</b>이 있습니다.
          </p>
          <p className="mt-1 text-xs leading-relaxed text-amber-700">
            테스트 단계에 있으니 씨딩으로 셌지만, 배송일이 없어 캘린더와 기록에서는 빠집니다.
            회신완료 카드에 배송 날짜를 넣으면 자동으로 테스트중으로 넘어가는데, 카드의 화살표로
            옮기면 날짜가 비어도 넘어가기 때문입니다.{' '}
            <Link to="/pipeline" className="font-medium underline">
              협업 파이프라인 열기
            </Link>
          </p>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="파이프라인 단계별 현황"
            description={`회신 ${formatNumber(stageTotals.진행)}건 · 거절 ${formatNumber(stageTotals.거절)}건`}
          />
          <div className="px-5 pb-1">
            <MonthPicker value={chartMonth} onChange={setChartMonth} compact />
          </div>
          <div className="h-64 p-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stageData} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="stage" tick={{ fontSize: 12, fill: '#64748b' }} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                <Tooltip cursor={{ fill: '#f8fafc' }} />
                <Legend
                  verticalAlign="top"
                  align="right"
                  height={24}
                  iconType="circle"
                  wrapperStyle={{ fontSize: 12 }}
                />
                <Bar dataKey="진행" stackId="stage" fill="#8b5cf6">
                  {stageData.map((entry) => (
                    <Cell key={entry.stage} fill={STAGE_COLORS[entry.stage]} />
                  ))}
                </Bar>
                <Bar dataKey="거절" stackId="stage" fill={REJECTED_COLOR} radius={[6, 6, 0, 0]} />
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
