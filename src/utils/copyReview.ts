/**
 * 카피 자동 검수 (8-4).
 *
 * 이건 1차 장치다. 최종 판단은 검수 단계의 사람이 한다.
 * 다만 식품표시광고법에 걸리는 표현은 한 번 걸러야 한다 —
 * 수십 개를 한꺼번에 만들면 사람 눈으로 다 잡기 어렵다.
 */

export interface CopyDraft {
  headline: string
  subhead: string
  badge: string
  body: string
  linkTitle: string
}

export type FlagLevel = 'block' | 'warn'

export interface CopyFlag {
  level: FlagLevel
  /** 어느 칸에서 걸렸나 */
  field: string
  message: string
}

export interface ReviewRules {
  bannedWords: string[]
  fiberGram: number
  headlineMaxChars: number
  subheadMaxChars: number
  bodyMaxChars: number
}

const FIELDS: { key: keyof CopyDraft; label: string }[] = [
  { key: 'headline', label: '헤드라인' },
  { key: 'subhead', label: '서브헤드' },
  { key: 'badge', label: '배지' },
  { key: 'body', label: '본문' },
  { key: 'linkTitle', label: '제목' },
]

/** 식이섬유 수치를 찾는다 — '식이섬유 5g', '식이섬유5g', '식이섬유 5 g' 모두 잡는다 */
const FIBER = /식이섬유\s*(\d+(?:\.\d+)?)\s*g/gi

export function reviewCopy(draft: CopyDraft, rules: ReviewRules): CopyFlag[] {
  const flags: CopyFlag[] = []

  for (const field of FIELDS) {
    const text = draft[field.key] ?? ''
    if (!text) continue

    // 금지 표현 — 막는다
    for (const word of rules.bannedWords) {
      if (word && text.includes(word)) {
        flags.push({
          level: 'block',
          field: field.label,
          message: `'${word}' 는 쓸 수 없습니다 — 효능·효과를 말하는 표현입니다`,
        })
      }
    }

    // 식이섬유 수치 — 정해진 값이 아니면 막는다
    for (const match of text.matchAll(FIBER)) {
      const value = Number(match[1])
      if (value !== rules.fiberGram) {
        flags.push({
          level: 'block',
          field: field.label,
          message: `식이섬유는 ${rules.fiberGram}g 로만 적을 수 있습니다 (지금 ${value}g)`,
        })
      }
    }
  }

  // 길이 — 넘으면 잘리므로 알려만 준다
  const limits: [keyof CopyDraft, string, number][] = [
    ['headline', '헤드라인', rules.headlineMaxChars],
    ['subhead', '서브헤드', rules.subheadMaxChars],
    ['body', '본문', rules.bodyMaxChars],
  ]
  for (const [key, label, max] of limits) {
    const length = (draft[key] ?? '').length
    if (length > max) {
      flags.push({
        level: 'warn',
        field: label,
        message: `${max}자를 넘습니다 (지금 ${length}자) — 잘려 보일 수 있습니다`,
      })
    }
  }

  return flags
}

/** 막히는 것이 하나라도 있으면 올릴 수 없다 */
export const isBlocked = (flags: CopyFlag[]) => flags.some((flag) => flag.level === 'block')

/**
 * 이미 있는 카피와 너무 비슷한지 (8-4 중복 카피).
 * 글자 단위로 얼마나 겹치는지만 본다 — 정교할 필요는 없고, 사람이 보게만 하면 된다.
 */
export function similarity(a: string, b: string): number {
  const left = new Set(a.replace(/\s/g, ''))
  const right = new Set(b.replace(/\s/g, ''))
  if (left.size === 0 || right.size === 0) return 0
  let shared = 0
  for (const ch of left) if (right.has(ch)) shared++
  return shared / Math.max(left.size, right.size)
}

/** 0.8 이상이면 거의 같은 말이다 */
export const DUPLICATE_AT = 0.8

export function findDuplicates(
  draft: CopyDraft,
  existing: { id: string; headline: string; body: string }[],
): { id: string; score: number }[] {
  const mine = `${draft.headline} ${draft.body}`
  return existing
    .map((row) => ({ id: row.id, score: similarity(mine, `${row.headline} ${row.body}`) }))
    .filter((row) => row.score >= DUPLICATE_AT)
    .sort((a, b) => b.score - a.score)
}
