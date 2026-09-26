/**
 * 옛 광고 이름에서 태그를 읽어낸다.
 *
 * 메타에 있는 이름은 고치지 않는다. 읽기만 해서 태그 후보를 만들고,
 * 사람이 확인한 뒤에 저장한다 — 자동 저장하지 않는다.
 *
 * 실제 광고 306개에 돌려보고 규칙을 맞췄다. 그때 알게 된 것들:
 *   · 날짜가 6자리(260715)와 8자리(20260728) 둘 다 쓰인다
 *   · UGC는 두 번째 토막이 앵글이 아니라 크리에이터·컨셉 이름인 경우가 많다
 *   · 훅은 옛 이름에 거의 없다. 없는 게 정상이니 비워 두고 사람이 붙인다
 */

import type { AdTagDraft, NameAlias } from '@/data/adTypes'

/** 5-3 정규화 — 판단에 방해되는 접두·접미를 떼어낸다 */
const NOISE = [
  /\s*-\s*사본\s*\d*/gi,
  /\s*복사본\s*\d*/gi,
  /\s*-\s*Copy\s*\d*/gi,
  /_FIX_?\d*/gi,
  /\[WIN\s*\d{3,4}\]/gi,
  /\[LOSE\s*\d{3,4}\]/gi,
  /\[AI\]/gi,
]

/** 실험 기록으로 남겨야 하는 표시 (5-3) */
const WIN_LOSE = /\[(WIN|LOSE)\s*(\d{3,4})\]/i

export interface ParsedName {
  /** 접두·접미를 뗀 이름 */
  clean: string
  /** 읽어낸 태그 */
  tags: AdTagDraft
  /** 옛 실험 표시 — Phase 5에서 과거 기록으로 쓴다 */
  experiment: { result: 'WIN' | 'LOSE'; date: string } | null
  /** 태그로 옮기지 못하고 남은 토막 — 미분류 이유를 보여줄 때 쓴다 */
  leftover: string[]
}

/** 이름에서 군더더기를 떼어낸다 */
export function normalizeName(name: string): string {
  let out = name ?? ''
  for (const pattern of NOISE) out = out.replace(pattern, '')
  return out.trim().replace(/^[_\-\s]+|[_\-\s]+$/g, '')
}

/** 260715 · 20260728 둘 다 받아 YYMMDD로 맞춘다 */
function readDate(token: string): string | null {
  if (/^\d{6}$/.test(token)) return token
  if (/^\d{8}$/.test(token)) return token.slice(2)
  return null
}

/**
 * 이름 하나를 읽는다.
 *
 * aliases는 설정 > 태그 사전에서 관리하는 매핑이다.
 * 코드에 박지 않아야 새 표현이 나올 때 화면에서 더할 수 있다.
 */
export function parseAdName(name: string, aliases: NameAlias[]): ParsedName {
  const experimentMatch = name.match(WIN_LOSE)
  const experiment = experimentMatch
    ? {
        result: experimentMatch[1].toUpperCase() as 'WIN' | 'LOSE',
        date: experimentMatch[2],
      }
    : null

  const clean = normalizeName(name)
  const tags: AdTagDraft = {
    source: '',
    format: '',
    angle: '',
    hook: '',
    segment: '',
    offer: '',
    creatorHint: '',
    date: '',
  }

  const tokens = clean.split(/[_\s]+/).filter(Boolean)
  if (tokens.length === 0) return { clean, tags, experiment, leftover: [] }

  // 첫 토막이 UGC면 파트너십·일반을 가리지 않고 UGC로 본다.
  // 어느 쪽인지는 파트너십 설정을 보고 따로 채운다.
  let rest = tokens
  if (tokens[0].toUpperCase() === 'UGC') {
    tags.source = 'UGC(일반)'
    rest = tokens.slice(1)
  } else {
    tags.source = 'DA(자체 제작)'
  }

  const byDimension = (dimension: string) => aliases.filter((a) => a.dimension === dimension)

  // 먼저 확실한 것(포맷·날짜)부터 빼낸다
  const remaining: string[] = []
  for (const token of rest) {
    const date = readDate(token)
    if (date && !tags.date) {
      tags.date = date
      continue
    }
    const format = byDimension('format').find((a) => token === a.token)
    if (format && !tags.format) {
      tags.format = format.label
      continue
    }
    remaining.push(token)
  }

  // 남은 토막에서 앵글·훅·세그먼트를 찾는다. 토막 안에 포함되기만 해도 인정한다
  // ('클린성분+입점+자사몰 할인' 같은 이름이 실제로 있다)
  for (const token of remaining) {
    for (const dimension of ['angle', 'hook', 'segment', 'offer'] as const) {
      if (tags[dimension]) continue
      const hit = byDimension(dimension).find((a) => token.includes(a.token))
      if (hit) tags[dimension] = hit.label
    }
  }

  // UGC인데 앵글을 못 읽었다면, 두 번째 토막은 크리에이터·컨셉 이름일 가능성이 높다.
  // 앵글로 잘못 넣지 않고 힌트로만 남긴다.
  if (tags.source.startsWith('UGC') && remaining.length > 0) {
    const unused = remaining.filter(
      (t) => ![tags.angle, tags.hook, tags.segment, tags.offer].some((v) => v && t.includes(v)),
    )
    tags.creatorHint = unused[0] ?? ''
  }

  const leftover = remaining.filter(
    (t) => ![tags.angle, tags.hook, tags.segment, tags.offer].some((v) => v && t.includes(v)),
  )

  return { clean, tags, experiment, leftover }
}

/**
 * 이 광고를 자동 분류했다고 볼 수 있는가.
 * 앵글과 포맷 둘 다 있어야 비교에 쓸 수 있다 — 둘 중 하나만으로는 묶이지 않는다.
 */
export const isClassified = (tags: AdTagDraft) => Boolean(tags.angle && tags.format)

/** 5-2 새 네이밍 — 새로 만드는 광고에만 쓴다 */
export function buildAdName(parts: {
  source: string
  angle: string
  hook: string
  format: string
  date?: Date
  shortId?: string
}): string {
  const short = (value: string) => (value || '미정').replace(/[_\s]/g, '').slice(0, 10)
  const day = parts.date ?? new Date()
  const yymmdd =
    String(day.getFullYear()).slice(2) +
    String(day.getMonth() + 1).padStart(2, '0') +
    String(day.getDate()).padStart(2, '0')
  const id = parts.shortId ?? randomShortId()
  return [
    short(parts.source),
    short(parts.angle),
    short(parts.hook),
    short(parts.format),
    yymmdd,
    id,
  ].join('_')
}

/** 같은 이름이 겹치지 않게 붙이는 꼬리표 */
export function randomShortId(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789'
  let out = ''
  for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)]
  return out
}
