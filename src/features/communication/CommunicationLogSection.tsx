import { useState } from 'react'
import { useCurrentUser } from '@/auth/AuthProvider'
import { Button, Textarea } from '@/components/ui'
import { useAddNote, useDeleteNote, useNotes, useTeamMembers } from '@/hooks/queries'
import { formatDateTime } from '@/utils/format'

export default function CommunicationLogSection({ influencerId }: { influencerId: string }) {
  const user = useCurrentUser()
  const { data: notes = [] } = useNotes(influencerId)
  const { data: members = [] } = useTeamMembers()
  const addNote = useAddNote(user.id)
  const deleteNote = useDeleteNote(influencerId)
  const [draft, setDraft] = useState('')

  const nameOf = (id: string) => members.find((m) => m.id === id)?.displayName ?? '알 수 없음'

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const note = draft.trim()
    if (!note) return
    addNote.mutate({ influencerId, note }, { onSuccess: () => setDraft('') })
  }

  return (
    <div className="space-y-4">
      <form onSubmit={submit} className="space-y-2">
        <Textarea
          rows={2}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="DM 회신 내용, 통화 결과, 협의 사항 등을 남겨주세요."
        />
        <div className="flex justify-end">
          <Button type="submit" size="sm" disabled={!draft.trim() || addNote.isPending}>
            기록 추가
          </Button>
        </div>
      </form>

      {notes.length === 0 ? (
        <p className="text-sm text-slate-400">아직 기록이 없습니다.</p>
      ) : (
        <ul className="space-y-3">
          {notes.map((note) => (
            <li key={note.id} className="rounded-lg bg-slate-50 px-3 py-2.5 text-sm">
              <p className="whitespace-pre-wrap text-slate-700">{note.note}</p>
              <div className="mt-1 flex items-center justify-between text-xs text-slate-400">
                <span>
                  {nameOf(note.authorId)} · {formatDateTime(note.loggedAt)}
                </span>
                {note.authorId === user.id && (
                  <button
                    className="hover:text-rose-500"
                    onClick={() => deleteNote.mutate(note.id)}
                  >
                    삭제
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
