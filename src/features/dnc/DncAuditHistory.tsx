import { useDncAudit, useTeamMembers } from '@/hooks/queries'
import { formatDateTime } from '@/utils/format'

export default function DncAuditHistory({ influencerId }: { influencerId: string }) {
  const { data: entries = [] } = useDncAudit(influencerId)
  const { data: members = [] } = useTeamMembers()

  const nameOf = (id: string) => members.find((m) => m.id === id)?.displayName ?? '알 수 없음'

  if (entries.length === 0) {
    return <p className="text-sm text-slate-400">연락 금지 관련 이력이 없습니다.</p>
  }

  return (
    <ol className="space-y-3">
      {entries.map((entry) => (
        <li key={entry.id} className="flex gap-3 text-sm">
          <span
            className={
              entry.action === 'set'
                ? 'mt-1.5 h-2 w-2 shrink-0 rounded-full bg-rose-500'
                : 'mt-1.5 h-2 w-2 shrink-0 rounded-full bg-emerald-500'
            }
          />
          <div className="min-w-0">
            <p className="text-slate-800">
              <b>{entry.action === 'set' ? '연락 금지 등록' : '연락 금지 해제'}</b>
              {entry.reason && (
                <>
                  <span className="mx-1.5 text-slate-300">·</span>
                  {entry.reason}
                </>
              )}
            </p>
            {entry.reasonDetail && (
              <p className="mt-0.5 break-words text-slate-500">{entry.reasonDetail}</p>
            )}
            <p className="mt-0.5 text-xs text-slate-400">
              {nameOf(entry.setBy)} · {formatDateTime(entry.setAt)}
            </p>
          </div>
        </li>
      ))}
    </ol>
  )
}
