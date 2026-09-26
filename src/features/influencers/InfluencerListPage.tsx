import clsx from 'clsx'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { DncBadge, StatusBadge } from '@/components/badges'
import { Button, Card, EmptyState, Input, linkButtonClass, Select, Spinner } from '@/components/ui'
import { isMockMode } from '@/data'
import {
  COLLAB_STAGES,
  INFLUENCER_STATUSES,
  SNS_PLATFORM_LABELS,
  type Influencer,
} from '@/data/types'
import DncChangeDialog from '@/features/dnc/DncChangeDialog'
import MessageTemplates from '@/features/influencers/MessageTemplates'
import {
  useCollabs,
  useCreateCollab,
  useDemoData,
  useInfluencers,
  useLogContact,
  useMessageTemplates,
  useUndoContact,
} from '@/hooks/queries'
import { downloadCsv } from '@/utils/csv'
import { formatDate, formatNumber } from '@/utils/format'
import { profileUrl } from '@/utils/profileLink'

type ContactFilter = 'all' | 'contactable' | 'blocked'

/**
 * 대량 등록은 아이디만 넣으므로, 그 뒤에 사람이 채운 흔적이 하나라도 있으면 '입력 완료'로 본다.
 * (팔로워 수·이메일·카테고리 중 하나)
 */
const hasProfile = (influencer: Influencer) =>
  influencer.followerCount > 0 ||
  influencer.contactEmail.trim() !== '' ||
  influencer.categories.length > 0

const today = () => new Date().toISOString().slice(0, 10)

/** 메시지를 보낸 날과 횟수. 버튼 한 번이 한 건이고, 잘못 눌렀으면 바로 되돌린다. */
/** 등록일(YYYY-MM-DD)만 뽑는다. */
const dayOf = (iso: string) => new Date(iso).toLocaleDateString('sv-SE')

/** 오늘·어제는 글자로, 그 전은 날짜로 읽는다. */
function dayLabel(day: string) {
  const today = new Date().toLocaleDateString('sv-SE')
  const yesterday = new Date(Date.now() - 86_400_000).toLocaleDateString('sv-SE')
  if (day === today) return '오늘'
  if (day === yesterday) return '어제'
  return formatDate(day)
}

/**
 * 목록을 등록일별로 묶는다. 목록이 최신순이라 묶음도 최신순으로 나온다.
 * 며칠에 몇 명을 넣었는지 한눈에 보려는 것.
 */
function groupByDay(list: Influencer[]) {
  const groups: { day: string; items: Influencer[] }[] = []
  for (const influencer of list) {
    const day = dayOf(influencer.createdAt)
    const last = groups[groups.length - 1]
    if (last && last.day === day) last.items.push(influencer)
    else groups.push({ day, items: [influencer] })
  }
  return groups
}

/**
 * 클립보드에 그 자리에서 복사한다.
 * navigator.clipboard 는 비동기라, 새 창을 연 뒤에는 화면이 포커스를 잃어 막힌다.
 * 그래서 창을 열기 전에 동기 방식으로 먼저 복사한다.
 */
function copyNow(text: string) {
  try {
    const area = document.createElement('textarea')
    area.value = text
    area.style.position = 'fixed'
    area.style.top = '-1000px'
    document.body.appendChild(area)
    area.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(area)
    return ok
  } catch {
    return false
  }
}

function ContactLog({ influencer }: { influencer: Influencer }) {
  const log = useLogContact()
  const undo = useUndoContact()
  const { data: templates = [] } = useMessageTemplates()
  const dates = influencer.contactedDates
  const last = dates[dates.length - 1]
  const [copied, setCopied] = useState(false)

  /**
   * 인스타 DM 창을 열고, 시딩 문구를 클립보드에 넣고, 보낸 것으로 기록한다.
   * 인스타는 밖에서 메시지를 대신 보낼 수 없어, 창까지만 열어주고 전송은 사람이 한다.
   */
  /**
   * 프로필을 열어 준다. 파트너십 메시지는 프로필의 '메시지 보내기' →
   * '우선순위 메시지 보내기' 를 거쳐야만 열리고, 그 경로를 주소로 건너뛸 수 없다.
   * (대화방 주소 /direct/partnerships/t/숫자 의 숫자는 대화가 생긴 뒤에야 발급된다)
   * 그래서 문 앞까지만 데려다주고 마지막 두 번은 사람이 누른다.
   */
  const openDm = () => {
    // ① 복사 먼저. 창을 열면 화면이 포커스를 잃어 복사가 막힌다.
    const body = templates[0]?.body
    if (body && copyNow(body)) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    }
    // ② 프로필 열기. 클릭 흐름 안에서 열어야 브라우저가 막지 않는다.
    const url = profileUrl(influencer.snsPlatform, influencer.snsHandle, influencer.snsUrl)
    if (url) window.open(url, '_blank', 'noopener')
    // ③ 보낸 것으로 기록. 잘못 눌렀으면 날짜 옆 × 로 지운다.
    log.mutate({ id: influencer.id, date: today() })
  }

  return (
    <div className="flex items-center justify-end gap-2 whitespace-nowrap">
      {last ? (
        <span className="text-xs text-slate-500">
          {formatDate(last)}
          <span className="ml-1 rounded-full bg-slate-100 px-1.5 py-0.5 text-slate-600">
            {dates.length}회
          </span>
          <button
            type="button"
            title="마지막 발송 기록 지우기"
            onClick={() => undo.mutate(influencer.id)}
            disabled={undo.isPending}
            className="ml-1 text-slate-300 hover:text-rose-500"
          >
            ×
          </button>
        </span>
      ) : (
        <span className="text-xs text-slate-300">기록 없음</span>
      )}
      <Button
        size="sm"
        variant="secondary"
        disabled={log.isPending || influencer.doNotContact}
        title={
          influencer.doNotContact
            ? '연락 금지 대상입니다.'
            : '시딩 문구를 복사하고 프로필을 엽니다. 프로필에서 메시지 보내기 → 우선순위 메시지 보내기'
        }
        onClick={openDm}
      >
        {copied ? '✓ 문구 복사됨' : 'DM 보내러 가기'}
      </Button>
    </div>
  )
}

export default function InfluencerListPage() {
  const { data: influencers, isLoading } = useInfluencers()
  const { data: collabs = [] } = useCollabs()
  const createCollab = useCreateCollab()
  const demo = useDemoData()

  const [keyword, setKeyword] = useState('')
  const [status, setStatus] = useState('')
  const [contactFilter, setContactFilter] = useState<ContactFilter>('all')
  const [dncTarget, setDncTarget] = useState<Influencer | null>(null)

  const filtered = useMemo(() => {
    const query = keyword.trim().toLowerCase()
    return (influencers ?? []).filter((influencer) => {
      if (query && !`${influencer.name} ${influencer.snsHandle}`.toLowerCase().includes(query))
        return false
      if (status && influencer.status !== status) return false
      if (contactFilter === 'contactable' && influencer.doNotContact) return false
      if (contactFilter === 'blocked' && !influencer.doNotContact) return false
      return true
    })
  }, [influencers, keyword, status, contactFilter])

  /** 파이프라인에 이미 올라와 있는 사람은 다시 올리지 않는다 (한 사람당 카드 한 장). */
  const collabByInfluencer = useMemo(
    () => new Map(collabs.map((collab) => [collab.influencerId, collab])),
    [collabs],
  )

  /** 회신을 받았다는 표시 — 파이프라인 첫 단계에 카드를 만든다. */
  const markReplied = (influencer: Influencer) => {
    createCollab.mutate({
      influencerId: influencer.id,
      stage: COLLAB_STAGES[0],
      title: '',
      collabType: '마켓',
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
    })
  }

  const exportCsv = () => {
    downloadCsv(
      contactFilter === 'contactable' ? '연락가능_인플루언서' : '인플루언서_목록',
      filtered.map((i) => ({
        이름: i.name,
        플랫폼: SNS_PLATFORM_LABELS[i.snsPlatform],
        계정: i.snsHandle,
        팔로워: i.followerCount,
        카테고리: i.categories.join('/'),
        평균매출: i.avgRevenueBand,
        상태: i.status,
        연락금지: i.doNotContact ? 'Y' : 'N',
        금지사유: i.dncReason ?? '',
        이메일: i.contactEmail,
        연락처: i.contactPhone,
        등록일: formatDate(i.createdAt),
        최근발송일: i.contactedDates.length
          ? formatDate(i.contactedDates[i.contactedDates.length - 1])
          : '',
        발송횟수: i.contactedDates.length,
      })),
    )
  }

  const resetFilters = () => {
    setKeyword('')
    setStatus('')
    setContactFilter('all')
  }

  const total = influencers?.length ?? 0
  const blocked = (influencers ?? []).filter((i) => i.doNotContact).length

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">셀러 리스트</h1>
          <p className="mt-1 text-sm text-slate-500">
            전체 {formatNumber(total)}명 · 연락 가능 {formatNumber(total - blocked)}명 · 연락 금지{' '}
            <span className="font-medium text-rose-600">{formatNumber(blocked)}명</span>
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={exportCsv} disabled={filtered.length === 0}>
            엑셀 다운로드
          </Button>
          <Link to="/influencers/new" className={linkButtonClass}>
            + 인플루언서 등록
          </Link>
        </div>
      </div>

      <MessageTemplates />

      <Card className="p-4">
        <div className="grid gap-3 md:grid-cols-3">
          <Input
            placeholder="이름 · 계정 검색"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
          />
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">상태 전체</option>
            {INFLUENCER_STATUSES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </Select>
          <Select
            value={contactFilter}
            onChange={(e) => setContactFilter(e.target.value as ContactFilter)}
          >
            <option value="all">연락 여부 전체</option>
            <option value="contactable">연락 가능만 보기</option>
            <option value="blocked">연락 금지만 보기</option>
          </Select>
        </div>
        {contactFilter === 'contactable' && (
          <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
            연락 금지 대상이 제외된 목록입니다. 이 상태로 엑셀을 내려받으면 그대로 발송 대상 명단이
            됩니다.
          </p>
        )}
      </Card>

      <Card>
        <div className="flex items-center justify-between px-5 py-3 text-sm">
          <span className="font-medium text-slate-700">{formatNumber(filtered.length)}명</span>
          <button className="text-slate-400 hover:text-slate-600" onClick={resetFilters}>
            필터 초기화
          </button>
        </div>

        {isLoading ? (
          <Spinner />
        ) : filtered.length === 0 ? (
          <EmptyState
            title={
              total === 0 ? '아직 등록된 인플루언서가 없습니다' : '조건에 맞는 결과가 없습니다'
            }
            description={
              total === 0
                ? '직접 등록하거나, 화면을 먼저 둘러보려면 예시 데이터를 넣어보세요.'
                : '필터를 변경해보세요.'
            }
            action={
              total === 0 ? (
                <div className="flex gap-2">
                  <Link to="/influencers/new" className={linkButtonClass}>
                    인플루언서 등록
                  </Link>
                  {isMockMode && (
                    <Button
                      variant="secondary"
                      onClick={() => demo.mutate('load')}
                      disabled={demo.isPending}
                    >
                      예시 데이터 넣기
                    </Button>
                  )}
                </div>
              ) : undefined
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-y border-slate-100 bg-slate-50 text-xs text-slate-500">
                <tr>
                  <th className="px-5 py-2.5 text-left font-medium">이름 / 계정</th>
                  <th className="px-3 py-2.5 text-left font-medium">상태</th>
                  <th className="px-3 py-2.5 text-left font-medium">등록일</th>
                  <th className="px-3 py-2.5 text-right font-medium">메시지 발송</th>
                  <th className="px-3 py-2.5 text-right font-medium">회신 받음</th>
                  <th className="px-3 py-2.5 text-right font-medium">정보 입력</th>
                  <th className="px-5 py-2.5 text-right font-medium">연락 금지</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {groupByDay(filtered).map((group) => [
                  <tr key={`day-${group.day}`} className="bg-slate-100/80">
                    <td
                      colSpan={7}
                      className="border-y border-slate-200 px-5 py-1.5 text-xs font-semibold text-slate-600"
                    >
                      {dayLabel(group.day)}
                      <span className="ml-2 font-normal text-slate-400">
                        {group.items.length}명 등록
                      </span>
                    </td>
                  </tr>,
                  ...group.items.map((influencer) => (
                    <tr
                      key={influencer.id}
                      className={clsx(
                        'hover:bg-slate-50',
                        influencer.doNotContact && 'bg-rose-50/40',
                      )}
                    >
                      <td className="px-5 py-3">
                        <Link
                          to={`/influencers/${influencer.id}/edit`}
                          className="font-medium text-slate-900 hover:text-violet-600"
                          title="정보 입력·수정"
                        >
                          {influencer.name}
                        </Link>
                        <div className="flex items-center gap-1.5">
                          {(() => {
                            const url = profileUrl(
                              influencer.snsPlatform,
                              influencer.snsHandle,
                              influencer.snsUrl,
                            )
                            return url ? (
                              <a
                                href={url}
                                target="_blank"
                                rel="noreferrer"
                                title={`${url} 새 창으로 열기`}
                                className="text-xs text-slate-400 hover:text-violet-600 hover:underline"
                              >
                                @{influencer.snsHandle}
                              </a>
                            ) : (
                              <span className="text-xs text-slate-400">
                                @{influencer.snsHandle}
                              </span>
                            )
                          })()}
                          {influencer.doNotContact && <DncBadge compact />}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <StatusBadge status={influencer.status} />
                      </td>
                      <td className="px-3 py-3 text-slate-500">
                        {formatDate(influencer.createdAt)}
                      </td>
                      <td className="px-3 py-3">
                        <ContactLog influencer={influencer} />
                      </td>
                      <td className="px-3 py-3 text-right whitespace-nowrap">
                        {(() => {
                          const collab = collabByInfluencer.get(influencer.id)
                          if (collab) {
                            return (
                              <Link
                                to="/pipeline"
                                className="text-xs text-slate-400 hover:text-violet-600"
                              >
                                파이프라인 · {collab.isOnHold ? '보류' : collab.stage}
                              </Link>
                            )
                          }
                          return (
                            <Button
                              size="sm"
                              variant="secondary"
                              disabled={influencer.doNotContact || createCollab.isPending}
                              title={
                                influencer.doNotContact
                                  ? '연락 금지 대상입니다. 먼저 해제해주세요.'
                                  : `파이프라인 '${COLLAB_STAGES[0]}' 단계에 추가합니다`
                              }
                              onClick={() => markReplied(influencer)}
                            >
                              회신 받음
                            </Button>
                          )
                        })()}
                      </td>
                      <td className="px-3 py-3 text-right whitespace-nowrap">
                        {hasProfile(influencer) ? (
                          <Link
                            to={`/influencers/${influencer.id}/edit`}
                            className="text-xs font-medium text-emerald-600 hover:underline"
                          >
                            ✓ 입력 완료
                          </Link>
                        ) : (
                          <Link
                            to={`/influencers/${influencer.id}/edit`}
                            className={clsx(
                              'rounded-lg px-2.5 py-1.5 text-xs font-medium',
                              // 회신까지 왔는데 정보가 비어 있으면 눈에 띄게 한다.
                              collabByInfluencer.has(influencer.id)
                                ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                                : 'border border-slate-300 text-slate-600 hover:bg-slate-50',
                            )}
                          >
                            정보 입력
                          </Link>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <Button
                          size="sm"
                          variant={influencer.doNotContact ? 'secondary' : 'ghost'}
                          onClick={() => setDncTarget(influencer)}
                        >
                          {influencer.doNotContact ? '해제' : '등록'}
                        </Button>
                      </td>
                    </tr>
                  )),
                ])}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <DncChangeDialog
        influencer={dncTarget}
        open={dncTarget !== null}
        onClose={() => setDncTarget(null)}
      />
    </div>
  )
}
