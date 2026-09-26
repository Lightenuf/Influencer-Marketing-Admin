import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useCurrentUser } from '@/auth/AuthProvider'
import { Button, Card, CardHeader, EmptyState, Modal, Select, Spinner } from '@/components/ui'
import { isMetaMockMode } from '@/data'
import { adTagRepository, type StoredSuggestion } from '@/data/adTagRepository'
import { DEFAULT_OPS, derivedOps } from '@/data/adTypes'
import { metaCostPerResult, metaRoas, sumInsights } from '@/data/metaTypes'
import { useAdTags, useOpsSettings } from '@/hooks/adTagQueries'
import {
  useMetaAdSets,
  useMetaAds,
  useMetaCampaigns,
  useMetaDailySeries,
  useMetaInsights,
  useSetAdStatus,
  useSetDailyBudget,
} from '@/hooks/metaQueries'
import { buildRows } from '@/utils/adAggregate'
import { RULE_LABELS, buildSuggestions, whyEmpty, type RuleKind } from '@/utils/adRules'
import { formatNumber, formatRatio, formatWon } from '@/utils/format'

/** 며칠치를 보고 판단할지는 운영 기준에서 읽지만, 지표를 받아올 때 쓸 기본값 */
const daysAgo = (days: number) => {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return date.toISOString().slice(0, 10)
}
const yesterday = () => daysAgo(1)

const HOLD_REASONS = ['더 지켜본다', '예산이 없다', '시즌이 끝난다', '다른 계획이 있다', '기타']
const IGNORE_REASONS = ['규칙이 틀렸다', '이미 처리했다', '대상이 잘못됐다', '기타']

export default function ActionsPage() {
  const user = useCurrentUser()
  const client = useQueryClient()
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') === 'log' ? 'log' : 'open'

  const ops = useOpsSettings()
  const settings = ops.data ?? DEFAULT_OPS

  // 오늘 값은 아직 확정이 아니다. 어제까지만 보고 판단한다 (7장 계산 시점)
  const period = useMemo(
    () => ({ from: daysAgo(settings.judgeDays), to: yesterday() }),
    [settings.judgeDays],
  )

  const campaigns = useMetaCampaigns()
  const adsets = useMetaAdSets()
  const ads = useMetaAds()
  const adInsights = useMetaInsights('ad', period)
  const campaignInsights = useMetaInsights('campaign', period)
  const adsetInsights = useMetaInsights('adset', period)
  const tags = useAdTags()

  // 피로도는 켜져 있고 돈이 나간 광고만 보면 된다 — 306개를 다 부를 이유가 없다
  const fatigueIds = useMemo(
    () =>
      (adInsights.data ?? [])
        .filter((row) => row.spend > 0)
        .map((row) => row.id)
        .slice(0, 40),
    [adInsights.data],
  )
  const daily = useMetaDailySeries(fatigueIds, period)

  const stored = useQuery({
    queryKey: ['adActions', 'suggestions'],
    queryFn: () => adTagRepository.listSuggestions(),
  })
  const logs = useQuery({
    queryKey: ['adActions', 'logs'],
    queryFn: () => adTagRepository.listActionLogs(),
  })

  const setStatus = useSetAdStatus()
  const setBudget = useSetDailyBudget()

  const rows = useMemo(
    () => buildRows(ads.data ?? [], adInsights.data ?? [], tags.data ?? []),
    [ads.data, adInsights.data, tags.data],
  )

  const total = sumInsights(
    rows.map((row) => ({ level: 'ad' as const, id: row.ad.id, ...row.insight })),
  )
  const derived = derivedOps(settings, total.revenue, total.results)
  const breakEven = derived.effectiveRoas

  const ruleInput = useMemo(
    () => ({
      ops: settings,
      rows: rows.filter((row) => row.insight.spend > 0 || row.ad.status === 'ACTIVE'),
      campaigns: campaigns.data ?? [],
      adsets: adsets.data ?? [],
      ads: ads.data ?? [],
      insights: adInsights.data ?? [],
      campaignInsights: campaignInsights.data ?? [],
      adsetInsights: adsetInsights.data ?? [],
      daily: daily.data ?? [],
      // 마지막 예산 변경은 실행 로그에서 읽는다 — 어드민 밖 변경은 아직 모른다
      lastBudgetChange: new Map(
        (logs.data ?? [])
          .filter((log) => log.action === 'executed' && log.kind.includes('crease'))
          .map((log) => [`${log.targetLevel}:${log.targetId}`, log.createdAt]),
      ),
      breakEven,
      minSpend: derived.minSpend,
    }),
    [
      settings,
      rows,
      campaigns.data,
      adsets.data,
      ads.data,
      adInsights.data,
      campaignInsights.data,
      adsetInsights.data,
      daily.data,
      logs.data,
      breakEven,
      derived.minSpend,
    ],
  )

  const recalc = useMutation({
    mutationFn: () => {
      const made = buildSuggestions(ruleInput)
      return adTagRepository.replaceSuggestions(
        made.map((row) => ({
          kind: row.kind,
          targetLevel: row.targetLevel,
          targetId: row.targetId,
          targetName: row.targetName,
          accountId: '',
          evidence: row.evidence,
          effect: row.effect as unknown as Record<string, unknown> | null,
          confident: row.confident,
          needsApproval: row.needsApproval,
          title: row.title,
        })),
      )
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ['adActions', 'suggestions'] }),
  })

  const decide = useMutation({
    mutationFn: async (input: { suggestion: StoredSuggestion; action: string; reason: string }) => {
      const { suggestion, action, reason } = input
      const insight =
        suggestion.targetLevel === 'ad'
          ? (adInsights.data ?? []).find((row) => row.id === suggestion.targetId)
          : suggestion.targetLevel === 'campaign'
            ? (campaignInsights.data ?? []).find((row) => row.id === suggestion.targetId)
            : (adsetInsights.data ?? []).find((row) => row.id === suggestion.targetId)

      // 실행 직전 지표를 굳혀 둔다. 7일 뒤와 견주려면 그때 값이 있어야 한다.
      const before: Record<string, number> = insight
        ? {
            spend: Math.round(insight.spend),
            revenue: Math.round(insight.revenue),
            results: insight.results,
            roas: Number(metaRoas(insight).toFixed(2)),
            cpa: Math.round(metaCostPerResult(insight)),
          }
        : {}

      // 실제로 메타를 건드리는 것은 여기뿐이다
      if (action === 'executed') {
        const effect = suggestion.effect as
          { kind: 'budget'; to: number } | { kind: 'status'; to: 'PAUSED' } | null
        if (effect?.kind === 'budget') {
          await setBudget.mutateAsync({
            level: suggestion.targetLevel as 'campaign' | 'adset',
            id: suggestion.targetId,
            won: effect.to,
          })
        } else if (effect?.kind === 'status') {
          await setStatus.mutateAsync({ adId: suggestion.targetId, status: effect.to })
        }
      }

      return adTagRepository.decideSuggestion({
        suggestion,
        action,
        reason,
        before,
        actorId: user.id,
      })
    },
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['adActions'] })
      setAsking(null)
    },
  })

  const [asking, setAsking] = useState<{
    suggestion: StoredSuggestion
    action: string
  } | null>(null)
  const [reason, setReason] = useState('')

  const loading = ops.isLoading || ads.isLoading || adInsights.isLoading || stored.isLoading

  if (loading) return <Spinner />

  const open = stored.data ?? []

  return (
    <div className="space-y-4 pb-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">오늘의 액션</h1>
          <p className="mt-1 text-sm text-slate-500">
            규칙이 제안을 만들고, <b>누르셔야 실행됩니다.</b> 저절로 바뀌는 것은 없습니다.
          </p>
        </div>
        <Button variant="secondary" onClick={() => recalc.mutate()} disabled={recalc.isPending}>
          {recalc.isPending ? '계산 중...' : '다시 계산'}
        </Button>
      </div>

      {isMetaMockMode && (
        <p className="rounded-lg bg-amber-50 px-4 py-2.5 text-xs text-amber-800">
          예시 데이터 — 메타 계정에 아직 연결되지 않았습니다
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-4">
        <Mini
          label="판단 기간"
          value={`${settings.judgeDays}일`}
          note={`${period.from} ~ ${period.to}`}
        />
        <Mini
          label="손익분기 ROAS"
          value={formatRatio(breakEven)}
          note={
            settings.metaAttributionFactor !== 1
              ? `${settings.breakEvenRoas} × 보정 ${settings.metaAttributionFactor}`
              : '보정 없음'
          }
        />
        <Mini
          label="판단 최소 지출"
          value={formatWon(derived.minSpend)}
          note="이보다 적으면 데이터 부족"
        />
        <Mini label="열린 제안" value={`${formatNumber(open.length)}개`} strong />
      </div>

      <div className="flex flex-wrap gap-1 border-b border-slate-200">
        {[
          { key: 'open', label: `제안 ${open.length}` },
          { key: 'log', label: '실행 로그' },
        ].map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setParams(item.key === 'log' ? { tab: 'log' } : {})}
            className={`-mb-px border-b-2 px-3 py-2 text-sm transition-colors ${
              tab === item.key
                ? 'border-violet-500 font-medium text-violet-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'open' ? (
        open.length === 0 ? (
          <Card>
            <EmptyState
              title="지금 손댈 것이 없습니다"
              description={
                recalc.isSuccess || stored.isFetched
                  ? whyEmpty(ruleInput)
                  : '다시 계산을 눌러보세요.'
              }
              action={
                <Button variant="secondary" onClick={() => recalc.mutate()}>
                  다시 계산
                </Button>
              }
            />
          </Card>
        ) : (
          <div className="space-y-3">
            {open.map((suggestion) => (
              <SuggestionCard
                key={suggestion.id}
                suggestion={suggestion}
                onDecide={(action) => {
                  setAsking({ suggestion, action })
                  setReason('')
                }}
              />
            ))}
          </div>
        )
      ) : (
        <LogTable logs={logs.data ?? []} />
      )}

      <Modal
        open={!!asking}
        onClose={() => setAsking(null)}
        title={
          asking?.action === 'executed'
            ? '정말 실행할까요?'
            : asking?.action === 'held'
              ? '보류하는 이유는?'
              : '무시하는 이유는?'
        }
        width="max-w-md"
      >
        {asking && (
          <div className="space-y-3 text-sm">
            <p className="text-slate-700">{asking.suggestion.title}</p>
            {asking.action === 'executed' && asking.suggestion.effect && (
              <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-700">
                {describeEffect(asking.suggestion.effect)}
              </p>
            )}
            {asking.action === 'executed' && asking.suggestion.needsApproval && (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800">
                가드레일에 걸린 변경입니다. 승인 권한이 있는 분만 실행해주세요.
              </p>
            )}
            {asking.action !== 'executed' && (
              <Select value={reason} onChange={(e) => setReason(e.target.value)}>
                <option value="">사유를 고르세요</option>
                {(asking.action === 'held' ? HOLD_REASONS : IGNORE_REASONS).map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </Select>
            )}
          </div>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setAsking(null)}>
            아니요
          </Button>
          <Button
            onClick={() => asking && decide.mutate({ ...asking, reason })}
            disabled={decide.isPending || (asking?.action !== 'executed' && !reason)}
          >
            {decide.isPending ? '처리 중...' : '네'}
          </Button>
        </div>
      </Modal>
    </div>
  )
}

function describeEffect(effect: Record<string, unknown>): string {
  if (effect.kind === 'budget') {
    return `일예산 ${formatWon(Number(effect.from))}원 → ${formatWon(Number(effect.to))}원`
  }
  if (effect.kind === 'status') return '광고를 일시중지합니다'
  return ''
}

function SuggestionCard({
  suggestion,
  onDecide,
}: {
  suggestion: StoredSuggestion
  onDecide: (action: string) => void
}) {
  const kind = suggestion.kind as RuleKind
  const tone = {
    off: 'bg-rose-100 text-rose-700',
    decrease: 'bg-rose-100 text-rose-700',
    increase: 'bg-emerald-100 text-emerald-700',
    promote: 'bg-emerald-100 text-emerald-700',
    scaleTest: 'bg-sky-100 text-sky-700',
    replace: 'bg-amber-100 text-amber-700',
    fatigue: 'bg-amber-100 text-amber-700',
    thinAdSet: 'bg-slate-100 text-slate-600',
  }[kind]

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${tone}`}>
              {RULE_LABELS[kind] ?? kind}
            </span>
            {!suggestion.confident && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">
                데이터 부족
              </span>
            )}
            {suggestion.needsApproval && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                승인 필요
              </span>
            )}
          </div>
          <p className="mt-2 font-medium text-slate-900">{suggestion.title}</p>

          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
            {Object.entries(suggestion.evidence).map(([key, value]) => (
              <span key={key}>
                {key.replace(/_/g, ' ')}{' '}
                <b className="text-slate-700">
                  {typeof value === 'number' ? formatNumber(value) : String(value)}
                </b>
              </span>
            ))}
          </div>

          {suggestion.effect && (
            <p className="mt-2 text-xs text-violet-700">{describeEffect(suggestion.effect)}</p>
          )}
        </div>

        <div className="flex shrink-0 gap-2">
          <Button size="sm" variant="ghost" onClick={() => onDecide('ignored')}>
            무시
          </Button>
          <Button size="sm" variant="secondary" onClick={() => onDecide('held')}>
            보류
          </Button>
          <Button size="sm" onClick={() => onDecide('executed')}>
            실행
          </Button>
        </div>
      </div>
    </Card>
  )
}

function LogTable({ logs }: { logs: LogRow[] }) {
  if (logs.length === 0) {
    return (
      <Card>
        <EmptyState title="아직 기록이 없습니다" description="제안을 실행하면 여기에 남습니다." />
      </Card>
    )
  }

  // 규칙별 적중률 — 시니어가 기준값을 고칠 근거가 된다 (7-4)
  const byKind = new Map<string, { done: number; better: number; worse: number }>()
  for (const log of logs) {
    if (log.action !== 'executed') continue
    const cur = byKind.get(log.kind) ?? { done: 0, better: 0, worse: 0 }
    cur.done += 1
    if (log.outcome === '개선') cur.better += 1
    if (log.outcome === '악화') cur.worse += 1
    byKind.set(log.kind, cur)
  }

  return (
    <div className="space-y-4">
      {byKind.size > 0 && (
        <Card>
          <CardHeader title="규칙별 적중률" description="실행한 뒤 7일이 지난 것만 셉니다" />
          <div className="flex flex-wrap gap-3 p-5">
            {[...byKind.entries()].map(([kind, stat]) => {
              const judged = stat.better + stat.worse
              return (
                <div key={kind} className="rounded-lg bg-slate-50 px-4 py-3">
                  <p className="text-xs text-slate-500">{RULE_LABELS[kind as RuleKind] ?? kind}</p>
                  <p className="mt-0.5 text-lg font-bold text-slate-900">
                    {judged > 0 ? `${Math.round((stat.better / judged) * 100)}%` : '-'}
                  </p>
                  <p className="text-xs text-slate-400">
                    실행 {stat.done}건 · 판정 {judged}건
                  </p>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      <Card>
        <CardHeader title="실행 로그" description="누가 언제 무엇을 왜 했는지" />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="border-y border-slate-100 bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="px-5 py-2.5 text-left font-medium whitespace-nowrap">때</th>
                <th className="px-3 py-2.5 text-left font-medium">규칙</th>
                <th className="px-3 py-2.5 text-left font-medium">대상</th>
                <th className="px-3 py-2.5 text-left font-medium">한 일</th>
                <th className="px-3 py-2.5 text-left font-medium">사유</th>
                <th className="px-5 py-2.5 text-left font-medium">결과</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50">
                  <td className="px-5 py-2.5 text-xs whitespace-nowrap text-slate-500">
                    {log.createdAt.slice(0, 16).replace('T', ' ')}
                  </td>
                  <td className="px-3 py-2.5 text-slate-700">
                    {RULE_LABELS[log.kind as RuleKind] ?? log.kind}
                  </td>
                  <td className="max-w-[220px] truncate px-3 py-2.5 text-slate-700">
                    {log.targetName}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <span
                      className={
                        log.action === 'executed'
                          ? 'text-emerald-600'
                          : log.action === 'external'
                            ? 'text-amber-600'
                            : 'text-slate-500'
                      }
                    >
                      {
                        {
                          executed: '실행',
                          held: '보류',
                          ignored: '무시',
                          external: '외부 변경',
                        }[log.action]
                      }
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-slate-500">{log.reason || '-'}</td>
                  <td className="px-5 py-2.5 text-xs text-slate-600">
                    {log.outcome ?? (log.action === 'executed' ? '재는 중' : '-')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

interface LogRow {
  id: string
  kind: string
  targetLevel: string
  targetId: string
  targetName: string
  action: string
  reason: string
  outcome: string | null
  createdAt: string
}

function Mini({
  label,
  value,
  note,
  strong,
}: {
  label: string
  value: string
  note?: string
  strong?: boolean
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`mt-0.5 text-lg font-bold ${strong ? 'text-violet-600' : 'text-slate-900'}`}>
        {value}
      </p>
      {note && <p className="text-xs text-slate-400">{note}</p>}
    </div>
  )
}
