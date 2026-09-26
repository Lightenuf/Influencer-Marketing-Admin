import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button, Card, CardHeader, Field, Input, Select, Spinner } from '@/components/ui'
import { repository } from '@/data'
import {
  CAMPAIGN_STATUS_LABELS,
  CAMPAIGN_SOURCE_LABELS,
  CHANNEL_LABELS,
  clickRate,
  needsTagging,
  purchaseRate,
  successRate,
  unsubscribeRate,
  visitRate,
  type Campaign,
  type CampaignPatch,
} from '@/data/types'
import { formatDateTime, formatNumber } from '@/utils/format'

/** 구매 전환을 며칠까지 볼지. 진정성 콘텐츠는 늦게 효과가 나서 30일도 본다. */
const WINDOWS = [7, 14, 30]

export default function CampaignDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const client = useQueryClient()
  const [windowDays, setWindowDays] = useState(7)

  const campaign = useQuery({
    queryKey: ['campaign', id],
    queryFn: () => repository.getCampaign(id!),
    enabled: !!id,
  })

  const options = useQuery({
    queryKey: ['campaignOptions'],
    queryFn: () => repository.listCampaignOptions(),
  })

  const conversion = useQuery({
    queryKey: ['campaignConversion', id, windowDays],
    queryFn: () => repository.campaignConversion(id!, windowDays),
    enabled: !!id && campaign.data?.status === 'sent',
  })

  const save = useMutation({
    mutationFn: (patch: CampaignPatch) => repository.updateCampaign(id!, patch),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['campaign', id] })
      client.invalidateQueries({ queryKey: ['campaigns'] })
    },
  })

  const remove = useMutation({
    mutationFn: () => repository.deleteCampaign(id!),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['campaigns'] })
      navigate('/crm/campaigns')
    },
  })

  if (campaign.isLoading) return <Spinner />
  const row = campaign.data
  if (!row) {
    return (
      <Card className="p-8 text-center text-sm text-slate-500">
        캠페인을 찾을 수 없습니다.
        <div className="mt-3">
          <Button variant="secondary" onClick={() => navigate('/crm/campaigns')}>
            목록으로
          </Button>
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-4 pb-4">
      <div>
        <button
          type="button"
          onClick={() => navigate('/crm/campaigns')}
          className="text-sm text-slate-500 hover:text-violet-600"
        >
          ← 캠페인 관리
        </button>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-bold text-slate-900">{row.title || '(제목 없음)'}</h1>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
            {CAMPAIGN_STATUS_LABELS[row.status]}
          </span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
            {CAMPAIGN_SOURCE_LABELS[row.source]}
          </span>
          {needsTagging(row) && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700">
              태깅 필요
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-slate-500">
          {CHANNEL_LABELS[row.channel]} · {row.messageType || '유형 없음'} ·{' '}
          {row.sentAt ? formatDateTime(row.sentAt) : '보낸 적 없음'}
        </p>
      </div>

      <Card>
        <CardHeader title="성과" description="비율은 저장하지 않고 볼 때마다 다시 계산합니다" />
        <div className="grid gap-3 p-5 sm:grid-cols-3 lg:grid-cols-6">
          <Metric label="발송 대상" value={`${formatNumber(row.targetCount)}명`} />
          <Metric
            label="발송 성공"
            value={`${formatNumber(row.successCount)}명`}
            sub={row.targetCount > 0 ? `${(successRate(row) * 100).toFixed(1)}%` : undefined}
            warn={row.targetCount > 0 && successRate(row) < 0.5}
          />
          <Metric
            label="클릭"
            value={`${formatNumber(row.clickCount)}회`}
            sub={row.successCount > 0 ? `${(clickRate(row) * 100).toFixed(1)}%` : undefined}
          />
          <Metric
            label="유입"
            value={`${formatNumber(row.visitCount)}회`}
            sub={row.successCount > 0 ? `${(visitRate(row) * 100).toFixed(1)}%` : undefined}
          />
          <Metric
            label="구매 전환"
            value={`${formatNumber(row.purchaseCount)}건`}
            sub={row.successCount > 0 ? `${(purchaseRate(row) * 100).toFixed(1)}%` : undefined}
            strong
          />
          <Metric
            label="수신거부"
            value={`${formatNumber(row.unsubscribeCount)}명`}
            sub={row.successCount > 0 ? `${(unsubscribeRate(row) * 100).toFixed(2)}%` : undefined}
          />
        </div>

        <div className="border-t border-slate-100 px-5 py-4">
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-slate-700">
              구매 전환 금액 <b className="text-slate-900">{formatNumber(row.purchaseAmount)}원</b>
            </p>
            {row.status === 'sent' && row.source === 'admin_send' && (
              <>
                <span className="text-xs text-slate-400">|</span>
                <span className="text-xs text-slate-500">받은 분들의 주문을</span>
                <Select
                  value={windowDays}
                  onChange={(e) => setWindowDays(Number(e.target.value))}
                  className="w-auto py-1 text-xs"
                >
                  {WINDOWS.map((days) => (
                    <option key={days} value={days}>
                      {days}일
                    </option>
                  ))}
                </Select>
                <span className="text-xs text-slate-500">안에서 세면</span>
                {conversion.isLoading ? (
                  <span className="text-xs text-slate-400">세는 중...</span>
                ) : (
                  <span className="text-sm text-slate-800">
                    <b>{formatNumber(conversion.data?.buyers ?? 0)}명</b> ·{' '}
                    <b>{formatNumber(conversion.data?.purchaseCount ?? 0)}건</b> ·{' '}
                    <b>{formatNumber(conversion.data?.purchaseAmount ?? 0)}원</b>
                  </span>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    save.mutate({
                      purchaseCount: conversion.data?.purchaseCount ?? 0,
                      purchaseAmount: conversion.data?.purchaseAmount ?? 0,
                    })
                  }
                  disabled={!conversion.data || save.isPending}
                >
                  이 값으로 저장
                </Button>
              </>
            )}
          </div>
          {row.source === 'imweb_import' && (
            <p className="mt-2 text-xs text-slate-400">
              아임웹에서 올린 기록이라 받은 분 명단이 없습니다. 구매 전환은 CSV에 적힌 값을 씁니다.
            </p>
          )}
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="보낸 내용" description="발송 당시 원문 그대로입니다" />
          <div className="space-y-3 p-5">
            {row.imageUrl && (
              <img
                src={row.imageUrl}
                alt=""
                className="max-h-64 rounded-lg border border-slate-200 object-contain"
              />
            )}
            <pre className="rounded-lg bg-slate-50 px-3 py-2.5 text-sm break-words whitespace-pre-wrap text-slate-800">
              {row.messageBody || '(원문이 없습니다 — CSV로 올린 기록입니다)'}
            </pre>
            <div className="text-xs text-slate-500">
              고객군 <b className="text-slate-700">{row.segmentName || '-'}</b>
              {row.isAd && <span className="ml-2 text-amber-700">광고성 메시지</span>}
            </div>
          </div>
        </Card>

        <TaggingCard
          row={row}
          options={options.data ?? []}
          onSave={(patch) => save.mutate(patch)}
          saving={save.isPending}
        />
      </div>

      <div className="flex justify-end">
        <Button
          variant="ghost"
          className="text-rose-500 hover:bg-rose-50"
          onClick={() => {
            if (confirm('이 캠페인 기록을 지울까요? 되돌릴 수 없습니다.')) remove.mutate()
          }}
        >
          기록 지우기
        </Button>
      </div>
    </div>
  )
}

/** 사후 태깅 — CSV로 올린 예전 캠페인에 목적·컨셉을 달아준다 */
function TaggingCard({
  row,
  options,
  onSave,
  saving,
}: {
  row: Campaign
  options: { id: string; kind: string; label: string }[]
  onSave: (patch: CampaignPatch) => void
  saving: boolean
}) {
  const [purpose, setPurpose] = useState(row.purpose)
  const [concepts, setConcepts] = useState<string[]>(row.concepts)
  const [offerType, setOfferType] = useState(row.offerType)
  const [offerValue, setOfferValue] = useState(row.offerValue)
  const [hypothesis, setHypothesis] = useState(row.hypothesis)
  const [retrospective, setRetrospective] = useState(row.retrospective)

  // 다른 캠페인으로 옮겨 가면 입력칸도 그 캠페인 것으로 바뀌어야 한다
  useEffect(() => {
    setPurpose(row.purpose)
    setConcepts(row.concepts)
    setOfferType(row.offerType)
    setOfferValue(row.offerValue)
    setHypothesis(row.hypothesis)
    setRetrospective(row.retrospective)
  }, [row])

  const purposes = options.filter((o) => o.kind === 'purpose')
  const conceptOptions = options.filter((o) => o.kind === 'concept')
  const offerTypes = options.filter((o) => o.kind === 'offer_type')

  const toggle = (label: string) =>
    setConcepts((prev) =>
      prev.includes(label) ? prev.filter((c) => c !== label) : [...prev, label],
    )

  return (
    <Card>
      <CardHeader
        title="분류와 메모"
        description="예전 캠페인에도 목적과 컨셉을 달아두면 비교할 수 있습니다"
      />
      <div className="space-y-4 p-5">
        <div>
          <p className="text-sm font-medium text-slate-700">목적</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {purposes.map((o) => (
              <Chip
                key={o.id}
                label={o.label}
                on={purpose === o.label}
                onClick={() => setPurpose(purpose === o.label ? '' : o.label)}
              />
            ))}
          </div>
        </div>

        <div>
          <p className="text-sm font-medium text-slate-700">컨셉</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {conceptOptions.map((o) => (
              <Chip
                key={o.id}
                label={o.label}
                on={concepts.includes(o.label)}
                onClick={() => toggle(o.label)}
              />
            ))}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="오퍼 유형">
            <Select value={offerType} onChange={(e) => setOfferType(e.target.value)}>
              <option value="없음">없음</option>
              {offerTypes
                .filter((o) => o.label !== '없음')
                .map((o) => (
                  <option key={o.id} value={o.label}>
                    {o.label}
                  </option>
                ))}
            </Select>
          </Field>
          <Field label="오퍼 값">
            <Input
              value={offerValue}
              onChange={(e) => setOfferValue(e.target.value)}
              disabled={offerType === '없음'}
              placeholder="예) 15"
            />
          </Field>
        </div>

        <div>
          <p className="text-sm font-medium text-slate-700">가설</p>
          <textarea
            value={hypothesis}
            onChange={(e) => setHypothesis(e.target.value)}
            rows={2}
            placeholder="무엇을 기대하고 보냈나"
            className="mt-1.5 w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-400"
          />
        </div>

        <div>
          <p className="text-sm font-medium text-slate-700">회고</p>
          <textarea
            value={retrospective}
            onChange={(e) => setRetrospective(e.target.value)}
            rows={3}
            placeholder="결과를 보고 무엇을 배웠나. 다음에 무엇을 다르게 할까"
            className="mt-1.5 w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-400"
          />
        </div>

        <div className="flex justify-end">
          <Button
            onClick={() =>
              onSave({ purpose, concepts, offerType, offerValue, hypothesis, retrospective })
            }
            disabled={saving}
          >
            {saving ? '저장 중...' : '저장'}
          </Button>
        </div>
      </div>
    </Card>
  )
}

function Chip({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
        on
          ? 'border-violet-500 bg-violet-500 text-white'
          : 'border-slate-200 bg-white text-slate-600 hover:border-violet-300'
      }`}
    >
      {label}
    </button>
  )
}

function Metric({
  label,
  value,
  sub,
  strong,
  warn,
}: {
  label: string
  value: string
  sub?: string
  strong?: boolean
  warn?: boolean
}) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p
        className={`mt-0.5 text-lg font-bold ${
          warn ? 'text-rose-600' : strong ? 'text-violet-600' : 'text-slate-800'
        }`}
      >
        {value}
      </p>
      {sub && <p className="text-xs text-slate-400">{sub}</p>}
    </div>
  )
}
