import { useState } from 'react'
import { useCurrentUser } from '@/auth/AuthProvider'
import { useCreateReasonTag, useDeleteReasonTag, useReasonTags } from '@/hooks/queries'

/**
 * 사유 태그를 고르고, 없으면 그 자리에서 만드는 입력칸.
 * 태그 목록은 팀 전체가 공유하므로, 여기서 만든 태그는 다른 팀원에게도 보인다.
 */
export default function TagPicker({
  selected,
  onChange,
  placeholder = '사유를 고르거나 새로 입력하세요',
}: {
  selected: string[]
  onChange: (next: string[]) => void
  placeholder?: string
}) {
  const user = useCurrentUser()
  const { data: tags = [], isError: listFailed, error: listError } = useReasonTags()
  const createTag = useCreateReasonTag(user.id)
  const deleteTag = useDeleteReasonTag()
  const [query, setQuery] = useState('')

  const failure = listFailed ? listError : (createTag.error ?? deleteTag.error)

  const keyword = query.trim()
  const candidates = tags.filter(
    (tag) =>
      !selected.includes(tag.label) && tag.label.toLowerCase().includes(keyword.toLowerCase()),
  )
  const canCreate =
    keyword !== '' && !tags.some((tag) => tag.label.toLowerCase() === keyword.toLowerCase())

  const add = (label: string) => {
    if (!selected.includes(label)) onChange([...selected, label])
    setQuery('')
  }

  const create = () => {
    const label = keyword
    if (!label) return
    createTag.mutate(label, { onSuccess: () => add(label) })
  }

  return (
    <div className="rounded-lg border border-slate-300 bg-white p-2 focus-within:border-violet-500 focus-within:ring-2 focus-within:ring-violet-100">
      <div className="flex flex-wrap items-center gap-1.5">
        {selected.map((label) => (
          <span
            key={label}
            className="inline-flex items-center gap-1 rounded-md bg-violet-100 px-2 py-1 text-xs font-medium text-violet-700"
          >
            {label}
            <button
              type="button"
              aria-label={`${label} 빼기`}
              onClick={() => onChange(selected.filter((item) => item !== label))}
              className="text-violet-400 hover:text-violet-700"
            >
              ×
            </button>
          </span>
        ))}
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            // 한글 조합 중 Enter는 글자를 확정하는 신호라 태그로 만들지 않는다.
            if (e.nativeEvent.isComposing) return
            if (e.key === 'Enter') {
              e.preventDefault()
              if (candidates.length > 0) add(candidates[0].label)
              else if (canCreate) create()
            }
            if (e.key === 'Backspace' && query === '' && selected.length > 0) {
              onChange(selected.slice(0, -1))
            }
          }}
          placeholder={selected.length === 0 ? placeholder : ''}
          className="min-w-32 flex-1 bg-transparent px-1 py-1 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
        />
      </div>

      <div className="mt-2 max-h-40 space-y-0.5 overflow-y-auto border-t border-slate-100 pt-2">
        {canCreate && (
          <button
            type="button"
            onClick={create}
            disabled={createTag.isPending}
            className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-sm text-violet-700 hover:bg-violet-50 disabled:opacity-50"
          >
            + <b>{keyword}</b> 만들기
          </button>
        )}

        {candidates.map((tag) => (
          <div key={tag.id} className="group flex items-center gap-1">
            <button
              type="button"
              onClick={() => add(tag.label)}
              className="flex-1 rounded-md px-2 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-50"
            >
              {tag.label}
            </button>
            <button
              type="button"
              title="이 사유를 목록에서 지웁니다 (이미 기록된 건은 그대로 남습니다)"
              onClick={() => {
                if (confirm(`'${tag.label}' 사유를 목록에서 지울까요?`)) deleteTag.mutate(tag.id)
              }}
              className="px-1.5 text-xs text-slate-300 opacity-0 transition group-hover:opacity-100 hover:text-rose-500"
            >
              삭제
            </button>
          </div>
        ))}

        {candidates.length === 0 && !canCreate && (
          <p className="px-2 py-1.5 text-xs text-slate-400">
            {tags.length === selected.length
              ? '모든 사유를 골랐습니다.'
              : '일치하는 사유가 없습니다.'}
          </p>
        )}
      </div>

      {failure && (
        <p className="mt-1.5 rounded-md bg-rose-50 px-2 py-1.5 text-xs leading-relaxed text-rose-700">
          사유 태그를 불러오거나 저장하지 못했습니다. 데이터베이스에 사유 태그 표(reason_tags)가
          아직 없을 수 있습니다 — 관리자에게 0009 설정을 실행했는지 확인해주세요.
          <span className="mt-0.5 block text-[11px] text-rose-500">{failure.message}</span>
        </p>
      )}
    </div>
  )
}
