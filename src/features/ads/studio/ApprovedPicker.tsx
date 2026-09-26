import { useEffect, useState } from 'react'
import { Button, EmptyState, Modal, Spinner } from '@/components/ui'
import { studioRepository } from '@/data/studioRepository'
import { assignTails, nameFor } from './importNaming'
import { useQuery } from '@tanstack/react-query'

/**
 * 조합·검수에서 승인한 소재를 업로드 탭으로 가져온다.
 *
 * 승인할 때 1080px PNG를 만들어 보관함에 넣어 두었다. 그것을 내려받아
 * 컴퓨터에서 고른 파일과 똑같이 다룬다 — 업로드 흐름은 건드리지 않는다.
 */

function Thumb({ path }: { path: string }) {
  const [url, setUrl] = useState('')
  useEffect(() => {
    let alive = true
    if (!path) return
    studioRepository
      .assetUrl(path)
      .then((value) => alive && setUrl(value))
      .catch(() => alive && setUrl(''))
    return () => {
      alive = false
    }
  }, [path])
  return url ? (
    <img src={url} alt="" className="h-full w-full object-cover" />
  ) : (
    <div className="h-full w-full bg-slate-100" />
  )
}

export default function ApprovedPicker({
  open,
  onClose,
  onPick,
}: {
  open: boolean
  onClose: () => void
  /** 가져온 파일과, 그 파일이 나온 조합의 id */
  onPick: (picked: { file: File; draftId: string }[]) => void
}) {
  const drafts = useQuery({
    queryKey: ['studio', 'drafts'],
    queryFn: () => studioRepository.listDrafts(),
    enabled: open,
  })
  const copies = useQuery({
    queryKey: ['studio', 'copies'],
    queryFn: () => studioRepository.listCopies(),
    enabled: open,
  })

  const [chosen, setChosen] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const toggle = (id: string) =>
    setChosen((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const ready = (drafts.data ?? []).filter(
    (draft) => draft.status === 'approved' && draft.renderedPath,
  )

  const take = async () => {
    setLoading(true)
    setError('')
    try {
      const taking = ready.filter((draft) => chosen.has(draft.id))
      const tails = assignTails(taking)
      const picked: { file: File; draftId: string }[] = []

      for (const draft of taking) {
        const copy = (copies.data ?? []).find((row) => row.id === draft.copyId)
        if (!copy) continue

        const name = nameFor(copy, tails.get(draft.id)!)

        const url = await studioRepository.assetUrl(draft.renderedPath)
        const blob = await (await fetch(url)).blob()
        picked.push({
          file: new File([blob], `${name}.png`, { type: 'image/png' }),
          draftId: draft.id,
        })
      }

      onPick(picked)
      setChosen(new Set())
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : '가져오지 못했습니다')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="승인한 소재에서 가져오기"
      description="조합·검수에서 승인한 것만 보입니다. 비율만 다른 것은 한 광고로 묶입니다."
      width="max-w-3xl"
    >
      {drafts.isLoading || copies.isLoading ? (
        <Spinner />
      ) : ready.length === 0 ? (
        <EmptyState
          title="승인한 소재가 없습니다"
          description="조합·검수 탭에서 '승인하고 이미지 만들기'를 먼저 눌러주세요."
        />
      ) : (
        <div className="space-y-4">
          <div className="grid max-h-[50vh] gap-3 overflow-y-auto sm:grid-cols-3 lg:grid-cols-4">
            {ready.map((draft) => {
              const copy = (copies.data ?? []).find((row) => row.id === draft.copyId)
              const used = Boolean(draft.uploadedAdId)
              const on = chosen.has(draft.id)
              return (
                <button
                  key={draft.id}
                  type="button"
                  onClick={() => toggle(draft.id)}
                  className={`overflow-hidden rounded-xl border text-left ${
                    on ? 'border-violet-500 ring-2 ring-violet-200' : 'border-slate-200'
                  }`}
                >
                  <div className="aspect-square overflow-hidden bg-slate-50">
                    <Thumb path={draft.renderedPath} />
                  </div>
                  <div className="p-2">
                    <p className="truncate text-xs text-slate-700" title={copy?.headline}>
                      {copy?.headline ?? '(카피 없음)'}
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-400">
                      {draft.ratio}
                      {copy?.angle ? ` · ${copy.angle}` : ''}
                    </p>
                    {used && (
                      <span className="mt-1 inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">
                        이미 올림
                      </span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>

          {error && <p className="text-sm text-rose-600">{error}</p>}

          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-slate-500">
              {chosen.size}개 골랐습니다. 광고 이름은 카피의 앵글·훅으로 지어집니다.
            </p>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={onClose} disabled={loading}>
                닫기
              </Button>
              <Button onClick={take} disabled={chosen.size === 0 || loading}>
                {loading ? '가져오는 중...' : '가져오기'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  )
}
