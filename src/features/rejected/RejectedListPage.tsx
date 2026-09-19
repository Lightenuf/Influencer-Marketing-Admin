import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, Card, CardHeader, EmptyState, Input, Spinner } from '@/components/ui'
import type { Influencer } from '@/data/types'
import DncChangeDialog from '@/features/dnc/DncChangeDialog'
import { useCollabs, useInfluencers, useSetCancelDate, useTeamMembers } from '@/hooks/queries'
import { downloadCsv } from '@/utils/csv'
import { profileUrl } from '@/utils/profileLink'
import { formatDateTime, formatNumber } from '@/utils/format'

const normalize = (value: string) => value.trim().toLowerCase().replace(/^@/, '')

/** 아이디를 누르면 새 창으로 해당 SNS 프로필을 연다. */
function ProfileHandle({ influencer }: { influencer: Influencer }) {
  const url = profileUrl(influencer.snsPlatform, influencer.snsHandle, influencer.snsUrl)
  if (!url) return <>@{influencer.snsHandle}</>
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      title={`${url} 새 창으로 열기`}
      className="hover:text-violet-600 hover:underline"
    >
      @{influencer.snsHandle}
    </a>
  )
}

export default function RejectedListPage() {
  const { data: collabs, isLoading } = useCollabs()
  const { data: influencers = [] } = useInfluencers()
  const { data: members = [] } = useTeamMembers()
  const setCancelDate = useSetCancelDate()

  const [dncTarget, setDncTarget] = useState<{ influencer: Influencer; reasons?: string[] } | null>(
    null,
  )
  const [keyword, setKeyword] = useState('')

  const blocked = useMemo(
    () => influencers.filter((influencer) => influencer.doNotContact),
    [influencers],
  )

  // 연락 금지로 등록한 분은 아래 영역에서 관리하므로 위 목록에서는 뺀다.
  // 금지를 풀면 자동으로 다시 올라온다.
  const rejected = (collabs ?? [])
    .filter((collab) => collab.isCancelled)
    .filter((collab) => !influencers.find((i) => i.id === collab.influencerId)?.doNotContact)
    .sort((a, b) => (b.cancelledAt ?? '').localeCompare(a.cancelledAt ?? ''))

  const filteredBlocked = useMemo(() => {
    const query = normalize(keyword)
    if (!query) return blocked
    return blocked.filter((influencer) =>
      `${influencer.name} ${influencer.snsHandle}`.toLowerCase().includes(query),
    )
  }, [blocked, keyword])

  const nameOf = (userId: string | null) =>
    members.find((m) => m.id === userId)?.displayName ?? '알 수 없음'

  const exportCsv = () =>
    downloadCsv(
      '연락금지_목록',
      filteredBlocked.map((influencer) => ({
        이름: influencer.name,
        계정: influencer.snsHandle,
        사유: influencer.dncReason ?? '',
        등록자: nameOf(influencer.dncSetBy),
        등록일시: formatDateTime(influencer.dncSetAt),
      })),
    )

  if (isLoading) return <Spinner />

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900">거절 명단</h1>
        <p className="mt-1 text-sm text-slate-500">
          거절 의사를 밝혀 협업이 무산된 분들입니다. {formatNumber(rejected.length)}건 · 연락 금지로
          등록한{' '}
          <span className="font-medium text-rose-600">{formatNumber(blocked.length)}명</span>은 아래
          영역에서 관리합니다.
        </p>
      </div>

      {rejected.length === 0 ? (
        <Card>
          <EmptyState
            title={blocked.length > 0 ? '연락 금지 대상만 남았습니다' : '거절된 건이 없습니다'}
            description={
              blocked.length > 0
                ? '거절한 분들이 모두 연락 금지로 등록되어 아래 영역에서 관리되고 있습니다.'
                : "파이프라인 카드의 '취소 → 거절'을 누르면 여기로 옮겨집니다."
            }
          />
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {rejected.map((collab) => {
            const influencer = influencers.find((i) => i.id === collab.influencerId)
            return (
              <Card key={collab.id} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link
                      to={`/influencers/${collab.influencerId}`}
                      className="block truncate text-sm font-medium text-slate-900 hover:text-violet-600"
                    >
                      {influencer?.name ?? '삭제된 크리에이터'}
                    </Link>
                    {influencer && (
                      <p className="truncate text-xs text-slate-400">
                        <ProfileHandle influencer={influencer} /> · 팔로워{' '}
                        {formatNumber(influencer.followerCount)}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-wrap justify-end gap-1">
                    {collab.cancelReasons.map((reason) => (
                      <span
                        key={reason}
                        className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-700"
                      >
                        {reason}
                      </span>
                    ))}
                  </div>
                </div>

                {collab.cancelReasonDetail && (
                  <p className="mt-2 rounded-lg bg-slate-50 px-2.5 py-2 text-xs leading-relaxed text-slate-600">
                    {collab.cancelReasonDetail}
                  </p>
                )}

                <div className="mt-3 flex items-center gap-2 text-[11px] text-slate-400">
                  <label className="flex items-center gap-1">
                    거절일
                    <input
                      type="date"
                      value={collab.cancelledAt?.slice(0, 10) ?? ''}
                      max={new Date().toISOString().slice(0, 10)}
                      onChange={(e) =>
                        e.target.value && setCancelDate.mutate({ id: collab.id, date: e.target.value })
                      }
                      title="어드민을 만들기 전에 있었던 거절이면 실제 날짜로 고쳐주세요"
                      className="rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[11px] text-slate-600 focus:border-violet-400 focus:outline-none"
                    />
                  </label>
                  <span>· {collab.stage} 단계에서</span>
                </div>

                {influencer && (
                  <div className="mt-3">
                    <Button
                      size="sm"
                      variant="secondary"
                      className="w-full"
                      onClick={() =>
                        setDncTarget({ influencer, reasons: collab.cancelReasons })
                      }
                    >
                      연락 금지 등록
                    </Button>
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}

      {/* ── 연락 금지 ─────────────────────────────── */}
      <div className="flex items-end justify-between gap-4 border-t border-slate-200 pt-6">
        <div>
          <h2 className="text-lg font-bold text-slate-900">연락 금지</h2>
          <p className="mt-1 text-sm text-slate-500">
            거절 여부와 별개로, 앞으로 제안을 보내면 안 되는 분들입니다.
          </p>
        </div>
        <Button variant="secondary" onClick={exportCsv} disabled={filteredBlocked.length === 0}>
          엑셀 다운로드
        </Button>
      </div>

      <Card>
        <CardHeader
          title={`연락 금지 목록 (${blocked.length}명)`}
          action={
            <div className="w-48">
              <Input
                placeholder="이름 · 계정 검색"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
              />
            </div>
          }
        />
        {filteredBlocked.length === 0 ? (
          <EmptyState
            title={blocked.length === 0 ? '연락 금지 대상이 없습니다' : '검색 결과가 없습니다'}
            description={
              blocked.length === 0
                ? '위 거절 카드나 인플루언서 상세에서 "연락 금지 등록"을 누르면 이곳에 모입니다.'
                : undefined
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-y border-slate-100 bg-slate-50 text-xs text-slate-500">
                <tr>
                  <th className="px-5 py-2.5 text-left font-medium">이름 / 계정</th>
                  <th className="px-3 py-2.5 text-left font-medium">사유</th>
                  <th className="px-3 py-2.5 text-left font-medium">등록자</th>
                  <th className="px-3 py-2.5 text-left font-medium">등록일시</th>
                  <th className="px-5 py-2.5 text-right font-medium">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredBlocked.map((influencer) => (
                  <tr key={influencer.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3">
                      <Link
                        to={`/influencers/${influencer.id}`}
                        className="font-medium text-slate-900 hover:text-violet-600"
                      >
                        {influencer.name}
                      </Link>
                      <div className="text-xs text-slate-400">
                        <ProfileHandle influencer={influencer} />
                      </div>
                    </td>
                    <td className="px-3 py-3 text-slate-700">{influencer.dncReason}</td>
                    <td className="px-3 py-3 text-slate-600">{nameOf(influencer.dncSetBy)}</td>
                    <td className="px-3 py-3 text-slate-500">
                      {formatDateTime(influencer.dncSetAt)}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setDncTarget({ influencer })}
                      >
                        해제
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <DncChangeDialog
        influencer={dncTarget?.influencer ?? null}
        presetReasons={dncTarget?.reasons}
        open={dncTarget !== null}
        onClose={() => setDncTarget(null)}
      />
    </div>
  )
}
