import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, Field, Input, Modal, Select } from '@/components/ui'
import { COLLAB_STAGES, SNS_PLATFORM_LABELS, type CollabStage, type Influencer } from '@/data/types'
import { useCollabs, useCreateCollab, useInfluencers } from '@/hooks/queries'
import { formatNumber } from '@/utils/format'

/** 검색어를 아이디 형태로 정리한다. 인스타 링크를 통째로 붙여넣어도 아이디만 남는다. */
function normalize(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/^(instagram|youtube|tiktok)\.com\//, '')
    .replace(/^@/, '')
    .replace(/\/.*$/, '')
    .replace(/\?.*$/, '')
}

const MAX_RESULTS = 8

/**
 * 파이프라인에 크리에이터를 올리는 창.
 * 여기 올라오는 분들은 전부 최종 마켓(공구)이 목표이므로 구분·건명은 받지 않는다.
 */
export default function CollabFormDialog({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const { data: influencers = [] } = useInfluencers()
  const { data: collabs = [] } = useCollabs()
  const createCollab = useCreateCollab()

  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Influencer | null>(null)
  const [stage, setStage] = useState<CollabStage>(COLLAB_STAGES[0])

  useEffect(() => {
    if (open) {
      setQuery('')
      setSelected(null)
      setStage(COLLAB_STAGES[0])
    }
  }, [open])

  // 한 사람당 카드 한 장 — 이미 올라와 있는지 표시해준다.
  const alreadyInPipeline = useMemo(() => new Set(collabs.map((c) => c.influencerId)), [collabs])

  const matches = useMemo(() => {
    const q = normalize(query)
    if (!q) return []
    const raw = query.trim().toLowerCase()
    return influencers
      .filter(
        (i) =>
          i.snsHandle.toLowerCase().includes(q) ||
          i.name.toLowerCase().includes(raw) ||
          i.snsUrl.toLowerCase().includes(q),
      )
      .slice(0, MAX_RESULTS)
  }, [query, influencers])

  const firstSelectableId = matches.find((m) => !alreadyInPipeline.has(m.id))?.id

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selected) return
    createCollab.mutate(
      {
        influencerId: selected.id,
        stage,
        title: '',
        collabType: '마켓',
        // 아래 값들은 카드에서 단계별로 채운다.
        startDate: null,
        endDate: null,
        sampleShipDate: null,
        contentDueDate: null,
        fee: 0,
        seedingAccepted: null,
        testFeedback: null,
        meetingAccepted: null,
        lastContactedAt: null,
        meetingAt: null,
        marketDate: null,
        marketEndDate: null,
        marketRevenue: 0,
        marketUnits: 0,
        isSettled: false,
        contentLinks: [],
      },
      { onSuccess: onClose },
    )
  }

  return (
    <Modal open={open} onClose={onClose} title="파이프라인에 추가">
      <form onSubmit={submit} className="space-y-4">
        <Field label="크리에이터" required>
          {selected ? (
            <div className="flex items-center justify-between gap-2 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-900">{selected.name}</p>
                <p className="truncate text-xs text-slate-500">@{selected.snsHandle}</p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  setSelected(null)
                  setQuery('')
                }}
              >
                변경
              </Button>
            </div>
          ) : (
            <>
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  // Enter 한 번으로 첫 후보 선택 (붙여넣고 바로 엔터)
                  // 한글을 조합하는 중이면 글자를 확정하는 Enter이므로 넘긴다.
                  if (e.nativeEvent.isComposing) return
                  if (e.key !== 'Enter') return
                  e.preventDefault()
                  const first = matches.find((m) => !alreadyInPipeline.has(m.id))
                  if (first) setSelected(first)
                }}
                placeholder="아이디 붙여넣기 (예: nalssin_cook) 또는 이름으로 검색"
                autoFocus
              />
              {query.trim() !== '' && (
                <div className="mt-1.5 max-h-56 overflow-y-auto rounded-lg border border-slate-200">
                  {matches.length === 0 ? (
                    <div className="px-3 py-3">
                      <p className="text-xs text-slate-500">
                        등록된 크리에이터 중에 없습니다. 인플루언서로 먼저 등록해야 여기에
                        나타납니다.
                      </p>
                      <Link
                        to={`/influencers/new?url=${encodeURIComponent(query.trim())}`}
                        className="mt-2 inline-block rounded-md bg-violet-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-violet-700"
                      >
                        이 링크로 등록하러 가기
                      </Link>
                    </div>
                  ) : (
                    <ul className="divide-y divide-slate-100">
                      {matches.map((influencer) => {
                        const taken = alreadyInPipeline.has(influencer.id)
                        return (
                          <li key={influencer.id}>
                            <button
                              type="button"
                              disabled={taken}
                              onClick={() => setSelected(influencer)}
                              className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-violet-50 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:hover:bg-slate-50"
                            >
                              <span className="min-w-0">
                                <span className="block truncate text-sm text-slate-900">
                                  {influencer.name}
                                  {influencer.doNotContact && (
                                    <span className="ml-1 text-xs text-rose-600">⛔ 연락 금지</span>
                                  )}
                                </span>
                                <span className="block truncate text-xs text-slate-500">
                                  @{influencer.snsHandle} ·{' '}
                                  {SNS_PLATFORM_LABELS[influencer.snsPlatform]} · 팔로워{' '}
                                  {formatNumber(influencer.followerCount)}
                                </span>
                              </span>
                              {taken ? (
                                <span className="shrink-0 text-[11px] text-slate-400">
                                  이미 추가됨
                                </span>
                              ) : (
                                influencer.id === firstSelectableId && (
                                  <span className="shrink-0 rounded border border-slate-200 px-1 text-[10px] text-slate-400">
                                    Enter
                                  </span>
                                )
                              )}
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>
              )}
            </>
          )}
        </Field>

        {selected?.doNotContact && (
          <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">
            ⛔ 연락 금지로 등록된 크리에이터입니다. 사유: {selected.dncReason}
          </p>
        )}

        <Field label="시작 단계">
          <Select value={stage} onChange={(e) => setStage(e.target.value as CollabStage)}>
            {COLLAB_STAGES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </Field>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            취소
          </Button>
          <Button type="submit" disabled={!selected}>
            추가
          </Button>
        </div>
      </form>
    </Modal>
  )
}
