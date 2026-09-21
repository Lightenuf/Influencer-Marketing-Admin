import { useMemo, useState } from 'react'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import PeriodPicker, { presetPeriod, type PeriodPreset } from '@/components/PeriodPicker'
import { Card, CardHeader, EmptyState, Spinner } from '@/components/ui'
import { isMetaMockMode } from '@/data'
import {
  metaCostPerResult,
  metaCpc,
  metaCtr,
  metaRoas,
  sumInsights,
  type MetaInsight,
} from '@/data/metaTypes'
import {
  useMetaAdSets,
  useMetaAds,
  useMetaCampaigns,
  useMetaInsights,
  useMetaWeeklySeries,
} from '@/hooks/metaQueries'
import { formatDate, formatNumber, formatPercent, formatRatio, formatWon } from '@/utils/format'

/** 소재를 겹쳐 그릴 때 서로 구분되는 색 */
const LINE_COLORS = [
  '#7c3aed',
  '#059669',
  '#e11d48',
  '#0284c7',
  '#d97706',
  '#4f46e5',
  '#0f766e',
  '#be123c',
]

const EMPTY: Omit<MetaInsight, 'level' | 'id'> = {
  spend: 0,
  revenue: 0,
  results: 0,
  reach: 0,
  impressions: 0,
  linkClicks: 0,
}

function StatusDot({ active }: { active: boolean }) {
  return (
    <span
      title={active ? '켜짐' : '일시중지'}
      className={
        active
          ? 'inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500'
          : 'inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300'
      }
    />
  )
}

/** 표의 숫자 칸들 — 계층 어디서든 같은 순서로 보여준다 */
function MetricCells({ stat }: { stat: Omit<MetaInsight, 'level' | 'id'> }) {
  return (
    <>
      <td className="tabular px-3 py-2.5 text-right whitespace-nowrap text-slate-700">
        {formatWon(stat.spend)}
      </td>
      <td className="tabular px-3 py-2.5 text-right whitespace-nowrap text-slate-700">
        {formatNumber(stat.results)}
      </td>
      <td className="tabular px-3 py-2.5 text-right whitespace-nowrap font-medium text-slate-900">
        {formatRatio(metaRoas(stat))}
      </td>
      <td className="tabular px-3 py-2.5 text-right whitespace-nowrap text-slate-600">
        {formatNumber(Math.round(metaCostPerResult(stat)))}
      </td>
      <td className="tabular px-3 py-2.5 text-right whitespace-nowrap text-slate-600">
        {formatWon(stat.reach)}
      </td>
      <td className="tabular px-3 py-2.5 text-right whitespace-nowrap text-slate-600">
        {formatWon(stat.impressions)}
      </td>
      <td className="tabular px-3 py-2.5 text-right whitespace-nowrap text-slate-600">
        {formatNumber(stat.linkClicks)}
      </td>
      <td className="tabular px-3 py-2.5 text-right whitespace-nowrap text-slate-600">
        {formatNumber(Math.round(metaCpc(stat)))}
      </td>
      <td className="tabular px-5 py-2.5 text-right whitespace-nowrap text-slate-600">
        {formatPercent(metaCtr(stat))}
      </td>
    </>
  )
}

export default function CreativePerformancePage() {
  const [preset, setPreset] = useState<PeriodPreset>('month')
  const [period, setPeriod] = useState(() => presetPeriod('month'))
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [picked, setPicked] = useState<Set<string>>(new Set())

  const { data: campaigns = [] } = useMetaCampaigns()
  const { data: adsets = [] } = useMetaAdSets()
  const { data: ads = [], isLoading } = useMetaAds()
  const { data: adInsights = [] } = useMetaInsights('ad', period)

  const statOf = useMemo(() => new Map(adInsights.map((item) => [item.id, item])), [adInsights])

  const adsOfSet = useMemo(() => {
    const map = new Map<string, typeof ads>()
    for (const ad of ads) {
      const list = map.get(ad.adsetId) ?? []
      list.push(ad)
      map.set(ad.adsetId, list)
    }
    return map
  }, [ads])

  const setsOfCampaign = useMemo(() => {
    const map = new Map<string, typeof adsets>()
    for (const adset of adsets) {
      const list = map.get(adset.campaignId) ?? []
      list.push(adset)
      map.set(adset.campaignId, list)
    }
    return map
  }, [adsets])

  const sumOfAds = (adIds: string[]) =>
    sumInsights(adIds.map((id) => statOf.get(id)).filter((item): item is MetaInsight => !!item))

  const toggleFold = (id: string) =>
    setCollapsed((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const togglePick = (id: string) =>
    setPicked((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const pickedIds = useMemo(() => [...picked], [picked])
  const { data: series = [], isFetching: seriesLoading } = useMetaWeeklySeries(pickedIds, period)

  /** 주별로 한 줄, 고른 소재마다 한 칸 — 겹쳐 그리기 위한 모양 */
  const chartData = useMemo(() => {
    const byWeek = new Map<string, Record<string, number | string>>()
    for (const point of series) {
      const row = byWeek.get(point.weekStart) ?? { week: point.weekStart }
      row[point.adId] = Number(point.roas.toFixed(2))
      byWeek.set(point.weekStart, row)
    }
    return [...byWeek.values()].sort((a, b) => String(a.week).localeCompare(String(b.week)))
  }, [series])

  const nameOfAd = (id: string) => ads.find((ad) => ad.id === id)?.name ?? id

  if (isLoading) return <Spinner />

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">소재 성과</h1>
          <p className="mt-1 text-sm text-slate-500">
            캠페인 → 광고 세트 → 소재 순으로 펼쳐 보고, 고른 소재끼리 추세를 견줍니다.
          </p>
        </div>
        {isMetaMockMode && (
          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700">
            예시 데이터 — 메타 계정에 아직 연결되지 않았습니다
          </span>
        )}
      </div>

      <PeriodPicker
        preset={preset}
        period={period}
        onChange={(nextPreset, nextPeriod) => {
          setPreset(nextPreset)
          setPeriod(nextPeriod)
        }}
      />

      <Card>
        <CardHeader
          title="소재 목록"
          description="소재 앞의 네모를 누르면 아래 추세선에 겹쳐 그려집니다"
        />
        <div className="overflow-x-auto">
          {/* 칸이 많아 좁은 화면에서는 글자가 눌린다. 줄이는 대신 가로로 넘긴다. */}
          <table className="w-full min-w-[1180px] text-sm">
            <thead className="border-y border-slate-100 bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="px-5 py-2.5 text-left font-medium">이름</th>
                <th className="px-3 py-2.5 text-left font-medium whitespace-nowrap">일정</th>
                <th className="px-3 py-2.5 text-right font-medium whitespace-nowrap">예산</th>
                <th className="px-3 py-2.5 text-right font-medium whitespace-nowrap">지출 금액</th>
                <th className="px-3 py-2.5 text-right font-medium">결과</th>
                <th className="px-3 py-2.5 text-right font-medium whitespace-nowrap">결과 ROAS</th>
                <th className="px-3 py-2.5 text-right font-medium whitespace-nowrap">
                  결과당 비용
                </th>
                <th className="px-3 py-2.5 text-right font-medium">도달</th>
                <th className="px-3 py-2.5 text-right font-medium">노출</th>
                <th className="px-3 py-2.5 text-right font-medium whitespace-nowrap">링크 클릭</th>
                <th className="px-3 py-2.5 text-right font-medium">CPC</th>
                <th className="px-5 py-2.5 text-right font-medium">CTR</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {campaigns.map((campaign) => {
                const sets = setsOfCampaign.get(campaign.id) ?? []
                const campaignAdIds = sets.flatMap((adset) =>
                  (adsOfSet.get(adset.id) ?? []).map((ad) => ad.id),
                )
                const campaignStat = sumOfAds(campaignAdIds)
                const folded = collapsed.has(campaign.id)

                return [
                  <tr key={campaign.id} className="bg-slate-50/60">
                    <td className="px-5 py-2.5">
                      <button
                        type="button"
                        onClick={() => toggleFold(campaign.id)}
                        className="flex items-center gap-1.5 text-left font-semibold whitespace-nowrap text-slate-900"
                      >
                        <span className="w-3 text-slate-400">{folded ? '▸' : '▾'}</span>
                        <StatusDot active={campaign.status === 'ACTIVE'} />
                        {campaign.name}
                        {campaign.isCbo && (
                          <span className="rounded bg-slate-200 px-1 text-[10px] text-slate-600">
                            CBO
                          </span>
                        )}
                      </button>
                    </td>
                    <td className="px-3 py-2.5 text-slate-300">-</td>
                    <td className="tabular px-3 py-2.5 text-right whitespace-nowrap text-slate-600">
                      {campaign.dailyBudget ? `${formatWon(campaign.dailyBudget)}/일` : '-'}
                    </td>
                    <MetricCells stat={campaignStat} />
                  </tr>,

                  ...(folded
                    ? []
                    : sets.flatMap((adset) => {
                        const adsHere = adsOfSet.get(adset.id) ?? []
                        const setStat = sumOfAds(adsHere.map((ad) => ad.id))
                        const setFolded = collapsed.has(adset.id)

                        return [
                          <tr key={adset.id} className="hover:bg-slate-50">
                            <td className="px-5 py-2.5 pl-10">
                              <button
                                type="button"
                                onClick={() => toggleFold(adset.id)}
                                className="flex items-center gap-1.5 text-left font-medium whitespace-nowrap text-slate-800"
                              >
                                <span className="w-3 text-slate-400">{setFolded ? '▸' : '▾'}</span>
                                <StatusDot active={adset.status === 'ACTIVE'} />
                                {adset.name}
                              </button>
                            </td>
                            <td className="px-3 py-2.5 text-xs whitespace-nowrap text-slate-500">
                              {formatDate(adset.startDate)}
                              {adset.endDate ? ` ~ ${formatDate(adset.endDate)}` : ' ~ 계속'}
                            </td>
                            <td className="tabular px-3 py-2.5 text-right whitespace-nowrap text-slate-600">
                              {adset.dailyBudget ? `${formatWon(adset.dailyBudget)}/일` : '캠페인'}
                            </td>
                            <MetricCells stat={setStat} />
                          </tr>,

                          ...(setFolded
                            ? []
                            : adsHere.map((ad) => {
                                const stat = statOf.get(ad.id) ?? EMPTY
                                return (
                                  <tr key={ad.id} className="hover:bg-violet-50/40">
                                    <td className="px-5 py-2.5 pl-16">
                                      <label className="flex items-center gap-2">
                                        <input
                                          type="checkbox"
                                          checked={picked.has(ad.id)}
                                          onChange={() => togglePick(ad.id)}
                                          className="h-3.5 w-3.5 accent-violet-600"
                                        />
                                        <StatusDot active={ad.status === 'ACTIVE'} />
                                        <span className="whitespace-nowrap text-slate-700">
                                          {ad.name}
                                        </span>
                                        <span className="rounded bg-slate-100 px-1 text-[10px] whitespace-nowrap text-slate-500">
                                          {ad.creativeType === 'video' ? '영상' : '이미지'}
                                        </span>
                                        {ad.isPartnership && (
                                          <span className="rounded bg-violet-100 px-1 text-[10px] whitespace-nowrap text-violet-700">
                                            파트너십
                                          </span>
                                        )}
                                      </label>
                                    </td>
                                    <td className="px-3 py-2.5 text-slate-300">-</td>
                                    <td className="px-3 py-2.5 text-right text-slate-300">-</td>
                                    <MetricCells stat={stat} />
                                  </tr>
                                )
                              })),
                        ]
                      })),
                ]
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="소재 성과 추세"
          description="주 단위 ROAS · 고른 소재를 겹쳐 그립니다"
          action={
            picked.size > 0 ? (
              <button
                type="button"
                onClick={() => setPicked(new Set())}
                className="text-xs text-slate-500 hover:text-violet-600"
              >
                선택 해제
              </button>
            ) : undefined
          }
        />
        {picked.size === 0 ? (
          <EmptyState
            title="견줄 소재를 골라주세요"
            description="위 목록에서 소재 앞의 네모를 누르면 이곳에 추세선이 그려집니다."
          />
        ) : (
          <div className="p-5">
            {seriesLoading && chartData.length === 0 ? (
              <Spinner />
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis
                    dataKey="week"
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    tickFormatter={(value: string) => value.slice(5).replace('-', '/')}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    label={{
                      value: 'ROAS',
                      angle: -90,
                      position: 'insideLeft',
                      style: { fontSize: 11, fill: '#94a3b8' },
                    }}
                  />
                  <Tooltip
                    formatter={(value, name) => [
                      formatRatio(Number(value ?? 0)),
                      nameOfAd(String(name)),
                    ]}
                    labelFormatter={(label) => `${String(label)} 주`}
                  />
                  <Legend formatter={(value) => nameOfAd(String(value))} />
                  {pickedIds.map((adId, index) => (
                    <Line
                      key={adId}
                      type="monotone"
                      dataKey={adId}
                      stroke={LINE_COLORS[index % LINE_COLORS.length]}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      connectNulls
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        )}
      </Card>
    </div>
  )
}
