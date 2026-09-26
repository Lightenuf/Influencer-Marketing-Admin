import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Button, Input, Modal, Spinner } from '@/components/ui'
import { repository } from '@/data'
import { OPTION_KINDS, OPTION_KIND_LABELS, type OptionKind } from '@/data/types'

/**
 * 목적·컨셉·오퍼 선택지 관리.
 *
 * 미리 정해 둔 것만 쓰게 하면 새 컨셉이 생길 때마다 개발자를 불러야 한다.
 * 대신 아무렇게나 적게 두면 같은 말을 다르게 적어 비교가 안 되므로, 목록으로 둔다.
 */
export default function CampaignOptionsDialog({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const client = useQueryClient()
  const [adding, setAdding] = useState<Record<string, string>>({})

  const options = useQuery({
    queryKey: ['campaignOptions'],
    queryFn: () => repository.listCampaignOptions(),
    enabled: open,
  })

  const refresh = () => client.invalidateQueries({ queryKey: ['campaignOptions'] })

  const add = useMutation({
    mutationFn: ({ kind, label }: { kind: OptionKind; label: string }) =>
      repository.addCampaignOption(kind, label),
    onSuccess: refresh,
  })

  const remove = useMutation({
    mutationFn: (id: string) => repository.removeCampaignOption(id),
    onSuccess: refresh,
  })

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="목적·컨셉 설정"
      description="캠페인을 분류하는 말을 여기서 늘리고 줄입니다"
      width="max-w-lg"
    >
      {options.isLoading ? (
        <Spinner />
      ) : (
        <div className="space-y-5">
          {OPTION_KINDS.map((kind) => {
            const rows = (options.data ?? []).filter((o) => o.kind === kind)
            const draft = adding[kind] ?? ''
            const submit = () => {
              if (!draft.trim()) return
              add.mutate({ kind, label: draft.trim() })
              setAdding((prev) => ({ ...prev, [kind]: '' }))
            }
            return (
              <div key={kind}>
                <p className="text-sm font-medium text-slate-700">{OPTION_KIND_LABELS[kind]}</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {rows.map((option) => (
                    <span
                      key={option.id}
                      className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 py-1 pr-1.5 pl-3 text-xs text-slate-700"
                    >
                      {option.label}
                      <button
                        type="button"
                        onClick={() => remove.mutate(option.id)}
                        className="rounded-full px-1 text-slate-400 hover:bg-rose-100 hover:text-rose-600"
                        aria-label={`${option.label} 지우기`}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                  {rows.length === 0 && (
                    <span className="text-xs text-slate-400">아직 없습니다</span>
                  )}
                </div>
                <div className="mt-2 flex gap-2">
                  <Input
                    value={draft}
                    onChange={(e) => setAdding((prev) => ({ ...prev, [kind]: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.nativeEvent.isComposing) return
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        submit()
                      }
                    }}
                    placeholder={`새 ${OPTION_KIND_LABELS[kind]} 추가`}
                    className="text-sm"
                  />
                  <Button size="sm" variant="secondary" onClick={submit}>
                    추가
                  </Button>
                </div>
              </div>
            )
          })}

          <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-500">
            여기서 지워도 이미 그 말이 붙은 캠페인은 그대로 남습니다. 앞으로 고를 수 없게 될
            뿐입니다.
          </p>
        </div>
      )}

      <div className="mt-5 flex justify-end">
        <Button onClick={onClose}>닫기</Button>
      </div>
    </Modal>
  )
}
