import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useCurrentUser } from '@/auth/AuthProvider'
import { Button, Card, CardHeader, Field, Input, Select, Spinner } from '@/components/ui'
import {
  AGE_BANDS,
  AGE_BAND_LABELS,
  GENDERS,
  GENDER_LABELS,
  KAKAO_STATES,
  KAKAO_STATE_LABELS,
  MARKETING_AGREES,
  MARKETING_AGREE_LABELS,
  emptyConditions,
  summarizeConditions,
  type AgeBand,
  type BehaviorRule,
  type GenderFilter,
  type GroupConditions,
  type KakaoState,
  type MarketingAgree,
} from '@/data/types'
import { useCreateCustomerGroup, useCustomerGroups, useUpdateCustomerGroup } from '@/hooks/queries'
import { formatNumber } from '@/utils/format'

/** 1단계 수집에서 확인되면 켠다. 자료가 없는 조건을 눌러 봐야 헛일이기 때문. */
const KAKAO_READY = false
const CHANNEL_READY = false

/** 여러 개 중 고르는 줄 — 누르면 켜지고 다시 누르면 꺼진다 */
function PickMany<T extends string>({
  label,
  options,
  labels,
  picked,
  onChange,
  disabled,
  hint,
}: {
  label: string
  options: readonly T[]
  labels: Record<T, string>
  picked: T[]
  onChange: (next: T[]) => void
  disabled?: boolean
  hint?: string
}) {
  return (
    <div>
      <p className="text-sm font-medium text-slate-700">
        {label}
        {disabled && <span className="ml-1.5 text-xs font-normal text-amber-600">{hint}</span>}
      </p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {options.map((option) => {
          const on = picked.includes(option)
          return (
            <button
              key={option}
              type="button"
              disabled={disabled}
              onClick={() =>
                onChange(on ? picked.filter((p) => p !== option) : [...picked, option])
              }
              className={
                on
                  ? 'rounded-full bg-violet-600 px-3 py-1.5 text-sm font-medium text-white'
                  : 'rounded-full border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40'
              }
            >
              {labels[option]}
            </button>
          )
        })}
      </div>
      {picked.length === 0 && !disabled && (
        <p className="mt-1 text-xs text-slate-400">고르지 않으면 이 항목은 따지지 않습니다</p>
      )}
    </div>
  )
}

/** 숫자 범위 (이상 ~ 미만) */
function RangeRow({
  fromLabel,
  toLabel,
  unit,
  min,
  max,
  onChange,
}: {
  fromLabel: string
  toLabel: string
  unit: string
  min: number | null
  max: number | null
  onChange: (min: number | null, max: number | null) => void
}) {
  const toValue = (text: string) => {
    const digits = text.replace(/[^\d]/g, '')
    return digits === '' ? null : Number(digits)
  }
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-sm text-slate-600">
      <Input
        inputMode="numeric"
        value={min ?? ''}
        onChange={(e) => onChange(toValue(e.target.value), max)}
        placeholder="0"
        className="w-24 py-1 text-sm"
      />
      <span className="whitespace-nowrap">
        {unit} {fromLabel}
      </span>
      <span className="text-slate-300">~</span>
      <Input
        inputMode="numeric"
        value={max ?? ''}
        onChange={(e) => onChange(min, toValue(e.target.value))}
        placeholder="제한 없음"
        className="w-24 py-1 text-sm"
      />
      <span className="whitespace-nowrap">
        {unit} {toLabel}
      </span>
    </div>
  )
}

const BEHAVIOR_CHOICES: Array<{ kind: BehaviorRule['kind']; label: string; ready: boolean }> = [
  { kind: 'purchased', label: '특정 기간에 구매', ready: true },
  { kind: 'sinceLastPurchase', label: '마지막 구매 후 경과일', ready: true },
  { kind: 'orderCount', label: '구매 횟수', ready: true },
  { kind: 'totalSpent', label: '누적 구매 금액', ready: true },
  { kind: 'boughtProduct', label: '특정 상품 구매', ready: true },
  { kind: 'couponUsed', label: '쿠폰 사용 여부', ready: true },
  { kind: 'firstChannel', label: '첫 구매 유입 채널', ready: CHANNEL_READY },
]

const newRule = (kind: BehaviorRule['kind']): BehaviorRule => {
  switch (kind) {
    case 'purchased':
      return { kind, has: true, period: { kind: 'preset', days: 30 } }
    case 'sinceLastPurchase':
      return { kind, minDays: 40, maxDays: 50 }
    case 'orderCount':
      return { kind, min: 2, max: null }
    case 'totalSpent':
      return { kind, min: null, max: null }
    case 'boughtProduct':
      return { kind, prodNos: [], has: true }
    case 'couponUsed':
      return { kind, couponCode: null, used: true }
    default:
      return { kind: 'firstChannel', codes: [] }
  }
}

export default function CustomerGroupEditPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const user = useCurrentUser()

  const { data: groups = [], isLoading } = useCustomerGroups()
  const create = useCreateCustomerGroup(user.id)
  const update = useUpdateCustomerGroup()

  const existing = useMemo(() => groups.find((g) => g.id === id), [groups, id])
  const isNew = !id || id === 'new'

  const [name, setName] = useState('')
  const [conditions, setConditions] = useState<GroupConditions>(emptyConditions)
  const [adding, setAdding] = useState<BehaviorRule['kind'] | ''>('')

  useEffect(() => {
    if (existing) {
      setName(existing.name)
      setConditions(existing.conditions ?? emptyConditions())
    }
  }, [existing])

  if (isLoading) return <Spinner />
  if (!isNew && !existing) {
    return (
      <Card className="p-8 text-center text-sm text-slate-500">
        그룹을 찾을 수 없습니다.
        <div className="mt-3">
          <Button variant="secondary" onClick={() => navigate('/crm/groups')}>
            목록으로
          </Button>
        </div>
      </Card>
    )
  }

  const profile = conditions.profile
  const setProfile = (patch: Partial<GroupConditions['profile']>) =>
    setConditions({ ...conditions, profile: { ...profile, ...patch } })

  const setRule = (index: number, rule: BehaviorRule) =>
    setConditions({
      ...conditions,
      behaviors: conditions.behaviors.map((r, i) => (i === index ? rule : r)),
    })

  const removeRule = (index: number) =>
    setConditions({
      ...conditions,
      behaviors: conditions.behaviors.filter((_, i) => i !== index),
    })

  const save = () => {
    const input = { name: name.trim(), conditions }
    if (isNew) {
      create.mutate(input, { onSuccess: () => navigate('/crm/groups') })
    } else {
      update.mutate({ id: id!, input }, { onSuccess: () => navigate('/crm/groups') })
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <button
          type="button"
          onClick={() => navigate('/crm/groups')}
          className="text-sm text-slate-500 hover:text-violet-600"
        >
          ← 고객 행동 관리
        </button>
        <h1 className="mt-1 text-xl font-bold text-slate-900">
          {isNew ? '새 고객 그룹' : '고객 그룹 수정'}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          아래 조건을 <b>모두 만족하는</b> 고객이 이 그룹에 들어갑니다.
        </p>
      </div>

      <Card className="p-5">
        <Field label="그룹명" required hint="나중에 알아볼 수 있게 조건이 드러나는 이름이 좋습니다">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="예) 구매 40일 경과_SMS동의"
            autoFocus
          />
        </Field>
      </Card>

      <Card>
        <CardHeader title="1. 고객 정보" description="비워 두면 그 항목은 따지지 않습니다" />
        <div className="space-y-5 p-5">
          <PickMany<MarketingAgree>
            label="마케팅 수신 동의"
            options={MARKETING_AGREES}
            labels={MARKETING_AGREE_LABELS}
            picked={profile.marketingAgrees}
            onChange={(next) => setProfile({ marketingAgrees: next })}
          />

          <PickMany<GenderFilter>
            label="성별"
            options={GENDERS}
            labels={GENDER_LABELS}
            picked={profile.genders}
            onChange={(next) => setProfile({ genders: next })}
          />

          <PickMany<AgeBand>
            label="연령대"
            options={AGE_BANDS}
            labels={AGE_BAND_LABELS}
            picked={profile.ageBands}
            onChange={(next) => setProfile({ ageBands: next })}
          />

          <div>
            <p className="text-sm font-medium text-slate-700">회원 등급</p>
            <Input
              value={profile.grades.join(', ')}
              onChange={(e) =>
                setProfile({
                  grades: e.target.value
                    .split(',')
                    .map((g) => g.trim())
                    .filter(Boolean),
                })
              }
              placeholder="쉼표로 구분 (예: VIP, 일반)"
              className="mt-1.5"
            />
          </div>

          <div>
            <p className="text-sm font-medium text-slate-700">가입일</p>
            <div className="mt-1.5 flex items-center gap-1.5 text-sm text-slate-600">
              <input
                type="date"
                value={profile.joinedFrom ?? ''}
                onChange={(e) => setProfile({ joinedFrom: e.target.value || null })}
                className="rounded-md border border-slate-200 bg-white px-2 py-1 text-sm focus:border-violet-400 focus:outline-none"
              />
              <span className="text-slate-400">~</span>
              <input
                type="date"
                value={profile.joinedTo ?? ''}
                onChange={(e) => setProfile({ joinedTo: e.target.value || null })}
                className="rounded-md border border-slate-200 bg-white px-2 py-1 text-sm focus:border-violet-400 focus:outline-none"
              />
            </div>
          </div>

          <PickMany<KakaoState>
            label="카카오 채널 친구"
            options={KAKAO_STATES}
            labels={KAKAO_STATE_LABELS}
            picked={profile.kakao ? [profile.kakao] : []}
            onChange={(next) =>
              setProfile({ kakao: (next[next.length - 1] as KakaoState) ?? null })
            }
            disabled={!KAKAO_READY}
            hint="아직 자료를 확보하지 못했습니다"
          />
        </div>
      </Card>

      <Card>
        <CardHeader
          title="2. 행동 조건"
          description="여러 개를 더할 수 있습니다. 취소·환불한 주문은 횟수와 금액에서 뺍니다"
          action={
            <div className="w-48">
              <Select
                value={adding}
                onChange={(e) => {
                  const kind = e.target.value as BehaviorRule['kind']
                  if (!kind) return
                  setConditions({
                    ...conditions,
                    behaviors: [...conditions.behaviors, newRule(kind)],
                  })
                  setAdding('')
                }}
              >
                <option value="">+ 조건 추가</option>
                {BEHAVIOR_CHOICES.map((choice) => (
                  <option key={choice.kind} value={choice.kind} disabled={!choice.ready}>
                    {choice.label}
                    {!choice.ready ? ' (자료 없음)' : ''}
                  </option>
                ))}
              </Select>
            </div>
          }
        />

        <div className="space-y-3 p-5">
          {conditions.behaviors.length === 0 && (
            <p className="text-sm text-slate-400">
              아직 행동 조건이 없습니다. 오른쪽 위에서 더해주세요.
            </p>
          )}

          {conditions.behaviors.map((rule, index) => (
            <div key={index} className="rounded-lg border border-slate-200 p-3.5">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-medium text-slate-800">
                  {BEHAVIOR_CHOICES.find((c) => c.kind === rule.kind)?.label ?? rule.kind}
                </p>
                <button
                  type="button"
                  onClick={() => removeRule(index)}
                  className="text-xs text-slate-300 hover:text-rose-500"
                >
                  빼기
                </button>
              </div>

              <div className="mt-2.5">
                {rule.kind === 'purchased' && (
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <Select
                      value={String(rule.period.days ?? 30)}
                      onChange={(e) =>
                        setRule(index, {
                          ...rule,
                          period: { kind: 'preset', days: Number(e.target.value) },
                        })
                      }
                      className="w-32 py-1 text-sm"
                    >
                      <option value="7">최근 7일</option>
                      <option value="14">최근 14일</option>
                      <option value="30">최근 30일</option>
                      <option value="60">최근 60일</option>
                      <option value="90">최근 90일</option>
                    </Select>
                    <Select
                      value={rule.has ? 'yes' : 'no'}
                      onChange={(e) => setRule(index, { ...rule, has: e.target.value === 'yes' })}
                      className="w-36 py-1 text-sm"
                    >
                      <option value="yes">구매한 적 있음</option>
                      <option value="no">구매한 적 없음</option>
                    </Select>
                  </div>
                )}

                {rule.kind === 'sinceLastPurchase' && (
                  <RangeRow
                    fromLabel="이상"
                    toLabel="미만"
                    unit="일"
                    min={rule.minDays}
                    max={rule.maxDays}
                    onChange={(min, max) => setRule(index, { ...rule, minDays: min, maxDays: max })}
                  />
                )}

                {rule.kind === 'orderCount' && (
                  <RangeRow
                    fromLabel="이상"
                    toLabel="이하"
                    unit="회"
                    min={rule.min}
                    max={rule.max}
                    onChange={(min, max) => setRule(index, { ...rule, min, max })}
                  />
                )}

                {rule.kind === 'totalSpent' && (
                  <RangeRow
                    fromLabel="이상"
                    toLabel="이하"
                    unit="원"
                    min={rule.min}
                    max={rule.max}
                    onChange={(min, max) => setRule(index, { ...rule, min, max })}
                  />
                )}

                {rule.kind === 'boughtProduct' && (
                  <div className="flex flex-wrap items-center gap-2">
                    <Input
                      value={rule.prodNos.join(', ')}
                      onChange={(e) =>
                        setRule(index, {
                          ...rule,
                          prodNos: e.target.value
                            .split(',')
                            .map((p) => p.trim())
                            .filter(Boolean),
                        })
                      }
                      placeholder="상품번호를 쉼표로 구분"
                      className="max-w-sm py-1 text-sm"
                    />
                    <Select
                      value={rule.has ? 'yes' : 'no'}
                      onChange={(e) => setRule(index, { ...rule, has: e.target.value === 'yes' })}
                      className="w-32 py-1 text-sm"
                    >
                      <option value="yes">샀음</option>
                      <option value="no">사지 않음</option>
                    </Select>
                  </div>
                )}

                {rule.kind === 'couponUsed' && (
                  <div className="flex flex-wrap items-center gap-2">
                    <Input
                      value={rule.couponCode ?? ''}
                      onChange={(e) =>
                        setRule(index, { ...rule, couponCode: e.target.value || null })
                      }
                      placeholder="쿠폰 코드 (비우면 전체)"
                      className="max-w-xs py-1 text-sm"
                    />
                    <Select
                      value={rule.used ? 'yes' : 'no'}
                      onChange={(e) => setRule(index, { ...rule, used: e.target.value === 'yes' })}
                      className="w-32 py-1 text-sm"
                    >
                      <option value="yes">사용함</option>
                      <option value="no">쓰지 않음</option>
                    </Select>
                  </div>
                )}

                {rule.kind === 'firstChannel' && (
                  <Input
                    value={rule.codes.join(', ')}
                    onChange={(e) =>
                      setRule(index, {
                        ...rule,
                        codes: e.target.value
                          .split(',')
                          .map((c) => c.trim())
                          .filter(Boolean),
                      })
                    }
                    placeholder="인플루언서 코드·UTM 소스를 쉼표로 구분"
                    className="max-w-md py-1 text-sm"
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader title="3. 미리보기" description="지금 조건에 맞는 고객" />
        <div className="p-5">
          <p className="text-sm text-slate-500">조건 요약</p>
          <p className="mt-1 text-sm text-slate-800">{summarizeConditions(conditions)}</p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg bg-slate-50 p-4">
              <p className="text-xs text-slate-500">대상 고객</p>
              <p className="mt-0.5 text-2xl font-bold text-slate-400">-</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-4">
              <p className="text-xs text-slate-500">SMS 수신동의</p>
              <p className="mt-0.5 text-2xl font-bold text-slate-400">-</p>
            </div>
          </div>

          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800">
            아임웹 회원·주문 자료를 데이터베이스로 옮기면 여기에 실제 인원과 샘플 고객
            {formatNumber(10)}명이 표시됩니다. 지금은 조건을 만들어 두는 단계입니다.
          </p>
        </div>
      </Card>

      <div className="flex justify-end gap-2 pb-4">
        <Button variant="secondary" onClick={() => navigate('/crm/groups')}>
          취소
        </Button>
        <Button onClick={save} disabled={!name.trim() || create.isPending || update.isPending}>
          {create.isPending || update.isPending ? '저장 중...' : '저장'}
        </Button>
      </div>
    </div>
  )
}
