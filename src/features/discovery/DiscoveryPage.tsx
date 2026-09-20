import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useCurrentUser } from '@/auth/AuthProvider'
import { Button, Card, CardHeader, EmptyState, Field, Input, Spinner, Textarea } from '@/components/ui'
import type { Influencer } from '@/data/types'
import { useCollabs, useCreateInfluencer, useInfluencers } from '@/hooks/queries'
import { formatFollowers, formatNumber } from '@/utils/format'
import { toCount } from '@/utils/profileLink'

const DEFAULT_KEYWORDS = '공구, 마켓, 공동구매'
const DEFAULT_MIN_FOLLOWERS = 10_000

/** 소개글에 '9/15', '9.15', '9월 15일'처럼 날짜를 적어두면 공구를 돌리는 계정일 확률이 높다. */
const DATE_PATTERN = /\d{1,2}\s*(?:[/.]\s*\d{1,2}|월\s*\d{1,2}\s*일?)/

interface Candidate {
  handle: string
  followerCount: number | null
  bio: string
}

/**
 * 크롬 자동화가 뱉어낸 결과를 그대로 붙여넣어도 읽히도록 느슨하게 해석한다.
 * 한 줄에 한 명 — 아이디, 팔로워 수, 소개글이 어떤 순서로 있어도 찾아낸다.
 * (표 형태로 복사해 |, 탭, 쉼표로 나뉘어 있어도 받는다)
 */
function parseCandidates(text: string): Candidate[] {
  const seen = new Set<string>()
  const list: Candidate[] = []

  for (const rawLine of text.split('\n')) {
    const line = rawLine.replace(/\|/g, ' ').replace(/\t/g, ' ').trim()
    if (!line || /^[-\s|]+$/.test(line)) continue

    const handleMatch = line.match(/(?:instagram\.com\/|@)([A-Za-z0-9._]{2,30})/)
    if (!handleMatch) continue
    const handle = handleMatch[1].replace(/\.$/, '')
    const key = handle.toLowerCase()
    if (seen.has(key)) continue

    // '팔로워 4.2만' 같은 표현을 먼저 찾고, 없으면 줄에서 가장 큰 수를 팔로워로 본다.
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

export default function DiscoveryPage() {
  const user = useCurrentUser()
  const { data: influencers = [], isLoading } = useInfluencers()
  const { data: collabs = [] } = useCollabs()
  const createInfluencer = useCreateInfluencer(user.id)

  const [raw, setRaw] = useState('')
  const [minFollowers, setMinFollowers] = useState(String(DEFAULT_MIN_FOLLOWERS))
  const [keywordInput, setKeywordInput] = useState(DEFAULT_KEYWORDS)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)

  const keywords = keywordInput
    .split(/[,\n]/)
    .map((word) => word.trim())
    .filter(Boolean)
  const minimum = Number(minFollowers.replace(/[^\d]/g, '')) || 0

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
      const matchesKeyword =
        keywords.length === 0 ||
        keywords.some((word) => candidate.bio.includes(word)) ||
        DATE_PATTERN.test(candidate.bio)
      const enoughFollowers = (candidate.followerCount ?? 0) >= minimum

      let verdict: Verdict = '발굴 대상'
      if (existing?.doNotContact) verdict = '연락 금지'
      else if (existing && rejectedIds.has(existing.id)) verdict = '거절 이력'
      else if (existing) verdict = '이미 등록'
      else if (!enoughFollowers || !matchesKeyword) verdict = '조건 미달'

      return { candidate, existing, verdict, matchesKeyword, enoughFollowers }
    })
  }, [raw, influencers, rejectedIds, keywords, minimum])

  const targets = rows.filter((row) => row.verdict === '발굴 대상')
  const selected = targets.filter((row) => picked.has(row.candidate.handle))

  const toggle = (handle: string) =>
    setPicked((current) => {
      const next = new Set(current)
      if (next.has(handle)) next.delete(handle)
      else next.add(handle)
      return next
    })

  const toggleAll = () =>
    setPicked(
      selected.length === targets.length
        ? new Set()
        : new Set(targets.map((row) => row.candidate.handle)),
    )

  const register = async () => {
    setProgress({ done: 0, total: selected.length })
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
        memo: bio,
      })
      setProgress({ done: index + 1, total: selected.length })
    }
    setPicked(new Set())
    setProgress(null)
    setRaw('')
  }

  const verdictTone: Record<Verdict, string> = {
    '발굴 대상': 'bg-violet-100 text-violet-700',
    '조건 미달': 'bg-slate-100 text-slate-500',
    '이미 등록': 'bg-amber-100 text-amber-700',
    '거절 이력': 'bg-rose-100 text-rose-700',
    '연락 금지': 'bg-rose-600 text-white',
  }

  if (isLoading) return <Spinner />

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900">인플루언서 발굴</h1>
        <p className="mt-1 text-sm text-slate-500">
          검색해서 모은 후보를 붙여넣으면 조건에 맞는지 가려내고, 이미 접촉했거나 거절한 분은
          걸러냅니다. 고른 사람만 컨택 리스트로 한 번에 옮깁니다.
        </p>
      </div>

      <Card>
        <CardHeader title="후보 붙여넣기" description="한 줄에 한 명 — 아이디·팔로워·소개글 순서는 상관없습니다." />
        <div className="space-y-4 p-5">
          <Textarea
            rows={8}
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            disabled={progress !== null}
            placeholder={
              '@healthy_table_kr 팔로워 4.2만 9/15 공구 오픈\n' +
              'https://www.instagram.com/nalssin_cook/ 16.1만 마켓 문의 DM\n' +
              '@daily_mom 8,200 육아 일상'
            }
            autoFocus
          />

          <div className="grid gap-3 md:grid-cols-2">
            <Field label="최소 팔로워" hint={`${formatNumber(minimum)}명 이상만 발굴 대상`}>
              <Input
                inputMode="numeric"
                value={minFollowers}
                onChange={(e) => setMinFollowers(e.target.value.replace(/[^\d]/g, ''))}
              />
            </Field>
            <Field
              label="소개글 키워드"
              hint="쉼표로 구분 · 날짜(9/15, 9월 15일)가 있으면 키워드가 없어도 통과"
            >
              <Input value={keywordInput} onChange={(e) => setKeywordInput(e.target.value)} />
            </Field>
          </div>
        </div>
      </Card>

      {raw.trim() !== '' && (
        <Card>
          <CardHeader
            title={`후보 ${formatNumber(rows.length)}명`}
            description={`발굴 대상 ${formatNumber(targets.length)}명 · 조건 미달 ${formatNumber(
              rows.filter((r) => r.verdict === '조건 미달').length,
            )}명 · 이미 접촉 ${formatNumber(
              rows.filter((r) => ['이미 등록', '거절 이력', '연락 금지'].includes(r.verdict)).length,
            )}명`}
            action={
              targets.length > 0 ? (
                <Button size="sm" variant="secondary" onClick={toggleAll}>
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
                    <th className="px-3 py-2.5 text-left font-medium">계정</th>
                    <th className="px-3 py-2.5 text-right font-medium">팔로워</th>
                    <th className="px-3 py-2.5 text-left font-medium">소개글</th>
                    <th className="px-5 py-2.5 text-right font-medium">판정</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map(({ candidate, existing, verdict, enoughFollowers, matchesKeyword }) => (
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
                          className="font-medium text-slate-900 hover:text-violet-600 hover:underline"
                        >
                          @{candidate.handle}
                        </a>
                        {existing && (
                          <Link
                            to={`/influencers/${existing.id}/edit`}
                            className="ml-2 text-xs text-slate-400 hover:text-violet-600"
                          >
                            기존 정보
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
                      <td className="max-w-md px-3 py-3">
                        <span
                          className={matchesKeyword ? 'text-slate-600' : 'text-slate-300'}
                          title={candidate.bio}
                        >
                          {candidate.bio || '-'}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${verdictTone[verdict]}`}
                        >
                          {verdict}
                        </span>
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
                등록 중... {progress.done} / {progress.total}
              </span>
            )}
            <Button onClick={register} disabled={selected.length === 0 || progress !== null}>
              {selected.length > 0 ? `${selected.length}명 등록` : '등록할 사람을 골라주세요'}
            </Button>
          </div>
        </Card>
      )}
    </div>
  )
}
