import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useCurrentUser } from '@/auth/AuthProvider'
import {
  Button,
  Card,
  CardHeader,
  EmptyState,
  Field,
  Input,
  Select,
  Spinner,
} from '@/components/ui'
import { adTagRepository, type Experiment, type ExperimentIdea } from '@/data/adTagRepository'
import { DEFAULT_OPS, derivedOps } from '@/data/adTypes'
import { sumInsights } from '@/data/metaTypes'
import { useAdTags, useOpsSettings, useTagOptions } from '@/hooks/adTagQueries'
import { useMetaAdSets, useMetaAds, useMetaInsights } from '@/hooks/metaQueries'
import { buildRows } from '@/utils/adAggregate'
import { parseAdName } from '@/utils/adNameParser'
import { useNameAliases } from '@/hooks/adTagQueries'
import {
  VARIABLES,
  VARIABLE_LABELS,
  confidenceHint,
  isSkewed,
  minSpendOf,
  scoreExperiment,
  type Variable,
} from '@/utils/experiments'
import { formatNumber, formatRatio, formatWon } from '@/utils/format'

const TABS = [
  { key: 'running', label: '진행 중' },
  { key: 'done', label: '완료' },
  { key: 'notes', label: '학습 노트' },
] as const

type TabKey = (typeof TABS)[number]['key']

/** 기간이 끝났는지 — 시작일 + 계획한 날수 */
function isFinished(experiment: Experiment): boolean {
  if (experiment.status === 'done') return true
  if (!experiment.startedAt) return false
  const end = new Date(experiment.startedAt).getTime() + experiment.plannedDays * 86_400_000
  return Date.now() >= end
}

export default function ExperimentsPage() {
  const user = useCurrentUser()
  const client = useQueryClient()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const tab = (params.get('tab') as TabKey) ?? 'running'
  const [adding, setAdding] = useState(false)
  const [seed, setSeed] = useState<ExperimentIdea | null>(null)

  const ops = useOpsSettings()
  const settings = ops.data ?? DEFAULT_OPS
  const adsets = useMetaAdSets()
  const ads = useMetaAds()
  const tags = useAdTags()
  const options = useTagOptions()
  const aliases = useNameAliases()

  const experiments = useQuery({
    queryKey: ['experiments'],
    queryFn: () => adTagRepository.listExperiments(),
  })

  // 실험은 기간이 정해져 있어, 그 기간만 잘라 본다
  const period = useMemo(() => {
    const running = (experiments.data ?? []).filter((row) => row.startedAt)
    const earliest = running
      .map((row) => row.startedAt!)
      .sort()
      .at(0)
    const from = earliest ? earliest.slice(0, 10) : new Date().toISOString().slice(0, 10)
    return { from, to: new Date().toISOString().slice(0, 10) }
  }, [experiments.data])

  const insights = useMetaInsights('ad', period)

  const rows = useMemo(
    () => buildRows(ads.data ?? [], insights.data ?? [], tags.data ?? []),
    [ads.data, insights.data, tags.data],
  )

  // 9-3 — 지난 실험과 태그 성과를 넘겨 다음 가설을 받는다
  const suggest = useMutation({
    mutationFn: () => {
      const done = (experiments.data ?? []).filter((row) => row.status === 'done')
      const history = done
        .map((row) => {
          const winner = String((row.result as { winner?: string }).winner ?? '')
          return `- ${row.name}: ${VARIABLE_LABELS[row.variable as Variable] ?? row.variable} 비교 (${row.variants.join(' vs ')}) → ${
            winner ? `${winner} 이김` : row.verdict === 'inconclusive' ? '판단 불가' : '결과 없음'
          }${row.learning ? ` · 배운 것: ${row.learning}` : ''}`
        })
        .join('\n')

      // 태그별 성과는 지금 보이는 자료로 만든다
      const byAngle = new Map<string, { spend: number; revenue: number }>()
      for (const row of rows) {
        const angle = row.tags?.angle
        if (!angle) continue
        const cur = byAngle.get(angle) ?? { spend: 0, revenue: 0 }
        byAngle.set(angle, {
          spend: cur.spend + row.insight.spend,
          revenue: cur.revenue + row.insight.revenue,
        })
      }
      const tagPerformance = [...byAngle.entries()]
        .filter(([, value]) => value.spend > 0)
        .sort((a, b) => b[1].spend - a[1].spend)
        .map(
          ([angle, value]) =>
            `- ${angle}: 지출 ${Math.round(value.spend).toLocaleString()}원, ROAS ${(value.revenue / value.spend).toFixed(2)}`,
        )
        .join('\n')

      return adTagRepository.suggestExperiments(history, tagPerformance)
    },
  })

  const save = useMutation({
    mutationFn: (input: Partial<Experiment>) => adTagRepository.saveExperiment(input, user.id),
    onSuccess: () => {
      setAdding(false)
      client.invalidateQueries({ queryKey: ['experiments'] })
    },
  })

  const update = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Experiment> }) =>
      adTagRepository.updateExperiment(id, patch),
    onSuccess: () => client.invalidateQueries({ queryKey: ['experiments'] }),
  })

  // 9-4 과거 기록 가져오기 — 이름의 [WIN]/[LOSE] 표시를 실험으로 옮긴다
  const importPast = useMutation({
    mutationFn: async () => {
      const found = new Map<string, { win: string[]; lose: string[]; date: string }>()
      for (const ad of ads.data ?? []) {
        const parsed = parseAdName(ad.name, aliases.data ?? [])
        if (!parsed.experiment) continue
        const setName = (adsets.data ?? []).find((set) => set.id === ad.adsetId)?.name ?? '기타'
        const key = `${setName}:${parsed.experiment.date}`
        const bucket = found.get(key) ?? { win: [], lose: [], date: parsed.experiment.date }
        const angle = parsed.tags.angle || parsed.leftover[0] || '(분류 없음)'
        if (parsed.experiment.result === 'WIN') bucket.win.push(angle)
        else bucket.lose.push(angle)
        found.set(key, bucket)
      }

      const already = new Set((experiments.data ?? []).map((row) => row.name))
      let made = 0
      for (const [key, bucket] of found) {
        const [setName, date] = key.split(':')
        const name = `${setName} 오디션 ${date}`
        if (already.has(name)) continue
        const variants = [...new Set([...bucket.win, ...bucket.lose])]
        await adTagRepository.saveExperiment(
          {
            name,
            // 가설과 학습은 비워 둔다. 그때 무엇을 기대했는지는 사람만 안다 (9-4)
            hypothesis: '',
            variable: 'angle',
            variants,
            adsetName: setName,
            status: 'done',
            verdict: bucket.win.length > 0 ? 'win' : 'lose',
            result: { win: bucket.win, lose: bucket.lose },
            source: 'name_import',
            endedAt: new Date(`2026-${date.slice(0, 2)}-${date.slice(2, 4)}`).toISOString(),
          },
          user.id,
        )
        made++
      }
      return made
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ['experiments'] }),
  })

  if (ops.isLoading || experiments.isLoading || ads.isLoading) return <Spinner />

  const all = experiments.data ?? []
  const running = all.filter((row) => row.status === 'running' || row.status === 'draft')
  const done = all.filter((row) => row.status === 'done' || row.status === 'canceled')

  const total = sumInsights(
    rows.map((row) => ({ level: 'ad' as const, id: row.ad.id, ...row.insight })),
  )
  const derived = derivedOps(settings, total.revenue, total.results)

  return (
    <div className="space-y-4 pb-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">실험</h1>
          <p className="mt-1 text-sm text-slate-500">
            한 라운드에 변수 하나만 바꿉니다. 둘을 같이 바꾸면 무엇이 효과를 냈는지 알 수 없습니다.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            onClick={() => importPast.mutate()}
            disabled={importPast.isPending}
          >
            {importPast.isPending ? '가져오는 중...' : '과거 오디션 가져오기'}
          </Button>
          <Button variant="secondary" onClick={() => suggest.mutate()} disabled={suggest.isPending}>
            {suggest.isPending ? '생각하는 중...' : '다음 실험 제안받기'}
          </Button>
          <Button onClick={() => setAdding(true)}>+ 새 실험</Button>
        </div>
      </div>

      {importPast.isSuccess && (
        <p className="rounded-lg bg-emerald-50 px-4 py-2.5 text-xs text-emerald-800">
          과거 실험 {importPast.data}건을 가져왔습니다. 가설과 학습은 비어 있으니 채워주세요.
        </p>
      )}

      <div className="flex flex-wrap gap-1 border-b border-slate-200">
        {TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setParams(item.key === 'running' ? {} : { tab: item.key })}
            className={`-mb-px border-b-2 px-3 py-2 text-sm transition-colors ${
              tab === item.key
                ? 'border-violet-500 font-medium text-violet-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {item.label}{' '}
            {item.key === 'running' ? running.length : item.key === 'done' ? done.length : ''}
          </button>
        ))}
      </div>

      {(suggest.data ?? []).length > 0 && (
        <Card>
          <CardHeader
            title="다음에 해볼 실험"
            description="초안입니다. 고르고 고쳐야 실험이 됩니다"
          />
          <div className="divide-y divide-slate-100">
            {(suggest.data ?? []).map((idea, index) => (
              <div key={index} className="flex flex-wrap items-start justify-between gap-3 p-5">
                <div className="min-w-0">
                  <p className="font-medium text-slate-900">{idea.name}</p>
                  <p className="mt-0.5 text-sm text-slate-600">{idea.hypothesis}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    {VARIABLE_LABELS[idea.variable as Variable] ?? idea.variable} ·{' '}
                    {idea.variants.join(' vs ')}
                  </p>
                  {idea.why && <p className="mt-1 text-xs text-violet-700">{idea.why}</p>}
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setSeed(idea)
                    setAdding(true)
                  }}
                >
                  이걸로 만들기
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {suggest.isError && (
        <p className="rounded-lg bg-rose-50 px-4 py-2.5 text-xs text-rose-700">
          {(suggest.error as Error).message}
        </p>
      )}

      {adding && (
        <NewExperiment
          seed={seed}
          options={options.data ?? []}
          adsets={(adsets.data ?? []).map((set) => ({ id: set.id, name: set.name }))}
          testAdSetIds={settings.testAdSetIds}
          onCancel={() => {
            setAdding(false)
            setSeed(null)
          }}
          onSave={(input) => save.mutate(input)}
          saving={save.isPending}
        />
      )}

      {tab === 'notes' ? (
        <NotesTab
          experiments={done}
          onSave={(id, learning) => update.mutate({ id, patch: { learning } })}
        />
      ) : (tab === 'running' ? running : done).length === 0 ? (
        <Card>
          <EmptyState
            title={tab === 'running' ? '도는 실험이 없습니다' : '끝난 실험이 없습니다'}
            description={
              tab === 'running'
                ? '새 실험을 만들어 시작해보세요.'
                : '과거 오디션 가져오기로 예전 기록을 불러올 수 있습니다.'
            }
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {(tab === 'running' ? running : done).map((experiment) => (
            <ExperimentCard
              key={experiment.id}
              experiment={experiment}
              rows={rows.filter((row) => row.tags?.experimentId === experiment.id)}
              minSpend={minSpendOf(experiment, derived.minSpend)}
              onStart={() =>
                update.mutate({
                  id: experiment.id,
                  patch: { status: 'running', startedAt: new Date().toISOString() },
                })
              }
              onFinish={(verdict, result) =>
                update.mutate({
                  id: experiment.id,
                  patch: {
                    status: 'done',
                    verdict,
                    result,
                    endedAt: new Date().toISOString(),
                  },
                })
              }
              onMakeCreative={() => navigate('/ads/studio?tab=copies')}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function NewExperiment({
  seed,
  options,
  adsets,
  testAdSetIds,
  onCancel,
  onSave,
  saving,
}: {
  seed: ExperimentIdea | null
  options: { id: string; dimension: string; label: string; active: boolean }[]
  adsets: { id: string; name: string }[]
  testAdSetIds: string[]
  onCancel: () => void
  onSave: (input: Partial<Experiment>) => void
  saving: boolean
}) {
  // 제안에서 왔으면 그 값으로 채워 둔다. 사람이 고칠 수 있다
  const [name, setName] = useState(seed?.name ?? '')
  const [hypothesis, setHypothesis] = useState(seed?.hypothesis ?? '')
  const [variable, setVariable] = useState<Variable>((seed?.variable as Variable) ?? 'angle')
  const [variants, setVariants] = useState<string[]>(seed?.variants ?? [])
  const [adsetId, setAdsetId] = useState(testAdSetIds[0] ?? '')
  const [dailyBudget, setDailyBudget] = useState(30_000)
  const [plannedDays, setPlannedDays] = useState(7)
  const [metric, setMetric] = useState<'roas' | 'cpa'>('roas')
  const [target, setTarget] = useState('')

  const choices = options.filter((o) => o.dimension === variable && o.active)
  // 2~4개만 견준다. 더 늘리면 값마다 쓸 돈이 모자란다
  const canAdd = variants.length < 4
  const ready = name.trim() && variants.length >= 2 && adsetId

  return (
    <Card>
      <CardHeader title="새 실험" description="변수는 하나만 고릅니다" />
      <div className="space-y-4 p-5">
        <Field label="이름">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="예) 40대 중후반 앵글 비교"
            autoFocus
          />
        </Field>

        <div>
          <p className="text-sm font-medium text-slate-700">가설</p>
          <p className="text-xs text-slate-500">
            무엇을 기대하는지 적어두면, 결과를 보고 배울 수 있습니다
          </p>
          <textarea
            value={hypothesis}
            onChange={(e) => setHypothesis(e.target.value)}
            rows={2}
            placeholder="예) 40대 중후반에게는 가족 앵글보다 원료·성분 앵글의 CPA가 낮다"
            className="mt-1.5 w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-400"
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="바꿀 변수">
            <Select
              value={variable}
              onChange={(e) => {
                setVariable(e.target.value as Variable)
                setVariants([])
              }}
            >
              {VARIABLES.map((item) => (
                <option key={item} value={item}>
                  {VARIABLE_LABELS[item]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="테스트 세트">
            <Select value={adsetId} onChange={(e) => setAdsetId(e.target.value)}>
              <option value="">고르세요</option>
              {adsets.map((set) => (
                <option key={set.id} value={set.id}>
                  {set.name}
                  {testAdSetIds.includes(set.id) ? ' (테스트 세트)' : ''}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div>
          <p className="text-sm font-medium text-slate-700">
            견줄 값 <span className="text-xs font-normal text-slate-400">2~4개</span>
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {choices.map((option) => {
              const on = variants.includes(option.label)
              return (
                <button
                  key={option.id}
                  type="button"
                  disabled={!on && !canAdd}
                  onClick={() =>
                    setVariants((prev) =>
                      on ? prev.filter((v) => v !== option.label) : [...prev, option.label],
                    )
                  }
                  className={`rounded-full border px-3 py-1.5 text-xs transition-colors disabled:opacity-40 ${
                    on
                      ? 'border-violet-500 bg-violet-500 text-white'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-violet-300'
                  }`}
                >
                  {option.label}
                </button>
              )
            })}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-4">
          <Field label="일예산(원)">
            <Input
              type="number"
              step="10000"
              value={dailyBudget}
              onChange={(e) => setDailyBudget(Number(e.target.value))}
            />
          </Field>
          <Field label="기간(일)">
            <Input
              type="number"
              value={plannedDays}
              onChange={(e) => setPlannedDays(Number(e.target.value))}
            />
          </Field>
          <Field label="성공 지표">
            <Select value={metric} onChange={(e) => setMetric(e.target.value as 'roas' | 'cpa')}>
              <option value="roas">ROAS (높을수록 좋음)</option>
              <option value="cpa">CPA (낮을수록 좋음)</option>
            </Select>
          </Field>
          <Field label="기준값" hint="비우면 값끼리만 견줍니다">
            <Input
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="예) 2.15"
            />
          </Field>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onCancel}>
            취소
          </Button>
          <Button
            onClick={() =>
              onSave({
                name: name.trim(),
                hypothesis: hypothesis.trim(),
                variable,
                variants,
                adsetId,
                adsetName: adsets.find((set) => set.id === adsetId)?.name ?? '',
                dailyBudget,
                plannedDays,
                metric,
                target: target ? Number(target) : null,
                status: 'draft',
              })
            }
            disabled={!ready || saving}
          >
            {saving ? '저장 중...' : '만들기'}
          </Button>
        </div>
      </div>
    </Card>
  )
}

function ExperimentCard({
  experiment,
  rows,
  minSpend,
  onStart,
  onFinish,
  onMakeCreative,
}: {
  experiment: Experiment
  rows: ReturnType<typeof buildRows>
  minSpend: number
  onStart: () => void
  onFinish: (verdict: string, result: Record<string, unknown>) => void
  onMakeCreative: () => void
}) {
  const finished = isFinished(experiment)
  const score = scoreExperiment(
    rows,
    experiment.variable as Variable,
    experiment.variants,
    experiment.metric,
    minSpend,
    experiment.target,
    finished,
  )

  // 가져온 과거 기록은 지표가 없다. 그때 적힌 승패만 보여준다
  const imported = experiment.source === 'name_import'
  const past = experiment.result as { win?: string[]; lose?: string[] }

  const days = experiment.startedAt
    ? Math.floor((Date.now() - new Date(experiment.startedAt).getTime()) / 86_400_000)
    : 0

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-bold text-slate-900">{experiment.name}</h3>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
              {VARIABLE_LABELS[experiment.variable as Variable] ?? experiment.variable}
            </span>
            {experiment.verdict && <Verdict value={experiment.verdict} />}
            {imported && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">
                이름에서 가져옴
              </span>
            )}
          </div>
          {experiment.hypothesis ? (
            <p className="mt-1 text-sm text-slate-600">{experiment.hypothesis}</p>
          ) : (
            <p className="mt-1 text-sm text-amber-700">가설이 비어 있습니다 — 채워주세요</p>
          )}
          <p className="mt-1 text-xs text-slate-400">
            {experiment.variants.join(' vs ')}
            {experiment.adsetName && ` · ${experiment.adsetName}`}
            {experiment.startedAt && ` · ${days}일째 / ${experiment.plannedDays}일`}
          </p>
        </div>

        <div className="flex shrink-0 gap-2">
          {experiment.status === 'draft' && (
            <>
              <Button size="sm" variant="secondary" onClick={onMakeCreative}>
                소재 만들기
              </Button>
              <Button size="sm" onClick={onStart}>
                시작
              </Button>
            </>
          )}
          {experiment.status === 'running' && finished && (
            <Button
              size="sm"
              onClick={() =>
                onFinish(score.verdict || 'inconclusive', {
                  variants: score.variants,
                  winner: score.winner,
                  why: score.why,
                })
              }
            >
              판정하기
            </Button>
          )}
        </div>
      </div>

      {imported ? (
        <div className="mt-3 flex flex-wrap gap-4 text-sm">
          {past.win && past.win.length > 0 && (
            <p className="text-emerald-700">이김: {[...new Set(past.win)].join(', ')}</p>
          )}
          {past.lose && past.lose.length > 0 && (
            <p className="text-slate-500">짐: {[...new Set(past.lose)].join(', ')}</p>
          )}
        </div>
      ) : (
        <>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[620px] text-sm">
              <thead className="border-y border-slate-100 bg-slate-50 text-xs text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">값</th>
                  <th className="px-2 py-2 text-right font-medium">소재</th>
                  <th className="px-2 py-2 text-right font-medium">지출</th>
                  <th className="px-2 py-2 text-right font-medium">지출 비중</th>
                  <th className="px-2 py-2 text-right font-medium">전환</th>
                  <th className="px-2 py-2 text-right font-medium">ROAS</th>
                  <th className="px-3 py-2 text-right font-medium">CPA</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {score.variants.map((variant) => (
                  <tr
                    key={variant.value}
                    className={variant.value === score.winner ? 'bg-emerald-50/50' : ''}
                  >
                    <td className="px-3 py-2 font-medium text-slate-800">
                      {variant.value}
                      {variant.value === score.winner && ' 🏆'}
                      {!variant.enough && (
                        <span className="ml-1.5 text-[11px] text-amber-600">덜 씀</span>
                      )}
                    </td>
                    <td className="tabular px-2 py-2 text-right text-slate-500">{variant.ads}</td>
                    <td className="tabular px-2 py-2 text-right text-slate-700">
                      {formatWon(variant.spend)}
                    </td>
                    <td className="tabular px-2 py-2 text-right text-slate-500">
                      {Math.round(variant.spendShare * 100)}%
                    </td>
                    <td className="tabular px-2 py-2 text-right text-slate-700">
                      {formatNumber(variant.results)}
                    </td>
                    <td className="tabular px-2 py-2 text-right text-slate-800">
                      {formatRatio(variant.roas)}
                    </td>
                    <td className="tabular px-3 py-2 text-right text-slate-700">
                      {variant.cpa > 0 ? formatWon(Math.round(variant.cpa)) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-2 space-y-1">
            <p className="text-xs text-slate-600">{score.why}</p>
            <p className="text-xs text-slate-400">
              {confidenceHint(score.variants)}
              {isSkewed(score.variants) &&
                ' · 지출이 한쪽으로 쏠렸습니다 — 메타가 고르게 나누지 않았습니다'}
            </p>
          </div>
        </>
      )}

      {experiment.learning && (
        <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-700">
          <b>배운 것</b> — {experiment.learning}
        </p>
      )}
    </Card>
  )
}

function Verdict({ value }: { value: string }) {
  const map: Record<string, [string, string]> = {
    win: ['이김', 'bg-emerald-100 text-emerald-700'],
    lose: ['짐', 'bg-rose-100 text-rose-700'],
    inconclusive: ['판단 불가', 'bg-slate-100 text-slate-600'],
  }
  const [label, tone] = map[value] ?? ['', '']
  if (!label) return null
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${tone}`}>{label}</span>
}

function NotesTab({
  experiments,
  onSave,
}: {
  experiments: Experiment[]
  onSave: (id: string, learning: string) => void
}) {
  const [drafts, setDrafts] = useState<Record<string, string>>({})

  if (experiments.length === 0) {
    return (
      <Card>
        <EmptyState
          title="아직 끝난 실험이 없습니다"
          description="실험이 끝나면 여기에 배운 것을 적어둡니다."
        />
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader title="학습 노트" description="한두 줄이면 됩니다. 다음 실험의 출발점이 됩니다" />
      <div className="divide-y divide-slate-100">
        {experiments.map((experiment) => {
          const draft = drafts[experiment.id] ?? experiment.learning
          const dirty = draft !== experiment.learning
          return (
            <div key={experiment.id} className="p-5">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium text-slate-900">{experiment.name}</p>
                <Verdict value={experiment.verdict} />
              </div>
              {experiment.hypothesis && (
                <p className="mt-0.5 text-xs text-slate-500">가설: {experiment.hypothesis}</p>
              )}
              <textarea
                value={draft}
                onChange={(e) =>
                  setDrafts((prev) => ({ ...prev, [experiment.id]: e.target.value }))
                }
                rows={2}
                placeholder="무엇을 배웠나. 다음에 무엇을 다르게 할까"
                className="mt-2 w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-400"
              />
              {dirty && (
                <div className="mt-2 flex justify-end">
                  <Button size="sm" onClick={() => onSave(experiment.id, draft)}>
                    저장
                  </Button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </Card>
  )
}
