import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import PeriodPicker, {
  presetPeriod,
  previousPeriod,
  type PeriodPreset,
} from '@/components/PeriodPicker'
import { Card, CardHeader, EmptyState, Select, Spinner } from '@/components/ui'
import { isMetaMockMode } from '@/data'
import {
  AD_BADGE_LABELS,
  DEFAULT_OPS,
  badgeOf,
  derivedOps,
  type TagDimension,
} from '@/data/adTypes'
import {
  metaConversionRate,
  metaCostPerResult,
  metaCpc,
  metaCtr,
  metaRoas,
  sumInsights,
} from '@/data/metaTypes'
import { useAdTags, useOpsSettings, useShopRevenue, useTagOptions } from '@/hooks/adTagQueries'
import {
  useMetaAdSets,
  useMetaAds,
  useMetaCampaigns,
  useMetaInsights,
  useMetaWeeklySeries,
  useSetAdStatus,
} from '@/hooks/metaQueries'
import { useInfluencers } from '@/hooks/queries'
import {
  applyFilter,
  buildRows,
  byCreative,
  byCreator,
  byTag,
  creativeCount,
  emptyFilter,
  type AdFilter,
  type AdRow,
  type Bucket,
} from '@/utils/adAggregate'
import { formatNumber, formatPercent, formatRatio, formatWon } from '@/utils/format'

/** 겹쳐 그릴 때 서로 구분되는 색 — 소재 성과 화면과 같은 색을 쓴다 */
const LINE_COLORS = ['#7c3aed', '#059669', '#e11d48', '#0284c7', '#d97706', '#4f46e5']

const TABS = [
  { key: 'creative', label: '소재별' },
  { key: 'angle', label: '앵글별' },
  { key: 'format', label: '포맷별' },
  { key: 'creator', label: '크리에이터별' },
] as const

type TabKey = (typeof TABS)[number]['key']

/** 필터를 URL에 싣는다 — 링크로 그대로 공유할 수 있어야 한다 */
const FILTER_KEYS = [
  'campaignId',
  'adsetId',
  'source',
  'format',
  'angle',
  'segment',
  'offer',
] as const

export default function InsightsPage() {
  const [params, setParams] = useSearchParams()
  const [preset, setPreset] = useState<PeriodPreset>('month')
  const [period, setPeriod] = useState(() => presetPeriod('month'))
  /** 추세를 겹쳐 볼 묶음 */
  const [picked, setPicked] = useState<Set<string>>(new Set())
  /** 오른쪽에 펼쳐 볼 묶음 */
  const [openKey, setOpenKey] = useState<string | null>(null)

  const ops = useOpsSettings()
  const campaigns = useMetaCampaigns()
  const adsets = useMetaAdSets()
  const ads = useMetaAds()
  const insights = useMetaInsights('ad', period)
  const before = useMetaInsights(
    'ad',
    useMemo(() => previousPeriod(period), [period]),
  )
  const tags = useAdTags()
  const options = useTagOptions()
  const influencers = useInfluencers()
  const shop = useShopRevenue(period.from, period.to)

  const tab = (params.get('tab') as TabKey) ?? 'creative'

  const filter: AdFilter = useMemo(() => {
    const base = emptyFilter(ops.data?.spentOnlyByDefault ?? true)
    for (const key of FILTER_KEYS) {
      const value = params.get(key)
      if (value) base[key] = value
    }
    const spent = params.get('spentOnly')
    if (spent !== null) base.spentOnly = spent === '1'
    return base
  }, [params, ops.data])

  const setFilter = (patch: Partial<AdFilter>) => {
    const next = new URLSearchParams(params)
    for (const [key, value] of Object.entries(patch)) {
      if (key === 'spentOnly') {
        next.set('spentOnly', value ? '1' : '0')
      } else if (value) {
        next.set(key, String(value))
      } else {
        next.delete(key)
      }
    }
    setParams(next)
  }

  const adsetToCampaign = useMemo(
    () => new Map((adsets.data ?? []).map((set) => [set.id, set.campaignId])),
    [adsets.data],
  )

  const rows = useMemo(
    () => buildRows(ads.data ?? [], insights.data ?? [], tags.data ?? []),
    [ads.data, insights.data, tags.data],
  )
  const shown = useMemo(
    () => applyFilter(rows, filter, adsetToCampaign),
    [rows, filter, adsetToCampaign],
  )

  const loading =
    ads.isLoading || insights.isLoading || ops.isLoading || tags.isLoading || options.isLoading

  const total = sumInsights(
    shown.map((row) => ({ level: 'ad' as const, id: row.ad.id, ...row.insight })),
  )
  // 이전 기간은 같은 필터를 걸 수 없다(그때 태그가 달랐을 수 있다). 전체로 견준다.
  const totalBefore = sumInsights(before.data ?? [])

  // 아직 안 왔을 수 있다. 훅을 모두 지나갈 때까지 기본값으로 버틴다.
  const settings = ops.data ?? DEFAULT_OPS
  const derived = derivedOps(settings, total.revenue, total.results)
  const roas = metaRoas(total)
  const cpa = metaCostPerResult(total)

  const shopData = shop.data
  const hasShop = !!shopData && shopData.revenue > 0
  const mer = hasShop && total.spend > 0 ? shopData.revenue / total.spend : 0
  const newShare = hasShop && shopData.orders > 0 ? (shopData.newOrders / shopData.orders) * 100 : 0

  const nameOf = (id: string) =>
    (influencers.data ?? []).find((row) => row.id === id)?.name ?? '(알 수 없음)'

  const buckets: Bucket[] =
    tab === 'creative'
      ? byCreative(shown)
      : tab === 'creator'
        ? byCreator(shown, nameOf)
        : byTag(shown, tab as TagDimension)

  // 고른 묶음에 속한 광고들의 주간 ROAS를 받아 겹쳐 그린다
  const pickedAdIds = buckets
    .filter((bucket) => picked.has(bucket.key))
    .flatMap((bucket) => bucket.rows.map((row) => row.ad.id))
  const series = useMetaWeeklySeries(pickedAdIds, period)

  /** 주별로 한 줄, 고른 묶음마다 한 칸 */
  const chartData = (() => {
    const keyOfAd = new Map<string, string>()
    for (const bucket of buckets) {
      if (!picked.has(bucket.key)) continue
      for (const row of bucket.rows) keyOfAd.set(row.ad.id, bucket.key)
    }
    // 한 묶음에 광고가 여럿이면 주별로 합쳐야 한다 — 광고마다 선을 그으면 읽을 수 없다
    const acc = new Map<string, Map<string, { spend: number; revenue: number }>>()
    for (const point of series.data ?? []) {
      const key = keyOfAd.get(point.adId)
      if (!key) continue
      const week = acc.get(point.weekStart) ?? new Map()
      const cur = week.get(key) ?? { spend: 0, revenue: 0 }
      week.set(key, { spend: cur.spend + point.spend, revenue: cur.revenue + point.revenue })
      acc.set(point.weekStart, week)
    }
    return [...acc.entries()]
      .map(([week, byKey]) => {
        const row: Record<string, number | string> = { week }
        for (const [key, value] of byKey) {
          row[key] = value.spend > 0 ? Number((value.revenue / value.spend).toFixed(2)) : 0
        }
        return row
      })
      .sort((a, b) => String(a.week).localeCompare(String(b.week)))
  })()

  const labelOfKey = (key: string) => buckets.find((b) => b.key === key)?.label ?? key
  const open = buckets.find((bucket) => bucket.key === openKey) ?? null

  const togglePick = (key: string) =>
    setPicked((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else if (next.size < LINE_COLORS.length) next.add(key)
      return next
    })

  // 훅은 여기까지. 이 아래로는 조건에 따라 건너뛰어도 된다.
  if (loading) return <Spinner />

  const pickList = (dimension: TagDimension) =>
    (options.data ?? []).filter((o) => o.dimension === dimension && o.active)

  return (
    <div className="space-y-4 pb-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">성과 분석</h1>
          <p className="mt-1 text-sm text-slate-500">
            무엇이 왜 좋았는지 태그 단위로 견줍니다. 필터는 주소에 담겨 링크로 공유됩니다.
          </p>
        </div>
        <PeriodPicker
          preset={preset}
          period={period}
          onChange={(nextPreset, nextPeriod) => {
            setPreset(nextPreset)
            setPeriod(nextPeriod)
          }}
        />
      </div>

      {isMetaMockMode && (
        <p className="rounded-lg bg-amber-50 px-4 py-2.5 text-xs text-amber-800">
          예시 데이터 — 메타 계정에 아직 연결되지 않았습니다
        </p>
      )}

      <Card>
        <CardHeader title="필터" description="아래 모든 영역이 이 필터를 따릅니다" />
        <div className="flex flex-wrap items-end gap-2 p-5">
          <Pick
            label="캠페인"
            value={filter.campaignId}
            onChange={(v) => setFilter({ campaignId: v, adsetId: '' })}
            options={(campaigns.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
          />
          <Pick
            label="광고 세트"
            value={filter.adsetId}
            onChange={(v) => setFilter({ adsetId: v })}
            options={(adsets.data ?? [])
              .filter((s) => !filter.campaignId || s.campaignId === filter.campaignId)
              .map((s) => ({ value: s.id, label: s.name }))}
          />
          {(['source', 'format', 'angle', 'segment', 'offer'] as const).map((dimension) => (
            <Pick
              key={dimension}
              label={
                {
                  source: '출처',
                  format: '포맷',
                  angle: '앵글',
                  segment: '세그먼트',
                  offer: '오퍼',
                }[dimension]
              }
              value={filter[dimension]}
              onChange={(v) => setFilter({ [dimension]: v } as Partial<AdFilter>)}
              options={pickList(dimension).map((o) => ({ value: o.label, label: o.label }))}
            />
          ))}
          <label className="flex items-center gap-1.5 pb-2 text-xs text-slate-600">
            <input
              type="checkbox"
              checked={filter.spentOnly}
              onChange={(e) => setFilter({ spentOnly: e.target.checked })}
            />
            지출 있는 것만
          </label>
        </div>
      </Card>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <Kpi
          label="매출"
          value={`${formatWon(total.revenue)}원`}
          sub={`전환 ${formatNumber(total.results)}건`}
          tone="success"
          now={total.revenue}
          before={totalBefore.revenue}
        />
        <Kpi
          label="광고비"
          value={`${formatWon(total.spend)}원`}
          sub={`광고 ${formatNumber(shown.length)}개`}
          now={total.spend}
          before={totalBefore.spend}
        />
        <Kpi
          label="ROAS"
          value={formatRatio(roas)}
          sub={`손익분기 ${settings.breakEvenRoas} · ${roas >= settings.breakEvenRoas ? '넘었습니다' : `${formatRatio(settings.breakEvenRoas - roas)} 모자랍니다`}`}
          now={roas}
          before={metaRoas(totalBefore)}
          warn={roas < settings.breakEvenRoas}
        />
        <Kpi
          label="CPA"
          value={cpa > 0 ? `${formatWon(Math.round(cpa))}원` : '-'}
          sub={
            derived.breakEvenCpa > 0
              ? `손익분기 ${formatWon(derived.breakEvenCpa)}원`
              : '객단가 자료 없음'
          }
          now={cpa}
          before={metaCostPerResult(totalBefore)}
          warn={derived.breakEvenCpa > 0 && cpa > derived.breakEvenCpa}
          lowerIsBetter
        />
        <Kpi
          label="CPC"
          value={`${formatNumber(Math.round(metaCpc(total)))}원`}
          sub={`링크 클릭 ${formatNumber(total.linkClicks)}회`}
          now={metaCpc(total)}
          before={metaCpc(totalBefore)}
          lowerIsBetter
        />
        <Kpi
          label="클릭율 (CTR)"
          value={formatPercent(metaCtr(total))}
          sub={`노출 ${formatNumber(total.impressions)}회`}
          now={metaCtr(total)}
          before={metaCtr(totalBefore)}
        />
        <Kpi
          label="전환율"
          value={formatPercent(metaConversionRate(total))}
          sub="전환 ÷ 링크 클릭"
          now={metaConversionRate(total)}
          before={metaConversionRate(totalBefore)}
        />
        {hasShop && (
          <>
            <Kpi
              label="MER"
              value={formatRatio(mer)}
              sub={`자사몰 실매출 ${formatWon(shopData.revenue)}원 ÷ 광고비`}
            />
            <Kpi
              label="신규 구매 비중"
              value={formatPercent(newShare)}
              sub={`신규 ${formatNumber(shopData.newOrders)}건 / 전체 ${formatNumber(shopData.orders)}건`}
            />
          </>
        )}
      </div>

      {!hasShop && (
        <p className="rounded-lg bg-slate-50 px-4 py-2.5 text-xs text-slate-500">
          MER과 신규 구매 비중은 아임웹 주문 자료가 있어야 나옵니다. 지금은 숨겨 두었습니다.
        </p>
      )}

      <Card>
        <CardHeader
          title="ROAS 추세"
          description="표에서 고른 것끼리 겹쳐 봅니다. 가로선은 손익분기입니다"
          action={
            picked.size > 0 ? (
              <button
                type="button"
                onClick={() => setPicked(new Set())}
                className="text-xs text-slate-500 underline hover:text-violet-600"
              >
                선택 해제
              </button>
            ) : undefined
          }
        />
        {picked.size === 0 ? (
          <EmptyState
            title="견줄 항목을 골라주세요"
            description="아래 표에서 앞의 네모를 누르면 이곳에 추세선이 그려집니다."
          />
        ) : (
          <div className="p-5">
            {series.isFetching && chartData.length === 0 ? (
              <Spinner />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis
                    dataKey="week"
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    tickFormatter={(value: string) => String(value).slice(5).replace('-', '/')}
                  />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                  <Tooltip
                    formatter={(value, name) => [
                      formatRatio(Number(value ?? 0)),
                      labelOfKey(String(name)),
                    ]}
                    labelFormatter={(label) => `${String(label)} 주`}
                  />
                  <Legend formatter={(value) => labelOfKey(String(value))} />
                  <ReferenceLine
                    y={settings.breakEvenRoas}
                    stroke="#f43f5e"
                    strokeDasharray="4 4"
                    label={{
                      value: `손익분기 ${settings.breakEvenRoas}`,
                      position: 'right',
                      style: { fontSize: 10, fill: '#f43f5e' },
                    }}
                  />
                  {[...picked].map((key, index) => (
                    <Line
                      key={key}
                      type="monotone"
                      dataKey={key}
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

      <Card>
        <CardHeader
          title="분석"
          description={
            tab === 'creative'
              ? '같은 소재가 여러 세트에 복제돼 있어, 소재 단위로 합쳐 셉니다'
              : tab === 'creator'
                ? 'UGC 소재만 크리에이터 단위로 합칩니다'
                : '태그 단위로 합칩니다. 줄을 누르면 소재별 탭이 그 태그로 걸러집니다'
          }
        />
        <div className="flex flex-wrap gap-1 border-b border-slate-100 px-5 pb-3">
          {TABS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => {
                const next = new URLSearchParams(params)
                next.set('tab', item.key)
                setParams(next)
              }}
              className={`rounded-lg px-2.5 py-1.5 text-xs transition-colors ${
                tab === item.key
                  ? 'bg-violet-100 font-medium text-violet-700'
                  : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {buckets.length === 0 ? (
          <EmptyState
            title="해당하는 광고가 없습니다"
            description="필터를 풀거나 '지출 있는 것만'을 꺼보세요."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-sm">
              <thead className="border-b border-slate-100 bg-slate-50 text-xs text-slate-500">
                <tr>
                  <th className="w-8 py-2.5 pl-5"></th>
                  <th className="px-2 py-2.5 text-left font-medium">
                    {tab === 'creative' ? '소재' : tab === 'creator' ? '크리에이터' : '태그'}
                  </th>
                  {tab !== 'creative' && (
                    <th className="px-2 py-2.5 text-right font-medium whitespace-nowrap">
                      소재 수
                    </th>
                  )}
                  <th className="px-2 py-2.5 text-right font-medium whitespace-nowrap">지출</th>
                  <th className="px-2 py-2.5 text-right font-medium whitespace-nowrap">전환</th>
                  <th className="px-2 py-2.5 text-right font-medium whitespace-nowrap">ROAS</th>
                  <th className="px-2 py-2.5 text-right font-medium whitespace-nowrap">CPA</th>
                  <th className="px-2 py-2.5 text-right font-medium whitespace-nowrap">CTR</th>
                  <th className="px-2 py-2.5 text-right font-medium whitespace-nowrap">CPC</th>
                  <th className="px-2 py-2.5 text-left font-medium whitespace-nowrap">상태</th>
                  {tab === 'creative' && (
                    <th className="px-5 py-2.5 text-center font-medium whitespace-nowrap">
                      on/off
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {buckets.map((bucket) => {
                  const bRoas = metaRoas(bucket.insight)
                  const badge = badgeOf(
                    bucket.insight.spend,
                    bRoas,
                    derived.minSpend,
                    settings.breakEvenRoas,
                  )
                  const clickable = tab === 'angle' || tab === 'format'
                  return (
                    <tr
                      key={bucket.key}
                      onClick={
                        clickable
                          ? () => {
                              const next = new URLSearchParams(params)
                              next.set('tab', 'creative')
                              if (bucket.label === '(태깅 필요)') next.delete(tab)
                              else next.set(tab, bucket.label)
                              setParams(next)
                            }
                          : undefined
                      }
                      className={
                        clickable ? 'cursor-pointer hover:bg-slate-50' : 'hover:bg-slate-50'
                      }
                    >
                      <td className="py-2.5 pl-5" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={picked.has(bucket.key)}
                          onChange={() => togglePick(bucket.key)}
                          disabled={!picked.has(bucket.key) && picked.size >= LINE_COLORS.length}
                          title="추세를 겹쳐 봅니다"
                        />
                      </td>
                      <td className="max-w-[300px] px-2 py-2.5">
                        <div className="flex items-center gap-2">
                          {tab === 'creative' && bucket.lead.ad.thumbnailUrl && (
                            <img
                              src={bucket.lead.ad.thumbnailUrl}
                              alt=""
                              className="h-9 w-9 shrink-0 rounded object-cover"
                            />
                          )}
                          <div className="min-w-0">
                            <p className="truncate text-slate-900" title={bucket.label}>
                              {bucket.label}
                            </p>
                            {tab === 'creative' && (
                              <p className="text-[11px] text-slate-400">
                                {bucket.rows.length > 1 && `세트 ${bucket.rows.length}곳 · `}
                                {[bucket.lead.tags?.angle, bucket.lead.tags?.format]
                                  .filter(Boolean)
                                  .join(' · ') || '태깅 필요'}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      {tab !== 'creative' && (
                        <td className="tabular px-2 py-2.5 text-right text-slate-500">
                          {formatNumber(creativeCount(bucket))}
                        </td>
                      )}
                      <td className="tabular px-2 py-2.5 text-right whitespace-nowrap text-slate-700">
                        {formatWon(bucket.insight.spend)}
                      </td>
                      <td className="tabular px-2 py-2.5 text-right text-slate-700">
                        {formatNumber(bucket.insight.results)}
                      </td>
                      <td
                        className={`tabular px-2 py-2.5 text-right font-medium ${
                          bRoas >= settings.breakEvenRoas ? 'text-emerald-600' : 'text-slate-700'
                        }`}
                      >
                        {formatRatio(bRoas)}
                      </td>
                      <td className="tabular px-2 py-2.5 text-right whitespace-nowrap text-slate-600">
                        {bucket.insight.results > 0
                          ? formatWon(Math.round(metaCostPerResult(bucket.insight)))
                          : '-'}
                      </td>
                      <td className="tabular px-2 py-2.5 text-right text-slate-600">
                        {formatPercent(metaCtr(bucket.insight))}
                      </td>
                      <td className="tabular px-2 py-2.5 text-right whitespace-nowrap text-slate-600">
                        {formatNumber(Math.round(metaCpc(bucket.insight)))}
                      </td>
                      <td className="px-2 py-2.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setOpenKey(bucket.key)
                          }}
                          title="자세히 보기"
                        >
                          <Badge kind={badge} />
                        </button>
                      </td>
                      {tab === 'creative' && (
                        <td
                          className="px-5 py-2.5 text-center"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <StatusToggles rows={bucket.rows} />
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {open && (
        <Drawer
          bucket={open}
          onClose={() => setOpenKey(null)}
          breakEven={settings.breakEvenRoas}
          adsetName={(id: string) => (adsets.data ?? []).find((set) => set.id === id)?.name ?? id}
        />
      )}
    </div>
  )
}

/**
 * 소재 하나가 여러 세트에 복제돼 있으면 스위치도 여러 개다.
 * 한 번에 끄고 켜면 어느 세트를 건드렸는지 모르게 되므로, 세트마다 따로 둔다.
 */
function StatusToggles({ rows }: { rows: AdRow[] }) {
  const setStatus = useSetAdStatus()
  return (
    <div className="flex items-center justify-center gap-1">
      {rows.map((row) => {
        const active = row.ad.status === 'ACTIVE'
        return (
          <button
            key={row.ad.id}
            type="button"
            role="switch"
            aria-checked={active}
            disabled={setStatus.isPending}
            title={`${row.ad.name} — ${active ? '누르면 일시중지합니다' : '누르면 다시 켭니다'}`}
            onClick={() =>
              setStatus.mutate({ adId: row.ad.id, status: active ? 'PAUSED' : 'ACTIVE' })
            }
            className={`relative h-5 w-9 rounded-full transition-colors disabled:opacity-50 ${
              active ? 'bg-emerald-500' : 'bg-slate-300'
            }`}
          >
            <span
              className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${
                active ? 'left-4.5' : 'left-0.5'
              }`}
            />
          </button>
        )
      })}
    </div>
  )
}

/** 줄 하나를 자세히 — 세트별로 어떻게 갈렸는지 본다 */
function Drawer({
  bucket,
  onClose,
  breakEven,
  adsetName,
}: {
  bucket: Bucket
  onClose: () => void
  breakEven: number
  adsetName: (id: string) => string
}) {
  return (
    <div className="fixed inset-0 z-40 flex justify-end" role="dialog" aria-modal="true">
      <button
        type="button"
        className="flex-1 bg-slate-900/20"
        onClick={onClose}
        aria-label="닫기"
      />
      <div className="flex w-full max-w-md flex-col overflow-y-auto bg-white shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 p-5">
          <div className="min-w-0">
            <h2 className="truncate font-bold text-slate-900">{bucket.label}</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              광고 {formatNumber(bucket.rows.length)}개 · 지출 {formatWon(bucket.insight.spend)}원 ·
              ROAS {formatRatio(metaRoas(bucket.insight))}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-slate-400 hover:bg-slate-100"
          >
            ✕
          </button>
        </div>

        <div className="p-5">
          <p className="text-sm font-medium text-slate-700">세트별로 어떻게 갈렸나</p>
          <p className="mt-0.5 text-xs text-slate-500">
            같은 소재라도 세트에 따라 결과가 다릅니다. 메타가 예산을 고르게 나누지 않기 때문입니다.
          </p>
          <div className="mt-3 space-y-2">
            {[...bucket.rows]
              .sort((a, b) => b.insight.spend - a.insight.spend)
              .map((row) => {
                const roas = metaRoas(row.insight)
                return (
                  <div key={row.ad.id} className="rounded-lg border border-slate-200 p-3">
                    <p className="truncate text-xs text-slate-500" title={row.ad.name}>
                      {adsetName(row.ad.adsetId)}
                    </p>
                    <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
                      <span className="text-slate-700">{formatWon(row.insight.spend)}원</span>
                      <span
                        className={
                          roas >= breakEven ? 'font-medium text-emerald-600' : 'text-slate-700'
                        }
                      >
                        ROAS {formatRatio(roas)}
                      </span>
                      <span className="text-slate-500">
                        전환 {formatNumber(row.insight.results)}건
                      </span>
                      <span className="text-xs text-slate-400">
                        {row.ad.status === 'ACTIVE' ? '켜짐' : '꺼짐'}
                      </span>
                    </div>
                  </div>
                )
              })}
          </div>

          <div className="mt-5 rounded-lg bg-slate-50 p-3">
            <p className="text-xs font-medium text-slate-700">붙어 있는 태그</p>
            <p className="mt-1 text-xs text-slate-600">
              {[
                bucket.lead.tags?.source,
                bucket.lead.tags?.angle,
                bucket.lead.tags?.hook,
                bucket.lead.tags?.format,
                bucket.lead.tags?.segment,
                bucket.lead.tags?.offer,
              ]
                .filter(Boolean)
                .join(' · ') || '아직 태그가 없습니다'}
            </p>
            <a href="/ads/tagging" className="mt-2 inline-block text-xs text-violet-600 underline">
              광고 태깅에서 고치기
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}

function Badge({ kind }: { kind: ReturnType<typeof badgeOf> }) {
  const style = {
    noData: 'bg-slate-100 text-slate-500',
    aboveBreakEven: 'bg-emerald-100 text-emerald-700',
    belowBreakEven: 'bg-rose-100 text-rose-700',
    fatigue: 'bg-amber-100 text-amber-700',
  }[kind]
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap ${style}`}>
      {AD_BADGE_LABELS[kind]}
    </span>
  )
}

function Pick({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <label className="block">
      <span className="text-xs text-slate-500">{label}</span>
      <Select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-0.5 w-auto min-w-[120px] py-1.5 text-xs"
      >
        <option value="">전체</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
    </label>
  )
}

function Kpi({
  label,
  value,
  sub,
  now,
  before,
  tone,
  warn,
  lowerIsBetter,
}: {
  label: string
  value: string
  sub?: string
  now?: number
  before?: number
  tone?: 'success'
  warn?: boolean
  lowerIsBetter?: boolean
}) {
  return (
    <Card className="p-5">
      <p className="text-sm text-slate-500">{label}</p>
      <p
        className={`mt-1 text-2xl font-bold ${
          warn ? 'text-rose-600' : tone === 'success' ? 'text-emerald-600' : 'text-slate-900'
        }`}
      >
        {value}
      </p>
      {sub && <p className="mt-0.5 text-xs text-slate-500">{sub}</p>}
      {now !== undefined && before !== undefined && (
        <div className="mt-1.5">
          <Delta now={now} before={before} lowerIsBetter={lowerIsBetter} />
        </div>
      )}
    </Card>
  )
}

function Delta({
  now,
  before,
  lowerIsBetter,
}: {
  now: number
  before: number
  lowerIsBetter?: boolean
}) {
  if (before === 0) return <span className="text-xs text-slate-300">이전 기간 없음</span>
  const change = ((now - before) / before) * 100
  if (Math.abs(change) < 0.05) return <span className="text-xs text-slate-400">이전과 같음</span>
  const up = change > 0
  const good = lowerIsBetter ? !up : up
  return (
    <span className={good ? 'text-xs text-emerald-600' : 'text-xs text-rose-600'}>
      {up ? '▲' : '▼'} {Math.abs(change).toFixed(1)}%{' '}
      <span className="text-slate-400">이전 기간 대비</span>
    </span>
  )
}
