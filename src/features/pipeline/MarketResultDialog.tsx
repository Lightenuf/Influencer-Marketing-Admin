import { useEffect, useState } from 'react'
import { Button, Field, Input, Modal } from '@/components/ui'
import type { Collab } from '@/data/types'
import { useInfluencers, useMoveCollabStage, useUpdateCollab } from '@/hooks/queries'
import { formatNumber, toDateInputValue } from '@/utils/format'

/**
 * 마켓이 끝난 뒤 성과를 남기는 창.
 * 여기서 남긴 값이 '마켓 관리' 화면에 쌓여 다음 시딩 대상을 고르는 근거가 된다.
 */
export default function MarketResultDialog({
  collab,
  open,
  onClose,
}: {
  collab: Collab | null
  open: boolean
  onClose: () => void
}) {
  const { data: influencers = [] } = useInfluencers()
  const update = useUpdateCollab()
  const moveStage = useMoveCollabStage()

  const [marketDate, setMarketDate] = useState('')
  const [revenue, setRevenue] = useState('')
  const [units, setUnits] = useState('')
  const [settled, setSettled] = useState(false)
  const [settlement, setSettlement] = useState('')
  const [links, setLinks] = useState<string[]>([])
  const [linkDraft, setLinkDraft] = useState('')

  useEffect(() => {
    if (!collab) return
    setMarketDate(toDateInputValue(collab.marketDate) || new Date().toISOString().slice(0, 10))
    setRevenue(collab.marketRevenue ? String(collab.marketRevenue) : '')
    setUnits(collab.marketUnits ? String(collab.marketUnits) : '')
    setSettled(collab.isSettled)
    setSettlement(collab.settlementAmount ? String(collab.settlementAmount) : '')
    setLinks(collab.contentLinks)
    setLinkDraft('')
  }, [collab, open])

  if (!collab) return null

  const influencer = influencers.find((i) => i.id === collab.influencerId)
  const alreadyDone = collab.stage === '마켓 완료'

  const addLink = () => {
    const url = linkDraft.trim()
    if (!url || links.includes(url)) return
    setLinks([...links, url])
    setLinkDraft('')
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    // 입력칸에 쓰다 만 링크가 있으면 같이 담는다.
    const pending = linkDraft.trim()
    const allLinks = pending && !links.includes(pending) ? [...links, pending] : links

    await update.mutateAsync({
      id: collab.id,
      patch: {
        marketDate: marketDate || null,
        marketRevenue: Number(revenue.replace(/,/g, '')) || 0,
        marketUnits: Number(units.replace(/,/g, '')) || 0,
        isSettled: settled,
        settlementAmount: Number(settlement.replace(/,/g, '')) || 0,
        contentLinks: allLinks,
      },
    })
    if (!alreadyDone) await moveStage.mutateAsync({ id: collab.id, stage: '마켓 완료' })
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={alreadyDone ? '마켓 관리 수정' : '마켓 완료 처리'}
      description={
        <>
          <b className="text-slate-700">{influencer?.name}</b>
          {influencer?.snsHandle && (
            <span className="text-slate-400"> @{influencer.snsHandle}</span>
          )}
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="마켓 진행일">
            <Input type="date" value={marketDate} onChange={(e) => setMarketDate(e.target.value)} />
          </Field>
          <Field label="정산">
            <button
              type="button"
              onClick={() => setSettled(!settled)}
              className={
                settled
                  ? 'w-full rounded-lg bg-emerald-100 px-3 py-2 text-sm font-medium text-emerald-700'
                  : 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50'
              }
            >
              {settled ? '✓ 정산 완료' : '정산 전'}
            </button>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field
            label="매출 (원)"
            hint={revenue ? `${formatNumber(Number(revenue) || 0)}원` : undefined}
          >
            <Input
              inputMode="numeric"
              value={revenue}
              onChange={(e) => setRevenue(e.target.value.replace(/[^\d]/g, ''))}
              placeholder="예) 3200000"
              autoFocus
            />
          </Field>
          <Field label="판매 수량">
            <Input
              inputMode="numeric"
              value={units}
              onChange={(e) => setUnits(e.target.value.replace(/[^\d]/g, ''))}
              placeholder="예) 240"
            />
          </Field>
        </div>

        <Field
          label="정산액 (원)"
          hint={
            settlement && revenue
              ? `매출의 ${((Number(settlement) / Math.max(Number(revenue), 1)) * 100).toFixed(1)}% · 남는 금액 ${formatNumber(
                  (Number(revenue) || 0) - (Number(settlement) || 0),
                )}원`
              : '크리에이터에게 준 금액 (수수료 포함)'
          }
        >
          <Input
            inputMode="numeric"
            value={settlement}
            onChange={(e) => setSettlement(e.target.value.replace(/[^\d]/g, ''))}
            placeholder="예) 640000"
          />
        </Field>

        <Field
          label="콘텐츠 링크"
          hint="잘 터진 릴스·피드 주소를 남겨두면 다음 협업 때 참고할 수 있습니다"
        >
          <div className="flex gap-2">
            <Input
              value={linkDraft}
              onChange={(e) => setLinkDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addLink()
                }
              }}
              placeholder="https://www.instagram.com/reel/..."
            />
            <Button
              type="button"
              variant="secondary"
              onClick={addLink}
              disabled={!linkDraft.trim()}
            >
              추가
            </Button>
          </div>
        </Field>

        {links.length > 0 && (
          <ul className="space-y-1">
            {links.map((url) => (
              <li
                key={url}
                className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2"
              >
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="truncate text-xs text-violet-600 hover:underline"
                >
                  {url}
                </a>
                <button
                  type="button"
                  onClick={() => setLinks(links.filter((item) => item !== url))}
                  className="shrink-0 text-xs text-slate-400 hover:text-rose-500"
                >
                  삭제
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            취소
          </Button>
          <Button type="submit" disabled={update.isPending || moveStage.isPending}>
            {alreadyDone ? '저장' : '마켓 완료'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
