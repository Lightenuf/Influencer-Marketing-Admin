import { useMemo, useState } from 'react'
import PeriodPicker, {
  periodDays,
  presetPeriod,
  previousPeriod,
  type PeriodPreset,
} from '@/components/PeriodPicker'
import { Card, CardHeader, EmptyState, Spinner } from '@/components/ui'
import { isMetaMockMode } from '@/data'
import {
  META_LEVEL_LABELS,
  metaConversionRate,
  metaCpc,
  metaCtr,
  metaRoas,
  sumInsights,
  type MetaLevel,
} from '@/data/metaTypes'
import { useMetaAdSets, useMetaAds, useMetaCampaigns, useMetaInsights } from '@/hooks/metaQueries'
import { formatNumber, formatPercent, formatRatio, formatWon } from '@/utils/format'

/** 계정 전체를 볼 때도 숫자는 캠페인 단위로 받아 합친다 */
const fetchLevel = (level: MetaLevel) => (level === 'account' ? 'campaign' : level)

function Delta({ now, before }: { now: number; before: number }) {
  if (before === 0) return <span className="text-xs text-slate-300">이전 기간 없음</span>
  const change = ((now - before) / before) * 100
  if (Math.abs(change) < 0.05) return <span className="text-xs text-slate-400">이전과 같음</span>
  const up = change > 0
  return (
    <span className={up ? 'text-xs text-emerald-600' : 'text-xs text-rose-600'}>
      {up ? '▲' : '▼'} {Math.abs(change).toFixed(1)}%{' '}
      <span className="text-slate-400">이전 기간 대비</span>
    </span>
  )
}

function MetricCard({
  label,
  value,
  sub,
  now,
  before,
  tone = 'default',
}: {
  label: string
  value: string
  sub?: string
  now?: number
  before?: number
  tone?: 'default' | 'success'
}) {
  return (
    <Card className="p-5">
      <p className="text-sm text-slate-500">{label}</p>
      <p
        className={
          tone === 'success'
            ? 'mt-1 text-2xl font-bold text-emerald-600'
            : 'mt-1 text-2xl font-bold text-slate-900'
        }
      >
        {value}
      </p>
      {sub && <p className="mt-0.5 text-xs text-slate-400">{sub}</p>}
      {now !== undefined && before !== undefined && (
        <p className="mt-1">
          <Delta now={now} before={before} />
        </p>
      )}
    </Card>
  )
}

export default function AdsDashboardPage() {
  const [preset, setPreset] = useState<PeriodPreset>('month')
  const [period, setPeriod] = useState(() => presetPeriod('month'))
  const [level, setLevel] = useState<MetaLevel>('account')

  const previous = useMemo(() => previousPeriod(period), [period])

  const { data: campaigns = [] } = useMetaCampaigns()
  const { data: adsets = [] } = useMetaAdSets()
  const { data: ads = [] } = useMetaAds()
  const { data: insights = [], isLoading } = useMetaInsights(fetchLevel(level), period)
  const { data: beforeInsights = [] } = useMetaInsights(fetchLevel(level), previous)

  const total = useMemo(() => sumInsights(insights), [insights])
  const totalBefore = useMemo(() => sumInsights(beforeInsights), [beforeInsights])

  /**
   * 하루에 쓰기로 한 돈.
   * 예산은 캠페인 예산 최적화면 캠페인에, 아니면 광고 세트에 붙는다.
   */
  const dailyBudget = useMemo(() => {
    const fromCampaigns = campaigns
      .filter((campaign) => campaign.isCbo && campaign.status === 'ACTIVE')
      .reduce((sum, campaign) => sum + (campaign.dailyBudget ?? 0), 0)
    const cboIds = new Set(campaigns.filter((campaign) => campaign.isCbo).map((c) => c.id))
    const fromAdSets = adsets
      .filter((adset) => adset.status === 'ACTIVE' && !cboIds.has(adset.campaignId))
      .reduce((sum, adset) => sum + (adset.dailyBudget ?? 0), 0)
    return fromCampaigns + fromAdSets
  }, [campaigns, adsets])

  const days = periodDays(period)
  const plannedSpend = dailyBudget * days
  const burnRate = plannedSpend > 0 ? (total.spend / plannedSpend) * 100 : 0

  const nameOf = (id: string) => {
    if (level === 'campaign') return campaigns.find((item) => item.id === id)?.name ?? id
    if (level === 'adset') return adsets.find((item) => item.id === id)?.name ?? id
    return ads.find((item) => item.id === id)?.name ?? id
  }

  const rows = useMemo(() => [...insights].sort((a, b) => b.revenue - a.revenue), [insights])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">광고 대시보드</h1>
          <p className="mt-1 text-sm text-slate-500">
            메타 광고 성과를 계정·캠페인·광고 세트·광고 단위로 봅니다.
          </p>
        </div>
        {isMetaMockMode && (
          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700">
            예시 데이터 — 메타 계정에 아직 연결되지 않았습니다
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <PeriodPicker
          preset={preset}
          period={period}
          onChange={(nextPreset, nextPeriod) => {
            setPreset(nextPreset)
            setPeriod(nextPeriod)
          }}
        />
        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5">
          {(Object.keys(META_LEVEL_LABELS) as MetaLevel[]).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setLevel(item)}
              className={
                level === item
                  ? 'rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white'
                  : 'rounded-md px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50'
              }
            >
              {META_LEVEL_LABELS[item]}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <Spinner />
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <MetricCard
              label="매출"
              value={`${formatWon(total.revenue)}원`}
              sub={`전환 ${formatNumber(total.results)}건`}
              now={total.revenue}
              before={totalBefore.revenue}
              tone="success"
            />
            <MetricCard
              label="광고비"
              value={`${formatWon(total.spend)}원`}
              sub={
                plannedSpend > 0
                  ? `일예산 ${formatWon(dailyBudget)}원 × ${days}일 중 ${burnRate.toFixed(0)}% 소진`
                  : '설정된 일예산 없음'
              }
              now={total.spend}
              before={totalBefore.spend}
            />
            <MetricCard
              label="ROAS"
              value={formatRatio(metaRoas(total))}
              sub="매출 ÷ 광고비"
              now={metaRoas(total)}
              before={metaRoas(totalBefore)}
            />
            <MetricCard
              label="CPC"
              value={`${formatNumber(Math.round(metaCpc(total)))}원`}
              sub={`링크 클릭 ${formatNumber(total.linkClicks)}회`}
              now={metaCpc(total)}
              before={metaCpc(totalBefore)}
            />
            <MetricCard
              label="클릭율 (CTR)"
              value={formatPercent(metaCtr(total))}
              sub={`노출 ${formatNumber(total.impressions)}회`}
              now={metaCtr(total)}
              before={metaCtr(totalBefore)}
            />
            <MetricCard
              label="전환율"
              value={formatPercent(metaConversionRate(total))}
              sub="전환 ÷ 링크 클릭"
              now={metaConversionRate(total)}
              before={metaConversionRate(totalBefore)}
            />
          </div>

          {level !== 'account' && (
            <Card>
              <CardHeader
                title={`${META_LEVEL_LABELS[level]}별 성과`}
                description="매출이 큰 순서"
              />
              {rows.length === 0 ? (
                <EmptyState title="이 기간에 집행한 광고가 없습니다" />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-y border-slate-100 bg-slate-50 text-xs text-slate-500">
                      <tr>
                        <th className="px-5 py-2.5 text-left font-medium">
                          {META_LEVEL_LABELS[level]}
                        </th>
                        <th className="px-3 py-2.5 text-right font-medium">매출</th>
                        <th className="px-3 py-2.5 text-right font-medium">광고비</th>
                        <th className="px-3 py-2.5 text-right font-medium">ROAS</th>
                        <th className="px-3 py-2.5 text-right font-medium">CPC</th>
                        <th className="px-3 py-2.5 text-right font-medium">CTR</th>
                        <th className="px-5 py-2.5 text-right font-medium">전환율</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {rows.map((row) => (
                        <tr key={row.id} className="hover:bg-slate-50">
                          <td className="px-5 py-3 text-slate-900">{nameOf(row.id)}</td>
                          <td className="tabular px-3 py-3 text-right font-medium text-slate-900">
                            {formatWon(row.revenue)}
                          </td>
                          <td className="tabular px-3 py-3 text-right text-slate-600">
                            {formatWon(row.spend)}
                          </td>
                          <td className="tabular px-3 py-3 text-right text-slate-900">
                            {formatRatio(metaRoas(row))}
                          </td>
                          <td className="tabular px-3 py-3 text-right text-slate-600">
                            {formatNumber(Math.round(metaCpc(row)))}
                          </td>
                          <td className="tabular px-3 py-3 text-right text-slate-600">
                            {formatPercent(metaCtr(row))}
                          </td>
                          <td className="tabular px-5 py-3 text-right text-slate-600">
                            {formatPercent(metaConversionRate(row))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )}
        </>
      )}
    </div>
  )
}
