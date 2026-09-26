import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCurrentUser } from '@/auth/AuthProvider'
import PeriodPicker, { presetPeriod, type PeriodPreset } from '@/components/PeriodPicker'
import { Button, Card, CardHeader, EmptyState, Select, Spinner } from '@/components/ui'
import { isMetaMockMode } from '@/data'
import {
  TAG_DIMENSIONS,
  TAG_DIMENSION_LABELS,
  type AdTagsInput,
  type TagDimension,
} from '@/data/adTypes'
import type { MetaAd } from '@/data/metaTypes'
import { useAdTags, useNameAliases, useSaveAdTags, useTagOptions } from '@/hooks/adTagQueries'
import { useMetaAds, useMetaInsights } from '@/hooks/metaQueries'
import { isClassified, parseAdName } from '@/utils/adNameParser'
import { creativeKeyOf, keyConfidence } from '@/utils/creativeKey'
import { formatNumber, formatWon } from '@/utils/format'

/** 화면에 담는 한 줄 */
interface Row {
  ad: MetaAd
  spend: number
  creativeKey: string
  /** 이름에서 읽어낸 것 — 아직 저장 전 */
  read: Record<TagDimension, string>
  /** 사람이 고친 것 */
  edited: Record<TagDimension, string>
  saved: boolean
  classified: boolean
  leftover: string[]
  creatorHint: string
}

const emptyTags = (): Record<TagDimension, string> => ({
  source: '',
  format: '',
  angle: '',
  hook: '',
  segment: '',
  offer: '',
})

/** 설정 안에 끼워 쓸 때는 자기 제목과 뒤로가기를 숨긴다 */
export default function AdTaggingPage({ embedded = false }: { embedded?: boolean } = {}) {
  const navigate = useNavigate()
  const user = useCurrentUser()

  const [preset, setPreset] = useState<PeriodPreset>('month')
  const [period, setPeriod] = useState(() => presetPeriod('month'))
  const [only, setOnly] = useState<'untagged' | 'all'>('untagged')
  const [edits, setEdits] = useState<Record<string, Record<TagDimension, string>>>({})

  const ads = useMetaAds()
  const insights = useMetaInsights('ad', period)
  const options = useTagOptions()
  const aliases = useNameAliases()
  const saved = useAdTags()
  const save = useSaveAdTags(user.id)

  const rows = useMemo<Row[]>(() => {
    if (!ads.data || !aliases.data) return []
    const spendOf = new Map((insights.data ?? []).map((row) => [row.id, row.spend]))
    const savedOf = new Map((saved.data ?? []).map((row) => [row.adId, row]))

    return ads.data.map((ad) => {
      const parsed = parseAdName(ad.name, aliases.data)
      const read: Record<TagDimension, string> = {
        source: parsed.tags.source,
        format: parsed.tags.format,
        angle: parsed.tags.angle,
        hook: parsed.tags.hook,
        segment: parsed.tags.segment,
        offer: parsed.tags.offer,
      }
      const already = savedOf.get(ad.id)
      const base: Record<TagDimension, string> = already
        ? {
            source: already.source,
            format: already.format,
            angle: already.angle,
            hook: already.hook,
            segment: already.segment,
            offer: already.offer,
          }
        : read

      return {
        ad,
        spend: spendOf.get(ad.id) ?? 0,
        creativeKey: creativeKeyOf(ad),
        read,
        edited: edits[ad.id] ?? base,
        saved: !!already,
        classified: isClassified(parsed.tags),
        leftover: parsed.leftover,
        creatorHint: parsed.tags.creatorHint,
      }
    })
  }, [ads.data, aliases.data, insights.data, saved.data, edits])

  // 5-3 지출이 있는 광고부터 본다. 판단에 쓰이는 것부터 붙여야 한다.
  const sorted = useMemo(
    () =>
      [...rows]
        .filter((row) => (only === 'all' ? true : !row.saved))
        .sort((a, b) => b.spend - a.spend || a.ad.name.localeCompare(b.ad.name)),
    [rows, only],
  )

  if (ads.isLoading || options.isLoading || aliases.isLoading || saved.isLoading) return <Spinner />

  const total = rows.length
  const autoOk = rows.filter((r) => r.classified).length
  const savedCount = rows.filter((r) => r.saved).length
  const withSpend = rows.filter((r) => r.spend > 0)
  const withSpendOk = withSpend.filter((r) => r.classified).length

  const changed = Object.keys(edits).length
  const dirtyRows = rows.filter((r) => edits[r.ad.id])

  const setTag = (adId: string, dimension: TagDimension, value: string) =>
    setEdits((prev) => ({
      ...prev,
      [adId]: { ...(prev[adId] ?? emptyTags()), ...rowTags(rows, adId), [dimension]: value },
    }))

  const saveAll = () => {
    const payload: (AdTagsInput & { adId: string })[] = dirtyRows.map((row) => ({
      adId: row.ad.id,
      creativeKey: row.creativeKey,
      ...row.edited,
      taggedFrom: 'manual',
    }))
    save.mutate(payload, { onSuccess: () => setEdits({}) })
  }

  /** 이름에서 읽은 값을 그대로 저장한다 — 사람이 확인한 뒤 누르는 버튼 (5-3) */
  const acceptParsed = () => {
    const next: Record<string, Record<TagDimension, string>> = { ...edits }
    for (const row of sorted) {
      if (!row.classified || row.saved) continue
      next[row.ad.id] = row.read
    }
    setEdits(next)
  }

  return (
    <div className="space-y-4 pb-24">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          {!embedded && (
            <>
              <button
                type="button"
                onClick={() => navigate('/ads/actions')}
                className="text-sm text-slate-500 hover:text-violet-600"
              >
                ← 퍼포먼스 마케팅
              </button>
              <h1 className="mt-1 text-xl font-bold text-slate-900">광고 태깅</h1>
            </>
          )}
          <p className={`${embedded ? '' : 'mt-1 '}text-sm text-slate-500`}>
            옛 광고 이름에서 읽어낸 태그입니다. <b>확인하고 저장해야</b> 반영됩니다 — 자동으로
            저장하지 않습니다. 메타의 광고 이름은 바뀌지 않습니다.
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

      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="전체 광고" value={`${formatNumber(total)}개`} />
        <Stat
          label="이름에서 읽힘"
          value={`${formatNumber(autoOk)}개`}
          note={total > 0 ? `${Math.round((autoOk / total) * 100)}%` : undefined}
        />
        <Stat
          label="지출 있는 광고 중 읽힘"
          value={`${formatNumber(withSpendOk)} / ${formatNumber(withSpend.length)}`}
          note={
            withSpend.length > 0
              ? `${Math.round((withSpendOk / withSpend.length) * 100)}%`
              : undefined
          }
          strong
        />
        <Stat label="저장된 태그" value={`${formatNumber(savedCount)}개`} />
      </div>

      <Card>
        <CardHeader
          title={`태깅할 광고 ${formatNumber(sorted.length)}개`}
          description="지출이 많은 것부터 보여줍니다"
          action={
            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={only}
                onChange={(e) => setOnly(e.target.value as 'untagged' | 'all')}
                className="w-auto py-1 text-xs"
              >
                <option value="untagged">아직 저장 안 한 것</option>
                <option value="all">전체</option>
              </Select>
              <Button size="sm" variant="secondary" onClick={acceptParsed}>
                읽힌 것 모두 채우기
              </Button>
            </div>
          }
        />

        {sorted.length === 0 ? (
          <EmptyState
            title="태깅할 광고가 없습니다"
            description="모두 저장했거나, 불러온 광고가 없습니다."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-sm">
              <thead className="border-y border-slate-100 bg-slate-50 text-xs text-slate-500">
                <tr>
                  <th className="px-4 py-2.5 text-left font-medium">광고</th>
                  <th className="px-2 py-2.5 text-right font-medium whitespace-nowrap">지출</th>
                  {TAG_DIMENSIONS.map((d) => (
                    <th key={d} className="px-2 py-2.5 text-left font-medium whitespace-nowrap">
                      {TAG_DIMENSION_LABELS[d]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sorted.map((row) => {
                  const dirty = !!edits[row.ad.id]
                  return (
                    <tr key={row.ad.id} className={dirty ? 'bg-violet-50/40' : 'hover:bg-slate-50'}>
                      <td className="max-w-[300px] px-4 py-2.5">
                        <div className="flex items-start gap-2">
                          {row.ad.thumbnailUrl ? (
                            <img
                              src={row.ad.thumbnailUrl}
                              alt=""
                              className="h-10 w-10 shrink-0 rounded object-cover"
                            />
                          ) : (
                            <div className="h-10 w-10 shrink-0 rounded bg-slate-100" />
                          )}
                          <div className="min-w-0">
                            <p className="truncate text-slate-900" title={row.ad.name}>
                              {row.ad.name}
                            </p>
                            <p className="text-[11px] text-slate-400">
                              {keyConfidence(row.creativeKey)}
                              {row.saved && <span className="ml-1.5 text-emerald-600">저장됨</span>}
                              {!row.classified && !row.saved && (
                                <span className="ml-1.5 text-amber-600">미분류</span>
                              )}
                              {row.creatorHint && (
                                <span className="ml-1.5 text-violet-500">
                                  크리에이터? {row.creatorHint}
                                </span>
                              )}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="tabular px-2 py-2.5 text-right whitespace-nowrap text-slate-600">
                        {row.spend > 0 ? formatWon(row.spend) : '-'}
                      </td>
                      {TAG_DIMENSIONS.map((dimension) => {
                        const choices = (options.data ?? []).filter(
                          (o) => o.dimension === dimension && o.active,
                        )
                        const value = row.edited[dimension] ?? ''
                        const fromName = row.read[dimension] && row.read[dimension] === value
                        return (
                          <td key={dimension} className="px-2 py-2.5">
                            <Select
                              value={value}
                              onChange={(e) => setTag(row.ad.id, dimension, e.target.value)}
                              className={`w-auto min-w-[110px] py-1 text-xs ${
                                fromName ? 'border-violet-200 bg-violet-50/60' : ''
                              }`}
                            >
                              <option value="">-</option>
                              {choices.map((option) => (
                                <option key={option.id} value={option.label}>
                                  {option.label}
                                </option>
                              ))}
                            </Select>
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {changed > 0 && (
        <div className="fixed inset-x-0 bottom-0 border-t border-slate-200 bg-white/95 px-6 py-3 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
            <p className="text-sm text-slate-700">
              <b>{formatNumber(changed)}개</b> 광고의 태그를 바꿨습니다
            </p>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setEdits({})}>
                되돌리기
              </Button>
              <Button onClick={saveAll} disabled={save.isPending}>
                {save.isPending ? '저장 중...' : `${formatNumber(changed)}개 저장`}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/** 지금 화면에 보이는 그 광고의 태그 — 고칠 때 나머지 칸을 잃지 않으려고 쓴다 */
function rowTags(rows: Row[], adId: string): Record<TagDimension, string> {
  const row = rows.find((r) => r.ad.id === adId)
  return row ? row.edited : emptyTags()
}

function Stat({
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
      <p className={`mt-0.5 text-xl font-bold ${strong ? 'text-violet-600' : 'text-slate-900'}`}>
        {value}
      </p>
      {note && <p className="text-xs text-slate-400">{note}</p>}
    </div>
  )
}
