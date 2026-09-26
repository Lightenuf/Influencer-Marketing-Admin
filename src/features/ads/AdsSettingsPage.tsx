import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Button, Card, CardHeader, Field, Input, Select, Spinner } from '@/components/ui'
import { TAG_DIMENSIONS, TAG_DIMENSION_LABELS, derivedOps, type OpsSettings } from '@/data/adTypes'
import { presetPeriod } from '@/components/PeriodPicker'
import {
  useAddNameAlias,
  useAddTagOption,
  useNameAliases,
  useOpsSettings,
  useRemoveNameAlias,
  useSaveOpsSettings,
  useSetTagOptionActive,
  useTagOptions,
} from '@/hooks/adTagQueries'
import { useMetaInsights } from '@/hooks/metaQueries'
import { formatNumber, formatWon } from '@/utils/format'

const TABS = [
  { key: 'ops', label: '운영 기준' },
  { key: 'tags', label: '태그 사전' },
  { key: 'alerts', label: '알림' },
  { key: 'guardrails', label: '가드레일' },
] as const

type TabKey = (typeof TABS)[number]['key']

export default function AdsSettingsPage() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const tab = (params.get('tab') as TabKey) ?? 'ops'

  return (
    <div className="space-y-4 pb-4">
      <div>
        <button
          type="button"
          onClick={() => navigate('/ads')}
          className="text-sm text-slate-500 hover:text-violet-600"
        >
          ← 퍼포먼스 마케팅
        </button>
        <h1 className="mt-1 text-xl font-bold text-slate-900">⚙️ 설정</h1>
        <p className="mt-1 text-sm text-slate-500">
          판단에 쓰는 숫자와 선택지를 여기서 정합니다. 화면과 제안이 모두 이 값을 읽습니다.
        </p>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-slate-200">
        {TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setParams({ tab: item.key })}
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

      {tab === 'ops' && <OpsTab />}
      {tab === 'tags' && <TagsTab />}
      {tab === 'alerts' && <LaterTab title="알림" phase="Phase 6" />}
      {tab === 'guardrails' && <LaterTab title="가드레일" phase="Phase 3" />}
    </div>
  )
}

function LaterTab({ title, phase }: { title: string; phase: string }) {
  return (
    <Card>
      <CardHeader title={title} description={`${phase}에서 채웁니다`} />
      <p className="px-5 py-10 text-center text-sm text-slate-400">
        아직 만들지 않았습니다. {phase}에서 이 자리에 들어옵니다.
      </p>
    </Card>
  )
}

function OpsTab() {
  const { data: ops, isLoading } = useOpsSettings()
  const save = useSaveOpsSettings()
  const [draft, setDraft] = useState<OpsSettings | null>(null)

  // 최근 30일 전환·매출로 객단가를 자동 계산한다 (5-5)
  const period = useMemo(() => presetPeriod('month'), [])
  const insights = useMetaInsights('campaign', period)

  useEffect(() => {
    if (ops) setDraft(ops)
  }, [ops])

  if (isLoading || !draft) return <Spinner />

  const revenue30d = (insights.data ?? []).reduce((sum, row) => sum + row.revenue, 0)
  const results30d = (insights.data ?? []).reduce((sum, row) => sum + row.results, 0)
  const derived = derivedOps(draft, revenue30d, results30d)

  const set = <K extends keyof OpsSettings>(key: K, value: OpsSettings[K]) =>
    setDraft({ ...draft, [key]: value })

  const dirty = JSON.stringify(draft) !== JSON.stringify(ops)

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title="판단 기준"
          description="제안 규칙과 상태 배지가 전부 이 숫자를 읽습니다"
        />
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <Field label="손익분기 ROAS">
            <Input
              type="number"
              step="0.01"
              value={draft.breakEvenRoas}
              onChange={(e) => set('breakEvenRoas', Number(e.target.value))}
            />
          </Field>

          <Field label="목표 ROAS 기준">
            <Select
              value={draft.roasBasis}
              onChange={(e) => set('roasBasis', e.target.value as OpsSettings['roasBasis'])}
            >
              <option value="firstPurchase">첫 구매 기준</option>
              <option value="ltv">LTV 보정</option>
            </Select>
          </Field>

          {draft.roasBasis === 'ltv' && (
            <>
              <Field label="재구매율" hint="0.19 = 19%">
                <Input
                  type="number"
                  step="0.01"
                  value={draft.repurchaseRate}
                  onChange={(e) => set('repurchaseRate', Number(e.target.value))}
                />
              </Field>
              <Field label="재구매 주기(일)">
                <Input
                  type="number"
                  value={draft.repurchaseDays}
                  onChange={(e) => set('repurchaseDays', Number(e.target.value))}
                />
              </Field>
            </>
          )}

          <Field label="객단가">
            <Select
              value={draft.aovMode}
              onChange={(e) => set('aovMode', e.target.value as OpsSettings['aovMode'])}
            >
              <option value="auto">자동 (최근 30일 매출 ÷ 전환)</option>
              <option value="manual">수동 고정</option>
            </Select>
          </Field>

          {draft.aovMode === 'manual' && (
            <Field label="객단가(원)">
              <Input
                type="number"
                value={draft.aovManual}
                onChange={(e) => set('aovManual', Number(e.target.value))}
              />
            </Field>
          )}

          <Field label="판단 기간(일)">
            <Input
              type="number"
              value={draft.judgeDays}
              onChange={(e) => set('judgeDays', Number(e.target.value))}
            />
          </Field>

          <Field label="판단 최소 지출 배수" hint="손익분기 CPA × 이 값">
            <Input
              type="number"
              step="0.5"
              value={draft.minSpendMultiplier}
              onChange={(e) => set('minSpendMultiplier', Number(e.target.value))}
            />
          </Field>

          <Field label="증액 폭" hint="0.2 = +20%">
            <Input
              type="number"
              step="0.05"
              value={draft.increaseStep}
              onChange={(e) => set('increaseStep', Number(e.target.value))}
            />
          </Field>

          <Field label="증액 간격(일)">
            <Input
              type="number"
              value={draft.increaseIntervalDays}
              onChange={(e) => set('increaseIntervalDays', Number(e.target.value))}
            />
          </Field>

          <Field label="감액 폭" hint="0.2 = -20%">
            <Input
              type="number"
              step="0.05"
              value={draft.decreaseStep}
              onChange={(e) => set('decreaseStep', Number(e.target.value))}
            />
          </Field>
        </div>

        <div className="border-t border-slate-100 bg-slate-50 px-5 py-4">
          <p className="text-xs text-slate-500">위 값에서 자동으로 따라오는 숫자</p>
          <div className="mt-2 grid gap-3 sm:grid-cols-3">
            <Derived
              label="객단가"
              value={derived.aov > 0 ? formatWon(derived.aov) : '전환 자료 없음'}
              note={
                draft.aovMode === 'auto'
                  ? `최근 30일 매출 ${formatWon(revenue30d)} ÷ 전환 ${formatNumber(results30d)}건`
                  : '수동 고정'
              }
            />
            <Derived
              label="손익분기 CPA"
              value={derived.breakEvenCpa > 0 ? formatWon(derived.breakEvenCpa) : '-'}
              note={`객단가 ÷ ${derived.effectiveRoas.toFixed(2)}`}
            />
            <Derived
              label="판단 최소 지출"
              value={derived.minSpend > 0 ? formatWon(derived.minSpend) : '-'}
              note={`손익분기 CPA × ${draft.minSpendMultiplier}`}
            />
          </div>
          {derived.aov === 0 && draft.aovMode === 'auto' && (
            <p className="mt-2 text-xs text-amber-700">
              최근 30일에 전환이 없어 객단가를 낼 수 없습니다. 수동 고정으로 바꾸거나 기간이 쌓이길
              기다리세요.
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 p-5">
          <Button variant="secondary" onClick={() => ops && setDraft(ops)} disabled={!dirty}>
            되돌리기
          </Button>
          <Button onClick={() => save.mutate(draft)} disabled={!dirty || save.isPending}>
            {save.isPending ? '저장 중...' : '저장'}
          </Button>
        </div>
      </Card>
    </div>
  )
}

function Derived({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-lg bg-white p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-0.5 text-lg font-bold text-slate-900">{value}</p>
      <p className="text-xs text-slate-400">{note}</p>
    </div>
  )
}

function TagsTab() {
  const options = useTagOptions()
  const aliases = useNameAliases()
  const addOption = useAddTagOption()
  const setActive = useSetTagOptionActive()
  const addAlias = useAddNameAlias()
  const removeAlias = useRemoveNameAlias()

  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [aliasDraft, setAliasDraft] = useState({ dimension: 'angle', token: '', label: '' })

  if (options.isLoading || aliases.isLoading) return <Spinner />

  const angleLabels = (options.data ?? [])
    .filter((o) => o.dimension === aliasDraft.dimension && o.active)
    .map((o) => o.label)

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title="태그 선택지"
          description="여기 있는 것만 고를 수 있습니다. 끄면 앞으로 고를 수 없고, 이미 붙은 태그는 남습니다"
        />
        <div className="space-y-5 p-5">
          {TAG_DIMENSIONS.map((dimension) => {
            const rows = (options.data ?? []).filter((o) => o.dimension === dimension)
            const draft = drafts[dimension] ?? ''
            const submit = () => {
              if (!draft.trim()) return
              addOption.mutate({ dimension, label: draft.trim() })
              setDrafts((prev) => ({ ...prev, [dimension]: '' }))
            }
            return (
              <div key={dimension}>
                <p className="text-sm font-medium text-slate-700">
                  {TAG_DIMENSION_LABELS[dimension]}
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {rows.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setActive.mutate({ id: option.id, active: !option.active })}
                      title={option.active ? '눌러서 끄기' : '눌러서 켜기'}
                      className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                        option.active
                          ? 'border-slate-200 bg-white text-slate-700 hover:border-rose-300'
                          : 'border-dashed border-slate-300 bg-slate-50 text-slate-400 line-through'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <div className="mt-2 flex gap-2">
                  <Input
                    value={draft}
                    onChange={(e) =>
                      setDrafts((prev) => ({ ...prev, [dimension]: e.target.value }))
                    }
                    onKeyDown={(e) => {
                      if (e.nativeEvent.isComposing) return
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        submit()
                      }
                    }}
                    placeholder={`새 ${TAG_DIMENSION_LABELS[dimension]} 추가`}
                    className="text-sm"
                  />
                  <Button size="sm" variant="secondary" onClick={submit}>
                    추가
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      </Card>

      <Card>
        <CardHeader
          title="옛 이름 매핑"
          description="옛 광고 이름의 토막을 태그로 옮기는 사전입니다. 일괄 태깅이 이 표를 읽습니다"
        />
        <div className="p-5">
          <div className="flex flex-wrap items-end gap-2">
            <Field label="차원">
              <Select
                value={aliasDraft.dimension}
                onChange={(e) =>
                  setAliasDraft({ ...aliasDraft, dimension: e.target.value, label: '' })
                }
                className="w-32"
              >
                {TAG_DIMENSIONS.map((d) => (
                  <option key={d} value={d}>
                    {TAG_DIMENSION_LABELS[d]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="이름 속 토막">
              <Input
                value={aliasDraft.token}
                onChange={(e) => setAliasDraft({ ...aliasDraft, token: e.target.value })}
                placeholder="예) 성분"
                className="w-40"
              />
            </Field>
            <Field label="옮길 태그">
              <Select
                value={aliasDraft.label}
                onChange={(e) => setAliasDraft({ ...aliasDraft, label: e.target.value })}
                className="w-52"
              >
                <option value="">고르세요</option>
                {angleLabels.map((label) => (
                  <option key={label} value={label}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
            <Button
              variant="secondary"
              onClick={() => {
                if (!aliasDraft.token.trim() || !aliasDraft.label) return
                addAlias.mutate({ ...aliasDraft, token: aliasDraft.token.trim() })
                setAliasDraft({ ...aliasDraft, token: '', label: '' })
              }}
              disabled={!aliasDraft.token.trim() || !aliasDraft.label}
            >
              추가
            </Button>
          </div>

          <div className="mt-4 max-h-80 overflow-auto rounded-lg border border-slate-200">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50 text-xs text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">차원</th>
                  <th className="px-3 py-2 text-left font-medium">이름 속 토막</th>
                  <th className="px-3 py-2 text-left font-medium">옮길 태그</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(aliases.data ?? []).map((alias) => (
                  <tr key={alias.id} className="hover:bg-slate-50">
                    <td className="px-3 py-1.5 text-xs text-slate-500">
                      {TAG_DIMENSION_LABELS[alias.dimension as never] ?? alias.dimension}
                    </td>
                    <td className="px-3 py-1.5 font-mono text-xs text-slate-800">{alias.token}</td>
                    <td className="px-3 py-1.5 text-slate-700">{alias.label}</td>
                    <td className="px-3 py-1.5 text-right">
                      <button
                        type="button"
                        onClick={() => removeAlias.mutate(alias.id)}
                        className="rounded px-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Card>
    </div>
  )
}
