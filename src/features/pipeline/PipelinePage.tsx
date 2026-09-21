import clsx from 'clsx'
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { Link } from 'react-router-dom'
import { DncBadge } from '@/components/badges'
import { Button, Card, EmptyState, Spinner } from '@/components/ui'
import { COLLAB_STAGES, type Collab, type CollabStage, type Influencer } from '@/data/types'
import CancelCollabDialog from '@/features/pipeline/CancelCollabDialog'
import CollabFormDialog from '@/features/pipeline/CollabFormDialog'
import MarketResultDialog from '@/features/pipeline/MarketResultDialog'
import StageActions from '@/features/pipeline/StageActions'
import {
  useCollabs,
  useInfluencers,
  useMoveCollabStage,
  useReorderCollabs,
  useUpdateCollab,
} from '@/hooks/queries'
import { daysSince } from '@/utils/format'
import { profileUrl } from '@/utils/profileLink'

const STALE_DAYS = 15
const FIRST_STAGE = COLLAB_STAGES[0]
const LAST_STAGE = COLLAB_STAGES[COLLAB_STAGES.length - 1]

/**
 * 카드 메모 — 특이 요청사항처럼 이 사람과 일할 때 기억할 것을 적는다.
 * 글자를 칠 때마다 저장하면 목록이 계속 다시 그려지므로, 칸을 벗어날 때 한 번 저장한다.
 */
function CardMemo({ collab }: { collab: Collab }) {
  const update = useUpdateCollab()
  const [draft, setDraft] = useState(collab.memo)
  const [saved, setSaved] = useState(false)

  useEffect(() => setDraft(collab.memo), [collab.memo])

  const commit = () => {
    if (draft === collab.memo) return
    update.mutate(
      { id: collab.id, patch: { memo: draft } },
      {
        onSuccess: () => {
          setSaved(true)
          setTimeout(() => setSaved(false), 1500)
        },
      },
    )
  }

  // 칸 밖을 누르기 전에 창을 닫아도 남도록, 손을 멈추면 알아서 저장한다.
  useEffect(() => {
    if (draft === collab.memo) return
    const timer = setTimeout(commit, 800)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft])

  return (
    <div className="mt-2">
      <div className="flex items-center justify-between px-0.5 pb-0.5">
        <span className="text-[11px] font-medium text-slate-500">메모</span>
        {saved && <span className="text-[11px] text-emerald-600">저장됨</span>}
      </div>
      <textarea
        rows={3}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        placeholder="특이 요청사항 · 기억할 것"
        className="w-full resize-none overflow-y-auto rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[11px] leading-relaxed text-slate-700 placeholder:text-slate-300 focus:border-violet-400 focus:outline-none"
      />
    </div>
  )
}

/**
 * 한 단계의 카드 목록.
 * 순서를 바꾸면 카드가 튀지 않고 미끄러지도록, 바뀌기 전 위치를 기억했다가
 * 그만큼 되돌려 놓은 뒤 새 자리로 옮긴다.
 */
function StageCards({
  items,
  stage,
  influencerOf,
  onMoveStage,
  onReorder,
  onCancel,
  onCompleteMarket,
}: {
  items: Collab[]
  stage: CollabStage
  influencerOf: (id: string) => Influencer | undefined
  onMoveStage: (collab: Collab, direction: -1 | 1) => void
  onReorder: (orderedIds: string[]) => void
  onCancel: (collab: Collab) => void
  onCompleteMarket: (collab: Collab) => void
}) {
  const cards = useRef(new Map<string, HTMLDivElement>())
  const lastTop = useRef(new Map<string, number>())
  const drag = useRef<{ id: string; startY: number; moved: boolean } | null>(null)

  // 끄는 동안에는 화면에만 순서를 바꿔 두고, 손을 떼면 저장한다.
  const [order, setOrder] = useState(items)
  const [dragId, setDragId] = useState<string | null>(null)
  const [offset, setOffset] = useState(0)

  useEffect(() => {
    if (!dragId) setOrder(items)
  }, [items, dragId])

  const registerCard = (id: string) => (element: HTMLDivElement | null) => {
    if (element) cards.current.set(id, element)
    else cards.current.delete(id)
  }

  // 자리가 바뀐 카드는 옛 자리에서 새 자리로 미끄러진다. 끌고 있는 카드는 손을 따라가므로 뺀다.
  useLayoutEffect(() => {
    for (const [id, element] of cards.current) {
      const top = element.getBoundingClientRect().top
      const before = lastTop.current.get(id)
      if (id !== dragId && before !== undefined && Math.abs(before - top) > 1) {
        element.style.transition = 'none'
        element.style.transform = `translateY(${before - top}px)`
        requestAnimationFrame(() => {
          element.style.transition = 'transform 220ms ease'
          element.style.transform = ''
        })
      }
      lastTop.current.set(id, top)
    }
  }, [order, dragId])

  /** 카드의 빈 곳을 잡았을 때만 끌기 시작한다. 버튼·링크·메모칸은 원래 하던 일을 한다. */
  const startDrag = (collab: Collab, event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    if ((event.target as HTMLElement).closest('button, a, textarea, input, select, label')) return
    drag.current = { id: collab.id, startY: event.clientY, moved: false }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const onDragMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const state = drag.current
    if (!state) return
    const distance = event.clientY - state.startY

    // 살짝 눌린 것과 끄는 것을 가른다 — 클릭이 드래그로 오해받지 않게.
    if (!state.moved) {
      if (Math.abs(distance) < 5) return
      state.moved = true
      setDragId(state.id)
      document.body.style.userSelect = 'none'
    }

    const index = order.findIndex((collab) => collab.id === state.id)
    const direction = distance > 0 ? 1 : -1
    const neighbour = order[index + direction]
    const self = cards.current.get(state.id)
    const other = neighbour ? cards.current.get(neighbour.id) : undefined

    if (self && other) {
      const selfBox = self.getBoundingClientRect()
      const otherBox = other.getBoundingClientRect()
      // 바깥 자리는 그대로 있고 안쪽 카드만 손을 따라 움직이므로, 끈 만큼을 더해 견준다.
      const selfCentre = selfBox.top + selfBox.height / 2 + distance
      const otherCentre = otherBox.top + otherBox.height / 2
      const passed = direction === 1 ? selfCentre > otherCentre : selfCentre < otherCentre
      if (passed) {
        const next = [...order]
        ;[next[index], next[index + direction]] = [next[index + direction], next[index]]
        setOrder(next)
        // 카드가 한 칸 옮겨간 만큼 기준점도 옮겨야 손과 카드가 계속 붙어 있다. (8px은 카드 사이 간격)
        state.startY += (otherBox.height + 8) * direction
        setOffset(event.clientY - state.startY)
        return
      }
    }

    setOffset(distance)
  }

  const endDrag = () => {
    const state = drag.current
    drag.current = null
    document.body.style.userSelect = ''
    setDragId(null)
    setOffset(0)
    if (state?.moved) onReorder(order.map((collab) => collab.id))
  }

  return (
    <div className="space-y-2">
      {order.length === 0 && (
        <p className="px-2 py-6 text-center text-xs text-slate-400">비어 있음</p>
      )}
      {order.map((collab) => {
        const influencer = influencerOf(collab.influencerId)
        const waiting = daysSince(collab.stageEnteredAt)
        const isStale = waiting >= STALE_DAYS && stage !== LAST_STAGE
        return (
          <div key={collab.id} ref={registerCard(collab.id)}>
            <div
              onPointerDown={(event) => startDrag(collab, event)}
              onPointerMove={onDragMove}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              style={{
                transform: dragId === collab.id ? `translateY(${offset}px)` : undefined,
                position: dragId === collab.id ? 'relative' : undefined,
                zIndex: dragId === collab.id ? 10 : undefined,
              }}
              className={clsx(
                'cursor-grab',
                dragId === collab.id && 'cursor-grabbing opacity-90 shadow-lg',
              )}
            >
              <Card className="p-3">
                {/* 링크는 글자만큼만 차지한다 — 옆 빈 곳은 카드를 끄는 데 쓴다 */}
                <div>
                  <Link
                    to={`/influencers/${collab.influencerId}`}
                    className="inline-block text-sm font-medium text-slate-900 hover:text-violet-600"
                  >
                    {influencer?.name ?? '삭제된 크리에이터'}
                  </Link>
                </div>

                {influencer?.snsHandle &&
                  (() => {
                    const url = profileUrl(
                      influencer.snsPlatform,
                      influencer.snsHandle,
                      influencer.snsUrl,
                    )
                    const handle = `@${influencer.snsHandle}`
                    return url ? (
                      <div className="mt-0.5">
                        <a
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          title={`${url} 새 창으로 열기`}
                          className="inline-block text-[11px] text-slate-400 hover:text-violet-600 hover:underline"
                        >
                          {handle}
                        </a>
                      </div>
                    ) : (
                      <p className="mt-0.5 text-[11px] text-slate-400">{handle}</p>
                    )
                  })()}

                {influencer?.doNotContact && (
                  <div className="mt-1.5">
                    <DncBadge compact />
                  </div>
                )}

                <StageActions
                  collab={collab}
                  stage={stage}
                  onCompleteMarket={() => onCompleteMarket(collab)}
                />

                <CardMemo collab={collab} />

                <div className="mt-2 space-y-0.5 text-[11px] text-slate-400">
                  <p className={clsx(isStale && 'font-semibold text-amber-600')}>
                    {`${waiting}일째 ${stage}`}
                    {isStale && ' ⚠️'}
                  </p>
                </div>

                <div className="mt-2.5 flex items-center gap-0.5 whitespace-nowrap">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="px-1.5"
                    title="이전 단계로"
                    onClick={() => onMoveStage(collab, -1)}
                    disabled={stage === FIRST_STAGE}
                  >
                    ←
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="px-1.5"
                    title="다음 단계로"
                    onClick={() => onMoveStage(collab, 1)}
                    disabled={stage === LAST_STAGE}
                  >
                    →
                  </Button>
                  <span className="flex-1" />
                  <Button
                    size="sm"
                    variant="ghost"
                    className="px-1.5 text-rose-500 hover:bg-rose-50"
                    onClick={() => onCancel(collab)}
                  >
                    취소
                  </Button>
                </div>
              </Card>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function PipelinePage() {
  const { data: collabs, isLoading } = useCollabs()
  const { data: influencers = [] } = useInfluencers()
  const moveStage = useMoveCollabStage()
  const reorder = useReorderCollabs()

  const [formOpen, setFormOpen] = useState(false)
  const [cancelTarget, setCancelTarget] = useState<Collab | null>(null)
  const [marketTarget, setMarketTarget] = useState<Collab | null>(null)

  const influencerOf = (id: string) => influencers.find((i) => i.id === id)

  const openNew = () => setFormOpen(true)

  const move = (collab: Collab, direction: -1 | 1) => {
    const index = COLLAB_STAGES.indexOf(collab.stage)
    const next = COLLAB_STAGES[index + direction]
    if (next) moveStage.mutate({ id: collab.id, stage: next as CollabStage })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">협업 파이프라인</h1>
          <p className="mt-1 text-sm text-slate-500">
            단계별 진행 상황과 오래 멈춰 있는 건을 확인하세요. ({STALE_DAYS}일 이상 대기 시 경고)
          </p>
        </div>
        <Button onClick={openNew} disabled={influencers.length === 0}>
          + 크리에이터 추가
        </Button>
      </div>

      {isLoading ? (
        <Spinner />
      ) : influencers.length === 0 ? (
        <Card>
          <EmptyState
            title="먼저 인플루언서를 등록해주세요"
            description="파이프라인 카드는 등록된 크리에이터 한 명에 해당합니다."
          />
        </Card>
      ) : (
        <div className="flex snap-x gap-3 overflow-x-auto pb-2">
          {COLLAB_STAGES.map((stage) => {
            // 거절한 건은 '거절 명단'으로 빠지므로 보드에는 진행 중인 것만 남는다.
            const items = (collabs ?? [])
              .filter((collab) => collab.stage === stage && !collab.isCancelled)
              .sort((a, b) => a.sortOrder - b.sortOrder)
            return (
              <div key={stage} className="w-64 shrink-0 snap-start rounded-xl bg-slate-200/60 p-2">
                <div className="flex items-center justify-between px-2 py-1.5">
                  <span className="text-sm font-semibold text-slate-700">{stage}</span>
                  <span className="text-xs text-slate-500">{items.length}</span>
                </div>

                <StageCards
                  items={items}
                  stage={stage}
                  influencerOf={influencerOf}
                  onMoveStage={move}
                  onReorder={reorder.mutate}
                  onCancel={setCancelTarget}
                  onCompleteMarket={setMarketTarget}
                />
              </div>
            )
          })}
        </div>
      )}

      <CollabFormDialog open={formOpen} onClose={() => setFormOpen(false)} />
      <CancelCollabDialog
        collab={cancelTarget}
        open={cancelTarget !== null}
        onClose={() => setCancelTarget(null)}
      />
      <MarketResultDialog
        collab={marketTarget}
        open={marketTarget !== null}
        onClose={() => setMarketTarget(null)}
      />
    </div>
  )
}
