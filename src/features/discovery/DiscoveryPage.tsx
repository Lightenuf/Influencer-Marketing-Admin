import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useCurrentUser } from '@/auth/AuthProvider'
import { Button, Card, CardHeader, EmptyState, Field, Input, Spinner, Textarea } from '@/components/ui'
import type { Influencer } from '@/data/types'
import { useCollabs, useCreateInfluencer, useInfluencers } from '@/hooks/queries'
import { formatDate, formatFollowers, formatNumber } from '@/utils/format'
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

    const labelled = line.match(/(?:팔로워|followers?)\s*[:·]?\s*([\d.,]+\s*[만천억KkMm]?)/i)
    let followerCount = labelled ? toCount(labelled[1]) : null
    if (followerCount === null) {
      const numbers = [...line.matchAll(/([\d][\d.,]*\s*[만천억KkMm]?)/g)]
        .map((m) => toCount(m[1]))
        .filter((n): n is number => n !== null)
      followerCount = numbers.length > 0 ? Math.max(...numbers) : null
    }

    const bio = line
      .replace(handleMatch[0], ' ')
      .replace(/(?:팔로워|followers?)\s*[:·]?\s*[\d.,]+\s*[만천억KkMm]?/gi, ' ')
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

  const [raw, setRaw] = useState('')
  const [searchedAt, setSearchedAt] = useState<string | null>(null)
  const [searchedWith, setSearchedWith] = useState<string[]>([])
  const [copied, setCopied] = useState(false)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)

  const minimum = Number(minFollowers.replace(/[^\d]/g, '')) || 0
  const count = Number(wanted.replace(/[^\d]/g, '')) || 0

  const addKeyword = () => {
    const word = keywordDraft.trim().replace(/,$/, '')
    if (!word || keywords.includes(word)) return
    setKeywords([...keywords, word])
    setKeywordDraft('')
  }

  /** 크롬 자동화에 그대로 넘길 수 있는 지시문 */
  const instruction = useMemo(
    () =>
      [
        `인스타그램에서 다음 키워드로 검색해줘: ${keywords.join(', ')}`,
        `각 키워드의 게시물 작성자 프로필에 들어가서, 아래 조건에 맞는 계정을 ${count}명 찾아줘.`,
        '',
        '조건',
        `- 팔로워 ${formatNumber(minimum)}명 이상`,
        `- 프로필 소개글에 ${PROFILE_KEYWORDS.map((word) => `'${word}'`).join(' · ')} 중 하나가 있거나, 날짜(9/15 · 10월 5일 같은)가 적혀 있을 것`,
        '',
        '결과는 한 줄에 한 명씩 이렇게 적어줘:',
        '@아이디 | 팔로워수 | 소개글 한 줄',
        '',
        '이미 연락한 계정인지는 내가 확인하니 그대로 다 적어줘.',
      ].join('\n'),
    [keywords, count, minimum],
  )

  const startSearch = async () => {
    // 복사가 막힌 환경에서도 검색 기록과 지시문은 남도록 순서를 지킨다.
    setSearchedAt(new Date().toISOString())
    setSearchedWith(keywords)
    try {
      await navigator.clipboard.writeText(instruction)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      setCopied(false)
    }
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
    setRaw('')
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

          <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
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
            <div className="pb-6">
              <Button onClick={startSearch} disabled={keywords.length < 2 || count === 0}>
                {copied ? '✓ 복사했습니다' : '인플루언서 발굴'}
              </Button>
            </div>
          </div>

          {keywords.length < 2 && (
            <p className="text-xs text-amber-600">검색 키워드를 두 개 이상 넣어주세요.</p>
          )}

          {searchedAt && (
            <div className="rounded-lg bg-violet-50 p-4">
              <p className="text-xs leading-relaxed text-violet-800">
                <b>
                  {copied
                    ? '크롬 자동화에 넘길 지시문을 복사했습니다.'
                    : '아래 지시문을 복사해 크롬 자동화에 넘겨주세요.'}
                </b>{' '}
                크롬에서 실행하는 Claude 대화창에 붙여넣으면 검색과 프로필 확인을 대신해줍니다.
                결과가 나오면 아래 칸에 그대로 붙여넣어 주세요.
              </p>
              <pre className="mt-2 max-h-40 overflow-auto rounded-md bg-white p-3 text-[11px] leading-relaxed whitespace-pre-wrap text-slate-700">
                {instruction}
              </pre>
            </div>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader
          title="발굴 결과 붙여넣기"
          description="자동화가 돌려준 결과를 그대로 넣으면 조건에 맞는지 가려냅니다."
        />
        <div className="p-5">
          <Textarea
            rows={6}
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            disabled={progress !== null}
            placeholder={'@healthy_table_kr | 4.2만 | 9/15 공구 오픈\n@new_market_kr | 3.5만 | 마켓 할인 진행'}
          />
        </div>
      </Card>

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
