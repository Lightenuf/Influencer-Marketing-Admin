import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useCurrentUser } from '@/auth/AuthProvider'
import { Button, Card, CardHeader, EmptyState, Field, Input, Spinner, Textarea } from '@/components/ui'
import type { Influencer } from '@/data/types'
import {
  useCollabs,
  useCreateDiscoveryRequest,
  useCreateInfluencer,
  useDeleteDiscoveryRequest,
  useDiscoveryRequests,
  useInfluencers,
  useUpdateDiscoveryRequest,
} from '@/hooks/queries'
import { formatDate, formatDateTime, formatFollowers, formatNumber } from '@/utils/format'
import { toCount } from '@/utils/profileLink'

/** 프로필에 이 말이 있으면 공구를 돌리는 계정으로 본다. 화면 맨 아래에 그대로 안내한다. */
const PROFILE_KEYWORDS = ['공구', '마켓', '할인', '공동구매']

/** '9/15', '9.15', '9월 15일'처럼 날짜를 적어둔 것도 공구 계정 신호로 본다. */
const DATE_PATTERN = /\d{1,2}\s*(?:[/.]\s*\d{1,2}|월\s*\d{1,2}\s*일?)/

interface Candidate {
  handle: string
  followerCount: number | null
  bio: string
}

/**
 * 크롬 자동화가 돌려준 결과를 그대로 붙여넣어도 읽히도록 느슨하게 해석한다.
 * 한 줄에 한 명 — 아이디·팔로워·소개글 순서가 달라도, 표(|·탭)로 복사해도 받는다.
 */
function parseCandidates(text: string): Candidate[] {
  const seen = new Set<string>()
  const list: Candidate[] = []

  for (const rawLine of text.split('\n')) {
    const line = rawLine.replace(/[|\t]/g, ' ').trim()
    if (!line || /^[-\s|]+$/.test(line)) continue

    const handleMatch = line.match(/(?:instagram\.com\/|@)([A-Za-z0-9._]{2,30})/)
    if (!handleMatch) continue
    const handle = handleMatch[1].replace(/\.$/, '')
    const key = handle.toLowerCase()
    if (seen.has(key)) continue

    // 아이디를 먼저 떼어낸다 — 아이디에 든 숫자(@abc_2024)를 팔로워수로 잘못 읽지 않도록.
    const rest = line.replace(handleMatch[0], ' ')

    const labelled = rest.match(/(?:팔로워|followers?)\s*[:·]?\s*([\d.,]+\s*[만천억KkMm]?)/i)
    let followerCount = labelled ? toCount(labelled[1]) : null
    // 팔로워수로 읽은 글자는 소개글에서 빼둔다. '4.2만'의 '4.2'가 날짜로 보이는 것을 막기 위함.
    let followerText = labelled ? labelled[0] : null
    if (followerCount === null) {
      let best: { value: number; text: string } | null = null
      for (const m of rest.matchAll(/([\d][\d.,]*\s*[만천억KkMm]?)/g)) {
        const value = toCount(m[1])
        if (value !== null && (best === null || value > best.value)) best = { value, text: m[1] }
      }
      followerCount = best?.value ?? null
      followerText = best?.text ?? null
    }

    const bio = (followerText ? rest.replace(followerText, ' ') : rest)
      .replace(/\s{2,}/g, ' ')
      .trim()

    seen.add(key)
    list.push({ handle, followerCount, bio })
  }
  return list
}

type Verdict = '발굴 대상' | '조건 미달' | '이미 등록' | '거절 이력' | '연락 금지'

const verdictTone: Record<Verdict, string> = {
  '발굴 대상': 'bg-violet-100 text-violet-700',
  '조건 미달': 'bg-slate-100 text-slate-500',
  '이미 등록': 'bg-amber-100 text-amber-700',
  '거절 이력': 'bg-rose-100 text-rose-700',
  '연락 금지': 'bg-rose-600 text-white',
}

export default function DiscoveryPage() {
  const user = useCurrentUser()
  const { data: influencers = [], isLoading } = useInfluencers()
  const { data: collabs = [] } = useCollabs()
  const createInfluencer = useCreateInfluencer(user.id)

  const [keywords, setKeywords] = useState<string[]>([])
  const [keywordDraft, setKeywordDraft] = useState('')
  const [minFollowers, setMinFollowers] = useState('10000')
  const [wanted, setWanted] = useState('10')

  const [copied, setCopied] = useState(false)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [manualResult, setManualResult] = useState('')

  const { data: requests = [] } = useDiscoveryRequests()
  const createRequest = useCreateDiscoveryRequest(user.id)
  const updateRequest = useUpdateDiscoveryRequest()
  const deleteRequest = useDeleteDiscoveryRequest()

  // 가장 최근 요청 하나를 따라간다 — 자동화가 결과를 채우면 화면이 저절로 바뀐다.
  const current = requests[0] ?? null
  const raw = current?.resultRaw ?? ''
  const searchedAt = current?.requestedAt ?? null
  const searchedWith = current?.keywords ?? []

  const minimum = Number(minFollowers.replace(/[^\d]/g, '')) || 0
  const count = Number(wanted.replace(/[^\d]/g, '')) || 0

  const addKeyword = () => {
    const word = keywordDraft.trim().replace(/,$/, '')
    if (!word || keywords.includes(word)) return
    setKeywords([...keywords, word])
    setKeywordDraft('')
  }

  /** 크롬이 연결된 Claude 창에 그대로 붙여넣는 지시문. 결과를 어드민에 쓰는 것까지 시킨다. */
  const instruction = useMemo(
    () =>
      [
        '브리보 인플루언서 어드민의 발굴 대기열을 처리해줘.',
        '',
        `1. ${window.location.origin}${import.meta.env.BASE_URL}discovery 를 연다.`,
        '   로그인 화면이 뜨면 나에게 알려주고 멈춰줘.',
        '',
        `2. 인스타그램에서 다음 키워드로 검색한다: ${keywords.join(', ')}`,
        `   검색 결과 게시물의 작성자 프로필에 들어가, 아래 조건을 모두 만족하는 계정을 ${count}명 모은다.`,
        `   - 팔로워 ${formatNumber(minimum)}명 이상`,
        `   - 프로필 소개글에 ${PROFILE_KEYWORDS.map((word) => `'${word}'`).join(' · ')} 중 하나가 있거나, 날짜(9/15 · 10월 5일 같은)가 적혀 있을 것`,
        '',
        '   프로필을 여는 속도는 사람이 보는 정도로 유지하고,',
        '   보안 확인이나 로그인 화면이 뜨면 즉시 멈추고 알려줘.',
        '',
        '3. 모은 결과를 한 줄에 한 명씩 이 형식으로 정리한다.',
        '   @아이디 | 팔로워수 | 소개글 한 줄',
        '   이미 연락한 계정인지는 어드민이 걸러내니, 찾은 것은 그대로 다 적는다.',
        '',
        "4. 어드민 발굴 화면의 '발굴 요청' 카드 안 붙여넣기 칸에 3번 결과를 붙여넣고",
        "   '결과 저장' 버튼을 누른다.",
        '',
        "5. 몇 명을 찾았고 그중 '발굴 대상'이 몇 명인지 알려줘.",
        '   컨택 리스트로 옮기는 건 내가 직접 할 테니 옮기지는 말아줘.',
      ].join('\n'),
    [keywords, count, minimum],
  )

  const copyInstruction = async () => {
    try {
      await navigator.clipboard.writeText(instruction)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      // 브라우저가 복사를 막으면 아래 지시문을 직접 긁어 쓰면 된다.
      setCopied(false)
    }
  }

  const startSearch = async () => {
    await createRequest.mutateAsync({ keywords, minFollowers: minimum, wanted: count })
    setPicked(new Set())
    setManualResult('')
    await copyInstruction()
  }

  const rejectedIds = useMemo(
    () => new Set(collabs.filter((collab) => collab.isCancelled).map((c) => c.influencerId)),
    [collabs],
  )

  const rows = useMemo(() => {
    const registered = new Map<string, Influencer>(
      influencers.map((influencer) => [influencer.snsHandle.toLowerCase(), influencer]),
    )

    return parseCandidates(raw).map((candidate) => {
      const existing = registered.get(candidate.handle.toLowerCase())
      const matchesProfile =
        PROFILE_KEYWORDS.some((word) => candidate.bio.includes(word)) ||
        DATE_PATTERN.test(candidate.bio)
      const enoughFollowers = (candidate.followerCount ?? 0) >= minimum

      let verdict: Verdict = '발굴 대상'
      if (existing?.doNotContact) verdict = '연락 금지'
      else if (existing && rejectedIds.has(existing.id)) verdict = '거절 이력'
      else if (existing) verdict = '이미 등록'
      else if (!enoughFollowers || !matchesProfile) verdict = '조건 미달'

      return { candidate, existing, verdict, matchesProfile, enoughFollowers }
    })
  }, [raw, influencers, rejectedIds, minimum])

  /** 요청에 딸린 조건으로 판정해야 하므로, 완료된 요청의 기준을 따른다. */

  const targets = rows.filter((row) => row.verdict === '발굴 대상')
  const selected = targets.filter((row) => picked.has(row.candidate.handle))

  const toggle = (handle: string) =>
    setPicked((current) => {
      const next = new Set(current)
      if (next.has(handle)) next.delete(handle)
      else next.add(handle)
      return next
    })

  const moveToContacts = async () => {
    setProgress({ done: 0, total: selected.length })
    const tag = searchedWith.length > 0 ? `발굴 키워드: ${searchedWith.join(', ')}` : ''
    for (const [index, row] of selected.entries()) {
      const { handle, followerCount, bio } = row.candidate
      await createInfluencer.mutateAsync({
        name: handle,
        snsPlatform: 'instagram',
        snsHandle: handle,
        snsUrl: `https://www.instagram.com/${handle}/`,
        followerCount: followerCount ?? 0,
        followingCount: 0,
        categories: [],
        avgRevenueBand: '미확인',
        contactEmail: '',
        contactPhone: '',
        contactEtc: '',
        status: '제안중',
        memo: [bio, tag].filter(Boolean).join('\n'),
      })
      setProgress({ done: index + 1, total: selected.length })
    }
    setPicked(new Set())
    setProgress(null)
    if (current) {
      await updateRequest.mutateAsync({
        id: current.id,
        patch: { note: `${selected.length}명 컨택 리스트로 옮김` },
      })
    }
  }

  if (isLoading) return <Spinner />

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900">인플루언서 발굴</h1>
        <p className="mt-1 text-sm text-slate-500">
          키워드로 찾은 후보를 조건에 맞춰 걸러내고, 확인한 사람만 컨택 리스트로 옮깁니다.
        </p>
      </div>

      <Card>
        <CardHeader title="검색 조건" />
        <div className="space-y-4 p-5">
          <Field label="검색 키워드" hint="두 개 이상 넣어주세요. Enter 또는 쉼표로 구분됩니다.">
            <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-slate-300 bg-white p-2 focus-within:border-violet-500 focus-within:ring-2 focus-within:ring-violet-100">
              {keywords.map((word) => (
                <span
                  key={word}
                  className="inline-flex items-center gap-1 rounded-md bg-violet-100 px-2 py-1 text-xs font-medium text-violet-700"
                >
                  {word}
                  <button
                    type="button"
                    aria-label={`${word} 빼기`}
                    onClick={() => setKeywords(keywords.filter((item) => item !== word))}
                    className="text-violet-400 hover:text-violet-700"
                  >
                    ×
                  </button>
                </span>
              ))}
              <input
                value={keywordDraft}
                onChange={(e) => {
                  const value = e.target.value
                  if (value.endsWith(',')) {
                    setKeywordDraft(value)
                    addKeyword()
                  } else setKeywordDraft(value)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addKeyword()
                  }
                  if (e.key === 'Backspace' && keywordDraft === '' && keywords.length > 0) {
                    setKeywords(keywords.slice(0, -1))
                  }
                }}
                onBlur={addKeyword}
                placeholder={keywords.length === 0 ? '예) 뉴치트, 위시어, 육아맘' : ''}
                className="min-w-40 flex-1 bg-transparent px-1 py-1 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
              />
            </div>
          </Field>

          <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-start">
            <Field label="최소 팔로워수">
              <Input
                inputMode="numeric"
                value={minFollowers}
                onChange={(e) => setMinFollowers(e.target.value.replace(/[^\d]/g, ''))}
              />
            </Field>
            <Field label="발굴 수" hint="많이 발굴할수록 시간이 오래 걸립니다.">
              <Input
                inputMode="numeric"
                value={wanted}
                onChange={(e) => setWanted(e.target.value.replace(/[^\d]/g, ''))}
              />
            </Field>
            {/* 라벨 높이(1.625rem)만큼 내려 입력칸과 같은 줄에 선다 */}
            <div className="md:mt-[1.625rem]">
              <Button onClick={startSearch} disabled={keywords.length < 2 || count === 0}>
                인플루언서 발굴
              </Button>
            </div>
          </div>

          {keywords.length < 2 && (
            <p className="text-xs text-amber-600">검색 키워드를 두 개 이상 넣어주세요.</p>
          )}

          {current && current.status === '대기' && (
            <div className="rounded-lg bg-violet-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="text-xs leading-relaxed text-violet-800">
                  <b>발굴 요청을 남겼습니다. 아직 검색은 시작되지 않았습니다.</b>
                  <br />
                  아래 지시문을 <b>크롬이 연결된 Claude 창에 붙여넣어야</b> 검색이 시작됩니다.
                  {copied && ' (버튼을 누를 때 이미 복사해 뒀습니다)'} 자동화가 결과를 저장하면 이
                  화면은 15초마다 스스로 확인해 표를 띄웁니다.
                </p>
                <Button size="sm" variant="secondary" onClick={copyInstruction}>
                  {copied ? '✓ 복사함' : '지시문 복사'}
                </Button>
              </div>
              <pre className="mt-2 max-h-40 overflow-auto rounded-md bg-white p-3 text-[11px] leading-relaxed whitespace-pre-wrap text-slate-700">
                {instruction}
              </pre>
            </div>
          )}
        </div>
      </Card>

      {current && (
        <Card>
          <CardHeader
            title="발굴 요청"
            description={`${current.keywords.join(', ')} · 팔로워 ${formatNumber(
              current.minFollowers,
            )}명 이상 · ${formatNumber(current.wanted)}명 요청 · ${formatDateTime(
              current.requestedAt,
            )}`}
            action={
              <div className="flex items-center gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    current.status === '완료'
                      ? 'bg-emerald-100 text-emerald-700'
                      : current.status === '진행중'
                        ? 'bg-amber-100 text-amber-700'
                        : current.status === '실패'
                          ? 'bg-rose-100 text-rose-700'
                          : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {current.status}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    if (confirm('이 발굴 요청을 지울까요?')) deleteRequest.mutate(current.id)
                  }}
                >
                  요청 취소
                </Button>
              </div>
            }
          />

          {current.note && (
            <p className="border-t border-slate-100 px-5 py-3 text-sm text-slate-500">
              {current.note}
            </p>
          )}

          {current.status !== '완료' && (
            <div className="space-y-3 p-5">
              <p className="text-sm text-slate-500">
                자동화가 아직 결과를 채우지 않았습니다. 직접 받아온 결과가 있다면 아래에 붙여넣어도
                됩니다.
              </p>
              <Textarea
                rows={5}
                value={manualResult}
                onChange={(e) => setManualResult(e.target.value)}
                placeholder={'@healthy_table_kr | 4.2만 | 9/15 공구 오픈\n@new_market_kr | 3.5만 | 마켓 할인 진행'}
              />
              <div className="flex justify-end">
                <Button
                  variant="secondary"
                  disabled={!manualResult.trim()}
                  onClick={() =>
                    updateRequest.mutate({
                      id: current.id,
                      patch: { resultRaw: manualResult, status: '완료' },
                    })
                  }
                >
                  결과 저장
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}

      {raw.trim() !== '' && (
        <Card>
          <CardHeader
            title={`인플루언서 발굴 결과 ${formatNumber(rows.length)}명`}
            description={`발굴 대상 ${formatNumber(targets.length)}명 · 조건 미달 ${formatNumber(
              rows.filter((r) => r.verdict === '조건 미달').length,
            )}명 · 이미 접촉 ${formatNumber(
              rows.filter((r) => ['이미 등록', '거절 이력', '연락 금지'].includes(r.verdict)).length,
            )}명`}
            action={
              targets.length > 0 ? (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    setPicked(
                      selected.length === targets.length
                        ? new Set()
                        : new Set(targets.map((row) => row.candidate.handle)),
                    )
                  }
                >
                  {selected.length === targets.length ? '선택 해제' : '대상 전체 선택'}
                </Button>
              ) : undefined
            }
          />

          {rows.length === 0 ? (
            <EmptyState
              title="아이디를 찾지 못했습니다"
              description="각 줄에 @아이디나 인스타그램 주소가 들어 있어야 읽을 수 있습니다."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-y border-slate-100 bg-slate-50 text-xs text-slate-500">
                  <tr>
                    <th className="px-5 py-2.5 text-left font-medium">선택</th>
                    <th className="px-3 py-2.5 text-left font-medium">이름 / 계정</th>
                    <th className="px-3 py-2.5 text-right font-medium">팔로워수</th>
                    <th className="px-3 py-2.5 text-left font-medium">상태</th>
                    <th className="px-3 py-2.5 text-left font-medium">검색일</th>
                    <th className="px-5 py-2.5 text-left font-medium">검색어</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map(({ candidate, existing, verdict, enoughFollowers }) => (
                    <tr key={candidate.handle} className="hover:bg-slate-50">
                      <td className="px-5 py-3">
                        <input
                          type="checkbox"
                          disabled={verdict !== '발굴 대상' || progress !== null}
                          checked={picked.has(candidate.handle)}
                          onChange={() => toggle(candidate.handle)}
                          className="h-4 w-4 accent-violet-600"
                        />
                      </td>
                      <td className="px-3 py-3">
                        <a
                          href={`https://www.instagram.com/${candidate.handle}/`}
                          target="_blank"
                          rel="noreferrer"
                          title="새 창으로 프로필 확인"
                          className="font-medium text-slate-900 hover:text-violet-600 hover:underline"
                        >
                          @{candidate.handle}
                        </a>
                        {candidate.bio && (
                          <p className="max-w-xs truncate text-xs text-slate-400" title={candidate.bio}>
                            {candidate.bio}
                          </p>
                        )}
                        {existing && (
                          <Link
                            to={`/influencers/${existing.id}/edit`}
                            className="text-xs text-slate-400 hover:text-violet-600"
                          >
                            기존 정보 보기
                          </Link>
                        )}
                      </td>
                      <td
                        className={
                          enoughFollowers
                            ? 'tabular px-3 py-3 text-right text-slate-700'
                            : 'tabular px-3 py-3 text-right text-slate-300'
                        }
                      >
                        {candidate.followerCount === null
                          ? '-'
                          : formatFollowers(candidate.followerCount)}
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${verdictTone[verdict]}`}
                        >
                          {verdict}
                        </span>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-slate-500">
                        {searchedAt ? formatDate(searchedAt) : '-'}
                      </td>
                      <td className="px-5 py-3 text-slate-600">
                        {searchedWith.length > 0 ? searchedWith.join(', ') : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-5 py-4">
            {progress && (
              <span className="text-sm text-slate-500">
                옮기는 중... {progress.done} / {progress.total}
              </span>
            )}
            <Button onClick={moveToContacts} disabled={selected.length === 0 || progress !== null}>
              {selected.length > 0
                ? `${selected.length}명 컨택 리스트로 옮기기`
                : '옮길 사람을 골라주세요'}
            </Button>
          </div>
        </Card>
      )}

      <p className="rounded-lg bg-slate-50 px-4 py-3 text-xs leading-relaxed text-slate-500">
        <b>기본 조건</b> — 프로필 소개글에{' '}
        {PROFILE_KEYWORDS.map((word) => `'${word}'`).join(' · ')} 중 하나가 있거나, 날짜(9/15 ·
        10월 5일 등)가 적혀 있어야 발굴 대상으로 봅니다. 여기에 위에서 정한 최소 팔로워수를 함께
        확인합니다. 이미 컨택 리스트에 있거나 거절·연락 금지한 분은 자동으로 걸러집니다.
      </p>
    </div>
  )
}
