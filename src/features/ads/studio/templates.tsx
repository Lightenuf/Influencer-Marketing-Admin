import type { CSSProperties, ReactNode } from 'react'

/**
 * 지면 소재 템플릿 (8-2).
 *
 * HTML/CSS 레이아웃 + 슬롯(에셋·헤드라인·서브헤드·배지·CTA·로고)이다.
 * 브라우저에서 그려 PNG로 내보낸다.
 *
 * 템플릿을 늘리는 것은 코드로 한다 — 레이아웃은 눈으로 보고 맞춰야 하는 것이라
 * 설정 화면으로 빼면 오히려 손이 더 간다.
 */

export const RATIOS = {
  '1:1': { width: 1080, height: 1080 },
  '4:5': { width: 1080, height: 1350 },
  '9:16': { width: 1080, height: 1920 },
} as const

export type RatioKey = keyof typeof RATIOS

/** 너비÷높이로 어느 비율에 가까운지 고른다 */
export function ratioOf(width: number, height: number): RatioKey {
  if (!width || !height) return '1:1'
  const value = width / height
  const gaps: [RatioKey, number][] = [
    ['1:1', Math.abs(value - 1)],
    ['4:5', Math.abs(value - 0.8)],
    ['9:16', Math.abs(value - 0.5625)],
  ]
  return gaps.sort((a, b) => a[1] - b[1])[0][0]
}

export interface Slots {
  imageUrl: string
  headline: string
  subhead: string
  badge: string
  cta: string
}

export interface Template {
  key: string
  label: string
  /** 이 템플릿이 어울리는 비율 */
  ratios: RatioKey[]
  render: (slots: Slots, ratio: RatioKey) => ReactNode
}

const BRAND = '#7c3aed'
const INK = '#0f172a'

/** 글자가 넘치면 잘리는 대신 줄어들게 한다 — 한글은 길이를 가늠하기 어렵다 */
const fit = (text: string, at: number, min: number, max: number): CSSProperties => ({
  fontSize: `${Math.max(min, max - Math.max(0, text.length - at) * 2.2)}px`,
})

const base: CSSProperties = {
  fontFamily: '"Pretendard", -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", sans-serif',
  wordBreak: 'keep-all',
  lineHeight: 1.25,
}

/** 아래쪽에 글자를 얹는 기본형 */
const bottomBar: Template = {
  key: 'bottomBar',
  label: '아래 띠',
  ratios: ['1:1', '4:5', '9:16'],
  render: (slots, ratio) => {
    const { width, height } = RATIOS[ratio]
    return (
      <div style={{ ...base, position: 'relative', width, height, background: '#fff' }}>
        <img
          src={slots.imageUrl}
          alt=""
          style={{ width: '100%', height: '68%', objectFit: 'cover' }}
          crossOrigin="anonymous"
        />
        <div style={{ padding: '48px 56px', height: '32%', boxSizing: 'border-box' }}>
          {slots.badge && (
            <span
              style={{
                display: 'inline-block',
                background: BRAND,
                color: '#fff',
                borderRadius: 999,
                padding: '10px 24px',
                fontSize: 30,
                fontWeight: 700,
                marginBottom: 20,
              }}
            >
              {slots.badge}
            </span>
          )}
          <p
            style={{
              ...fit(slots.headline, 14, 44, 68),
              fontWeight: 800,
              color: INK,
              margin: 0,
            }}
          >
            {slots.headline}
          </p>
          {slots.subhead && (
            <p
              style={{
                ...fit(slots.subhead, 22, 26, 38),
                color: '#475569',
                margin: '16px 0 0',
              }}
            >
              {slots.subhead}
            </p>
          )}
        </div>
      </div>
    )
  },
}

/** 이미지 위에 글자를 얹고 아래를 어둡게 깔아 읽히게 한 형 */
const overlay: Template = {
  key: 'overlay',
  label: '겹쳐 얹기',
  ratios: ['1:1', '4:5', '9:16'],
  render: (slots, ratio) => {
    const { width, height } = RATIOS[ratio]
    return (
      <div style={{ ...base, position: 'relative', width, height, overflow: 'hidden' }}>
        <img
          src={slots.imageUrl}
          alt=""
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          crossOrigin="anonymous"
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(to top, rgba(2,6,23,.85) 30%, rgba(2,6,23,0) 62%)',
          }}
        />
        <div
          style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '56px 56px 72px' }}
        >
          {slots.badge && (
            <span
              style={{
                display: 'inline-block',
                background: '#fff',
                color: BRAND,
                borderRadius: 999,
                padding: '10px 24px',
                fontSize: 30,
                fontWeight: 700,
                marginBottom: 20,
              }}
            >
              {slots.badge}
            </span>
          )}
          <p
            style={{
              ...fit(slots.headline, 14, 46, 76),
              fontWeight: 800,
              color: '#fff',
              margin: 0,
            }}
          >
            {slots.headline}
          </p>
          {slots.subhead && (
            <p
              style={{
                ...fit(slots.subhead, 22, 26, 38),
                color: 'rgba(255,255,255,.88)',
                margin: '16px 0 0',
              }}
            >
              {slots.subhead}
            </p>
          )}
        </div>
      </div>
    )
  },
}

/** 글자를 위에 두고 이미지를 아래에 둔 형 — 메시지를 먼저 읽히게 할 때 */
const topText: Template = {
  key: 'topText',
  label: '위 문구',
  ratios: ['1:1', '4:5'],
  render: (slots, ratio) => {
    const { width, height } = RATIOS[ratio]
    return (
      <div style={{ ...base, width, height, background: '#faf5ff' }}>
        <div style={{ padding: '64px 56px 32px', height: '36%', boxSizing: 'border-box' }}>
          <p style={{ ...fit(slots.headline, 14, 46, 72), fontWeight: 800, color: INK, margin: 0 }}>
            {slots.headline}
          </p>
          {slots.subhead && (
            <p style={{ ...fit(slots.subhead, 22, 26, 36), color: '#6d28d9', margin: '16px 0 0' }}>
              {slots.subhead}
            </p>
          )}
        </div>
        <img
          src={slots.imageUrl}
          alt=""
          style={{ width: '100%', height: '64%', objectFit: 'cover' }}
          crossOrigin="anonymous"
        />
      </div>
    )
  },
}

export const TEMPLATES: Template[] = [bottomBar, overlay, topText]

export const templateOf = (key: string) =>
  TEMPLATES.find((item) => item.key === key) ?? TEMPLATES[0]
