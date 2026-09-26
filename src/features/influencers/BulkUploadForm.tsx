import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useCurrentUser } from '@/auth/AuthProvider'
import { Button, Card, CardHeader, secondaryLinkButtonClass, Textarea } from '@/components/ui'
import { useCreateInfluencer, useInfluencers } from '@/hooks/queries'
import { parseProfileLink } from '@/utils/profileLink'

const normalizeHandle = (value: string) => value.trim().toLowerCase().replace(/^@/, '')

interface ParsedEntry {
  handle: string
  url: string
}

/** 붙여넣은 글에서 아이디만 골라낸다. 링크로 넣어도, @를 붙여도 받는다. */
function parseList(raw: string): ParsedEntry[] {
  const seen = new Set<string>()
  const entries: ParsedEntry[] = []

  for (const token of raw.split(/[\s,]+/)) {
    const piece = token.trim()
    if (!piece) continue

    const parsed = parseProfileLink(piece)
    const handle = (parsed?.handle ?? piece).replace(/^@/, '').trim()
    if (!handle || !/^[A-Za-z0-9._]{1,30}$/.test(handle)) continue

    const key = handle.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    entries.push({ handle, url: parsed?.url ?? `https://www.instagram.com/${handle}/` })
  }
  return entries
}

export default function BulkUploadForm() {
  const user = useCurrentUser()
  const navigate = useNavigate()
  const { data: existing = [] } = useInfluencers()
  const createInfluencer = useCreateInfluencer(user.id)

  const [raw, setRaw] = useState('')
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [failed, setFailed] = useState<string[]>([])

  const { fresh, already } = useMemo(() => {
    const registered = new Map(existing.map((i) => [normalizeHandle(i.snsHandle), i]))
    const parsed = parseList(raw)
    return {
      fresh: parsed.filter((entry) => !registered.has(entry.handle.toLowerCase())),
      already: parsed
        .filter((entry) => registered.has(entry.handle.toLowerCase()))
        .map((entry) => ({ entry, found: registered.get(entry.handle.toLowerCase())! })),
    }
  }, [raw, existing])

  const submit = async () => {
    setFailed([])
    setProgress({ done: 0, total: fresh.length })
    const errors: string[] = []

    for (const [index, entry] of fresh.entries()) {
      try {
        await createInfluencer.mutateAsync({
          name: entry.handle,
          snsPlatform: 'instagram',
          snsHandle: entry.handle,
          snsUrl: entry.url,
          followerCount: 0,
          followingCount: 0,
          categories: [],
          avgRevenueBand: '미확인',
          contactEmail: '',
          contactPhone: '',
          contactEtc: '',
          status: '제안중',
          memo: '',
        })
      } catch {
        errors.push(entry.handle)
      }
      setProgress({ done: index + 1, total: fresh.length })
    }

    if (errors.length > 0) {
      setFailed(errors)
      setProgress(null)
      return
    }
    navigate('/influencers')
  }

  const running = progress !== null

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title="인스타그램 아이디 붙여넣기"
          description="한 줄에 하나씩 넣어주세요. 프로필 링크를 붙여넣어도 아이디만 골라냅니다."
          action={
            <Link
              to="/influencers/new?mode=manual"
              className="text-sm text-violet-600 hover:underline"
            >
              한 명씩 자세히 등록
            </Link>
          }
        />
        <div className="p-5">
          <Textarea
            rows={10}
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            disabled={running}
            placeholder={'5452_home\n@happyhabits_s\nhttps://www.instagram.com/nalssin_cook/\n...'}
            autoFocus
          />

          {raw.trim() !== '' && (
            <div className="mt-3 space-y-2 text-sm">
              <p className="text-slate-700">
                등록할 계정 <b className="text-violet-700">{fresh.length}개</b>
                {already.length > 0 && (
                  <>
                    <span className="mx-1.5 text-slate-300">·</span>
                    <span className="text-amber-600">이미 등록됨 {already.length}개</span>
                  </>
                )}
              </p>

              {fresh.length > 0 && (
                <div className="flex flex-wrap gap-1.5 rounded-lg bg-slate-50 p-3">
                  {fresh.map((entry) => (
                    <span
                      key={entry.handle}
                      className="rounded-md bg-white px-2 py-1 text-xs text-slate-600 ring-1 ring-slate-200"
                    >
                      @{entry.handle}
                    </span>
                  ))}
                </div>
              )}

              {already.length > 0 && (
                <div className="rounded-lg bg-amber-50 p-3 text-xs leading-relaxed text-amber-700">
                  아래 계정은 이미 목록에 있어 건너뜁니다 —{' '}
                  {already.map(({ entry, found }, index) => (
                    <span key={entry.handle}>
                      {index > 0 && ', '}
                      <Link
                        to={`/influencers/${found.id}`}
                        className="underline hover:text-amber-900"
                      >
                        @{entry.handle}
                      </Link>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </Card>

      <p className="rounded-lg bg-slate-50 px-4 py-3 text-xs leading-relaxed text-slate-500">
        대량 등록은 <b>아이디만</b> 저장합니다. 팔로워 수·소개글 같은 프로필 정보는 인스타그램에서
        자동으로 가져올 수 없어, 각 인플루언서 상세에서 프로필 화면을 붙여넣어 채워주셔야 합니다.
        이름은 우선 아이디로 넣어두니 나중에 수정하시면 됩니다.
      </p>

      {failed.length > 0 && (
        <p className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {failed.length}개를 저장하지 못했습니다 — {failed.map((h) => `@${h}`).join(', ')}. 다시
          시도해주세요.
        </p>
      )}

      <div className="flex items-center justify-end gap-3">
        {running && (
          <span className="text-sm text-slate-500">
            등록 중... {progress.done} / {progress.total}
          </span>
        )}
        <Link to="/influencers" className={secondaryLinkButtonClass}>
          취소
        </Link>
        <Button onClick={submit} disabled={fresh.length === 0 || running}>
          {fresh.length > 0 ? `${fresh.length}개 등록` : '등록'}
        </Button>
      </div>
    </div>
  )
}
