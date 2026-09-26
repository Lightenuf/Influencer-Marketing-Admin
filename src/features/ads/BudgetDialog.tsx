import { useState } from 'react'
import { Button, Card, Input } from '@/components/ui'
import type { MetaAdSet, MetaCampaign } from '@/data/metaTypes'
import { useSetDailyBudget } from '@/hooks/metaQueries'
import { formatNumber } from '@/utils/format'

/**
 * 예산이 실제로 붙어 있는 자리.
 * 메타에서 광고에는 예산 칸이 없다 — 캠페인 예산 최적화(CBO)면 캠페인, 아니면 광고 세트다.
 */
export function budgetOwner(campaign: MetaCampaign, adset: MetaAdSet) {
  return campaign.isCbo
    ? {
        level: 'campaign' as const,
        id: campaign.id,
        name: campaign.name,
        won: campaign.dailyBudget,
      }
    : { level: 'adset' as const, id: adset.id, name: adset.name, won: adset.dailyBudget }
}

export default function BudgetDialog({
  owner,
  sharedBy,
  onClose,
}: {
  owner: ReturnType<typeof budgetOwner> | null
  sharedBy: number
  onClose: () => void
}) {
  const setBudget = useSetDailyBudget()
  const [draft, setDraft] = useState('')

  if (!owner) return null

  const current = owner.won ?? 0
  const next = Number(draft.replace(/[^\d]/g, '')) || 0
  const changed = next > 0 && next !== current
  const diff = next - current
  const percent = current > 0 ? Math.round((diff / current) * 100) : 0

  const step = (ratio: number) =>
    setDraft(String(Math.round((current * (1 + ratio)) / 1000) * 1000))

  const save = () => {
    setBudget.mutate({ level: owner.level, id: owner.id, won: next }, { onSuccess: onClose })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <Card className="w-full max-w-md p-5">
        <h2 className="text-lg font-bold text-slate-900">일예산 조정</h2>
        <p className="mt-1 text-sm text-slate-500">
          {owner.level === 'campaign' ? '캠페인' : '광고 세트'}{' '}
          <b className="text-slate-700">{owner.name}</b>의 하루 예산입니다.
        </p>

        {sharedBy > 1 && (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800">
            이 예산은 <b>광고 {formatNumber(sharedBy)}개가 함께</b> 씁니다. 메타에서는 광고 하나만
            따로 예산을 줄 수 없어, 여기를 고치면 그 광고들이 모두 영향을 받습니다.
          </p>
        )}

        <div className="mt-4">
          <p className="text-sm text-slate-500">
            지금 <b className="text-slate-900">{formatNumber(current)}원 / 일</b>
          </p>
          <div className="mt-2 flex gap-1.5">
            {[-0.2, -0.1, 0.1, 0.2].map((ratio) => (
              <Button key={ratio} size="sm" variant="secondary" onClick={() => step(ratio)}>
                {ratio > 0 ? '+' : ''}
                {Math.round(ratio * 100)}%
              </Button>
            ))}
          </div>
          <div className="mt-2">
            <Input
              inputMode="numeric"
              value={draft}
              onChange={(e) => setDraft(e.target.value.replace(/[^\d]/g, ''))}
              placeholder="바꿀 금액 (원)"
            />
          </div>
          {changed && (
            <p className="mt-2 text-sm">
              <span className="text-slate-500">바뀐 뒤 </span>
              <b className="text-slate-900">{formatNumber(next)}원 / 일</b>{' '}
              <span className={diff > 0 ? 'text-rose-600' : 'text-emerald-600'}>
                ({diff > 0 ? '+' : ''}
                {formatNumber(diff)}원 · {percent > 0 ? '+' : ''}
                {percent}%)
              </span>
            </p>
          )}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            취소
          </Button>
          <Button onClick={save} disabled={!changed || setBudget.isPending}>
            {setBudget.isPending ? '바꾸는 중...' : '이 금액으로 바꾸기'}
          </Button>
        </div>
      </Card>
    </div>
  )
}
