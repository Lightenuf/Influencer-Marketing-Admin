import { useMemo, useState } from 'react'
import { Button, Card, CardHeader, EmptyState, Input, Spinner } from '@/components/ui'
import { isMetaMockMode } from '@/data'
import type { MetaAd, MetaAdSet, MetaCampaign } from '@/data/metaTypes'
import {
  useMetaAdSets,
  useMetaAds,
  useMetaCampaigns,
  useSetAdStatus,
  useSetDailyBudget,
} from '@/hooks/metaQueries'
import { formatNumber } from '@/utils/format'

/**
 * 예산이 실제로 붙어 있는 자리.
 * 메타에서 광고에는 예산 칸이 없다 — 캠페인 예산 최적화(CBO)면 캠페인, 아니면 광고 세트다.
 */
function budgetOwner(campaign: MetaCampaign, adset: MetaAdSet) {
  return campaign.isCbo
    ? {
        level: 'campaign' as const,
        id: campaign.id,
        name: campaign.name,
        won: campaign.dailyBudget,
      }
    : { level: 'adset' as const, id: adset.id, name: adset.name, won: adset.dailyBudget }
}

function BudgetDialog({
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

function StatusToggle({ ad }: { ad: MetaAd }) {
  const setStatus = useSetAdStatus()
  const active = ad.status === 'ACTIVE'

  return (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      disabled={setStatus.isPending}
      title={active ? '누르면 일시중지합니다' : '누르면 다시 켭니다'}
      onClick={() => setStatus.mutate({ adId: ad.id, status: active ? 'PAUSED' : 'ACTIVE' })}
      className={
        active
          ? 'relative h-5 w-9 rounded-full bg-emerald-500 transition-colors disabled:opacity-50'
          : 'relative h-5 w-9 rounded-full bg-slate-300 transition-colors disabled:opacity-50'
      }
    >
      <span
        className={
          active
            ? 'absolute top-0.5 left-4.5 h-4 w-4 rounded-full bg-white transition-all'
            : 'absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-all'
        }
      />
    </button>
  )
}

export default function AdsManagePage() {
  const { data: campaigns = [] } = useMetaCampaigns()
  const { data: adsets = [] } = useMetaAdSets()
  const { data: ads = [], isLoading } = useMetaAds()
  const [onlyActive, setOnlyActive] = useState(false)
  const [budgetTarget, setBudgetTarget] = useState<{
    owner: ReturnType<typeof budgetOwner>
    sharedBy: number
  } | null>(null)

  const rows = useMemo(() => {
    return ads
      .map((ad) => {
        const adset = adsets.find((item) => item.id === ad.adsetId)
        const campaign = adset ? campaigns.find((item) => item.id === adset.campaignId) : undefined
        return { ad, adset, campaign }
      })
      .filter((row) => row.adset && row.campaign)
      .filter((row) => !onlyActive || row.ad.status === 'ACTIVE')
  }, [ads, adsets, campaigns, onlyActive])

  /** 같은 예산을 쓰는 광고가 몇 개인지 — 예산을 고치기 전에 보여준다 */
  const sharedCount = (owner: ReturnType<typeof budgetOwner>) =>
    owner.level === 'campaign'
      ? ads.filter((ad) => {
          const set = adsets.find((item) => item.id === ad.adsetId)
          return set?.campaignId === owner.id
        }).length
      : ads.filter((ad) => ad.adsetId === owner.id).length

  if (isLoading) return <Spinner />

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">광고 관리</h1>
          <p className="mt-1 text-sm text-slate-500">
            돌고 있는 광고를 켜고 끄거나 예산을 조정합니다.
          </p>
        </div>
        {isMetaMockMode && (
          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700">
            예시 데이터 — 메타 계정에 아직 연결되지 않았습니다
          </span>
        )}
      </div>

      <label className="inline-flex items-center gap-2 text-sm text-slate-600">
        <input
          type="checkbox"
          checked={onlyActive}
          onChange={(e) => setOnlyActive(e.target.checked)}
          className="h-4 w-4 accent-violet-600"
        />
        켜진 광고만 보기
      </label>

      <Card>
        <CardHeader
          title={`광고 ${formatNumber(rows.length)}개`}
          description="예산은 광고가 아니라 그 광고가 속한 광고 세트(또는 CBO 캠페인)에 붙습니다"
        />
        {rows.length === 0 ? (
          <EmptyState title="보여줄 광고가 없습니다" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[840px] text-sm">
              <thead className="border-y border-slate-100 bg-slate-50 text-xs text-slate-500">
                <tr>
                  <th className="px-5 py-2.5 text-left font-medium">켜짐</th>
                  <th className="px-3 py-2.5 text-left font-medium">광고</th>
                  <th className="px-3 py-2.5 text-left font-medium">광고 세트 / 캠페인</th>
                  <th className="px-3 py-2.5 text-right font-medium whitespace-nowrap">
                    일예산 (붙어 있는 곳)
                  </th>
                  <th className="px-5 py-2.5 text-right font-medium">예산</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map(({ ad, adset, campaign }) => {
                  const owner = budgetOwner(campaign!, adset!)
                  return (
                    <tr key={ad.id} className="hover:bg-slate-50">
                      <td className="px-5 py-3">
                        <StatusToggle ad={ad} />
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium whitespace-nowrap text-slate-900">
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
                        </div>
                      </td>
                      <td className="px-3 py-3 text-xs text-slate-500">
                        <p className="whitespace-nowrap">{adset!.name}</p>
                        <p className="whitespace-nowrap text-slate-400">{campaign!.name}</p>
                      </td>
                      <td className="tabular px-3 py-3 text-right whitespace-nowrap">
                        <span className="text-slate-900">
                          {owner.won ? `${formatNumber(owner.won)}원 / 일` : '설정 없음'}
                        </span>
                        <span className="ml-1 text-xs text-slate-400">
                          {owner.level === 'campaign' ? '캠페인' : '광고 세트'}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setBudgetTarget({ owner, sharedBy: sharedCount(owner) })}
                        >
                          조정
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <BudgetDialog
        owner={budgetTarget?.owner ?? null}
        sharedBy={budgetTarget?.sharedBy ?? 0}
        onClose={() => setBudgetTarget(null)}
      />
    </div>
  )
}
