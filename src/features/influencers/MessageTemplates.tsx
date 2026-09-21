import { useEffect, useState } from 'react'
import { useCurrentUser } from '@/auth/AuthProvider'
import { Button, Card, Textarea } from '@/components/ui'
import {
  useCreateMessageTemplate,
  useDeleteMessageTemplate,
  useMessageTemplates,
  useSaveMessageTemplate,
} from '@/hooks/queries'
import { formatDateTime } from '@/utils/format'

/**
 * 시딩 메시지처럼 자주 바뀌는 문구를 어드민에서 직접 고친다.
 * 각자 메모장에 들고 있으면 누구 것이 최신인지 알 수 없어, 팀이 같은 문구를 본다.
 */
export default function MessageTemplates() {
  const user = useCurrentUser()
  const { data: templates = [] } = useMessageTemplates()
  const save = useSaveMessageTemplate(user.id)
  const create = useCreateMessageTemplate(user.id)
  const remove = useDeleteMessageTemplate()

  const [open, setOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [copied, setCopied] = useState(false)

  const selected = templates.find((t) => t.id === selectedId) ?? templates[0] ?? null

  // 고르는 문구가 바뀌면 편집칸을 그 내용으로 맞춘다.
  useEffect(() => {
    if (selected) setDraft(selected.body)
  }, [selected?.id, selected?.updatedAt])

  const dirty = selected ? draft !== selected.body : false

  const copy = async () => {
    if (!selected) return
    await navigator.clipboard.writeText(draft)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Card className="mb-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-5 py-3 text-left"
      >
        <span className="text-sm font-semibold text-slate-900">시딩 메시지</span>
        {selected && (
          <span className="text-xs text-slate-400">
            마지막 수정 {formatDateTime(selected.updatedAt)}
          </span>
        )}
        <span className="flex-1" />
        <span className="text-xs text-slate-400">{open ? '접기 ▴' : '펼치기 ▾'}</span>
      </button>

      {open && (
        <div className="border-t border-slate-100 p-5">
          {templates.length > 1 && (
            <div className="mb-3 flex flex-wrap gap-1.5">
              {templates.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => setSelectedId(template.id)}
                  className={
                    template.id === selected?.id
                      ? 'rounded-full bg-violet-100 px-3 py-1 text-xs font-medium text-violet-700'
                      : 'rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600 hover:bg-slate-200'
                  }
                >
                  {template.name}
                </button>
              ))}
            </div>
          )}

          {selected ? (
            <>
              <Textarea
                rows={16}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                className="font-normal"
              />

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  disabled={!dirty || save.isPending}
                  onClick={() => save.mutate({ id: selected.id, patch: { body: draft } })}
                >
                  {dirty ? '저장' : '저장됨'}
                </Button>
                <Button size="sm" variant="secondary" onClick={copy}>
                  {copied ? '✓ 복사함' : '문구 복사'}
                </Button>
                {dirty && (
                  <Button size="sm" variant="ghost" onClick={() => setDraft(selected.body)}>
                    되돌리기
                  </Button>
                )}
                <span className="flex-1" />
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    const name = window.prompt('새 문구 이름 (예: 재연락용)')
                    if (name?.trim()) create.mutate(name.trim())
                  }}
                >
                  + 문구 추가
                </Button>
                {templates.length > 1 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-rose-500 hover:bg-rose-50"
                    onClick={() => {
                      if (window.confirm(`'${selected.name}' 문구를 지울까요?`)) {
                        remove.mutate(selected.id)
                        setSelectedId(null)
                      }
                    }}
                  >
                    삭제
                  </Button>
                )}
              </div>

              <p className="mt-2 text-xs text-slate-400">
                고치면 대표님 화면에도 같이 바뀝니다. 발송할 때는 `문구 복사`를 누르고 인스타
                DM 창에 붙여넣으세요.
              </p>
            </>
          ) : (
            <div className="py-6 text-center">
              <p className="text-sm text-slate-500">등록된 문구가 없습니다.</p>
              <Button
                size="sm"
                className="mt-3"
                onClick={() => create.mutate('시딩 첫 연락')}
              >
                시딩 문구 만들기
              </Button>
            </div>
          )}
        </div>
      )}
    </Card>
  )
}
