import type { SnsPlatform } from '@/data/types'

export interface ParsedProfile {
  platform: SnsPlatform
  handle: string
  url: string
}

/**
 * 프로필 링크에서 주소만 보고 알 수 있는 것을 뽑아낸다.
 * (인터넷에 접속하지 않는다 — 팔로워수처럼 페이지를 열어야 아는 값은 얻을 수 없다.)
 */
export function parseProfileLink(raw: string): ParsedProfile | null {
  const input = raw.trim()
  if (!input) return null

  const cleaned = input
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/[?#].*$/, '')
    .replace(/\/+$/, '')

  const [host, ...rest] = cleaned.split('/')
  const path = rest.join('/')

  const pick = (platform: SnsPlatform, handle: string, url: string): ParsedProfile | null =>
    handle ? { platform, handle: handle.replace(/^@/, ''), url } : null

  if (/^instagram\.com$/i.test(host)) {
    const handle = path.split('/')[0] ?? ''
    return pick('instagram', handle, `https://www.instagram.com/${handle.replace(/^@/, '')}/`)
  }

  if (/^(youtube\.com|m\.youtube\.com)$/i.test(host)) {
    const segment = path.split('/')[0] ?? ''
    // /@handle · /c/name · /channel/ID · /user/name
    const handle = /^(c|channel|user)$/i.test(segment) ? (path.split('/')[1] ?? '') : segment
    return pick('youtube', handle, `https://www.youtube.com/${path}`)
  }

  if (/^(tiktok\.com|vt\.tiktok\.com)$/i.test(host)) {
    const handle = path.split('/')[0] ?? ''
    return pick('tiktok', handle, `https://www.tiktok.com/@${handle.replace(/^@/, '')}`)
  }

  if (/^(blog\.naver\.com|m\.blog\.naver\.com|blog\.me)$/i.test(host)) {
    const handle = path.split('/')[0] ?? ''
    return pick('blog', handle, `https://blog.naver.com/${handle}`)
  }

  // 주소가 아니라 아이디만 붙여넣은 경우 — 인스타로 본다(시딩이 대부분 인스타 DM).
  if (!cleaned.includes('.') && !cleaned.includes('/')) {
    const handle = cleaned.replace(/^@/, '')
    return pick('instagram', handle, `https://www.instagram.com/${handle}/`)
  }

  return null
}

/**
 * 저장해 둔 프로필 주소를 쓰고, 없으면 플랫폼과 아이디로 만들어 준다.
 * 아이디만 있고 주소가 비어 있는 예전 기록도 링크로 열 수 있게 하기 위함.
 */
export function profileUrl(platform: SnsPlatform, handle: string, url: string): string | null {
  if (url.trim()) return url.trim()
  const id = handle.trim().replace(/^@/, '')
  if (!id) return null
  switch (platform) {
    case 'instagram':
      return `https://www.instagram.com/${id}/`
    case 'youtube':
      return `https://www.youtube.com/@${id}`
    case 'tiktok':
      return `https://www.tiktok.com/@${id}`
    case 'blog':
      return `https://blog.naver.com/${id}`
    default:
      return null
  }
}

/** '44.6만' · '446K' · '3,385' → 숫자 */
export function toCount(raw: string): number | null {
  const s = raw.replace(/,/g, '').trim()
  const m = s.match(/^([\d.]+)\s*(만|천|억|[KkMmBb])?$/)
  if (!m) return null
  const n = Number(m[1])
  if (Number.isNaN(n)) return null
  const unit = m[2]?.toLowerCase()
  const mul =
    unit === '만' ? 10_000 : unit === '천' ? 1_000 : unit === '억' ? 100_000_000
    : unit === 'k' ? 1_000 : unit === 'm' ? 1_000_000 : unit === 'b' ? 1_000_000_000 : 1
  return Math.round(n * mul)
}

/**
 * 인스타 소개글에 흔한 장식 글꼴(𝚐𝚖𝚊𝚒𝚕, ｇｍａｉｌ, ⓖⓜⓐⓘⓛ 등)을 보통 글자로 되돌린다.
 * 값을 알아보기 위한 변환일 뿐이며, 메모에 남길 원문은 이 함수를 거치지 않는다.
 */
function toPlainText(text: string): string {
  return text
    .normalize('NFKC')
    .replace(/[​-‍﻿︎️]/g, '')
    .replace(/ /g, ' ')
}

/**
 * 붙여넣은 글에서 이메일 주소를 찾는다.
 * 인스타 소개글에 적어둔 협업 문의 주소(@ + 도메인)를 잡기 위한 것으로,
 * 아이디(@handle)는 도메인이 없어 걸리지 않는다.
 */
export function findEmail(text: string): string | null {
  const match = toPlainText(text).match(
    /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/,
  )
  return match ? match[0] : null
}

export interface ParsedProfileText {
  handle: string | null
  followerCount: number | null
  followingCount: number | null
  bio: string | null
  email: string | null
}

/**
 * 인스타 프로필 화면을 복사해 붙여넣은 글자에서 값을 뽑아낸다.
 * 한국어/영어 화면을 모두 본다. 인터넷 접속은 하지 않는다.
 */
export function parseProfileText(text: string): ParsedProfileText {
  // 원문은 메모에 그대로 남기고, 값을 읽을 때만 장식 글꼴을 되돌린 사본을 쓴다.
  const original = text.replace(/\u00a0/g, ' ')
  const t = toPlainText(text)

  const grab = (patterns: RegExp[]) => {
    for (const re of patterns) {
      const m = t.match(re)
      if (m) {
        const n = toCount(m[1])
        if (n !== null) return n
      }
    }
    return null
  }

  const followerCount = grab([
    /팔로워\s*([\d.,]+\s*[만천억]?)/,
    /([\d.,]+\s*[KkMmBb]?)\s*followers?/i,
  ])
  const followingCount = grab([
    /팔로우(?:잉)?\s*([\d.,]+\s*[만천억]?)/,
    /([\d.,]+\s*[KkMmBb]?)\s*following/i,
  ])

  const urlMatch = t.match(/instagram\.com\/([A-Za-z0-9._]+)/i)
  let handle = urlMatch?.[1] ?? null
  if (!handle) {
    // 링크가 없으면 아이디처럼 생긴 첫 줄을 쓴다.
    const line = t
      .split('\n')
      .map((l) => l.trim())
      .find((l) => /^@?[a-z0-9._]{2,30}$/i.test(l) && /[a-z]/i.test(l))
    handle = line ? line.replace(/^@/, '') : null
  }

  // 숫자 줄과 아이디를 걷어낸 첫 문장을 소개글로 본다. (줄 자체는 원문 그대로 남긴다)
  const bio =
    original
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => {
        const plain = toPlainText(l)
        return (
          l &&
          !/팔로워|팔로우|게시물|followers?|following|posts?/i.test(plain) &&
          plain !== handle &&
          plain !== `@${handle}`
        )
      })
      .slice(0, 6)
      .join('\n') || null

  return { handle, followerCount, followingCount, bio, email: findEmail(t) }
}
