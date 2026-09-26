import type { Collab, Influencer } from '@/data/types'

/**
 * 공구 일정과 광고 운영을 잇는다.
 *
 * 공구 기간에는 셀러가 자기 채널로 매출을 만든다. 그때 광고비를 태우면
 * 어차피 살 사람에게 두 번 돈을 쓰는 셈이 된다. 그래서 최소로 줄였다가,
 * 공구가 끝나면 그때 만들어진 영상을 파트너십 광고로 돌리며 다시 올린다.
 *
 * 이 일정은 어드민이 이미 알고 있다 — 협업 파이프라인의 시작·종료 예정일이다.
 */

export interface MarketWindow {
  collabId: string
  title: string
  sellerName: string
  /** YYYY-MM-DD */
  start: string
  end: string
}

/** 오늘이 공구와 어떤 관계인가 */
export type MarketPhase =
  | { kind: 'none' }
  /** 곧 시작한다 — 예산을 줄일 때 */
  | { kind: 'soon'; market: MarketWindow; daysUntil: number }
  /** 하는 중 — 증액하지 않는다 */
  | { kind: 'running'; market: MarketWindow; daysLeft: number }
  /** 막 끝났다 — 영상을 파트너십으로 돌리고 다시 올릴 때 */
  | { kind: 'justEnded'; market: MarketWindow; daysSince: number }

const today = () => new Date().toISOString().slice(0, 10)

const daysBetween = (from: string, to: string) =>
  Math.round(
    (new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()) / 86_400_000,
  )

/** 파이프라인에서 일정이 잡힌 공구만 추린다 */
export function marketWindows(collabs: Collab[], influencers: Influencer[]): MarketWindow[] {
  const nameOf = (id: string) => influencers.find((row) => row.id === id)?.name ?? '(셀러 미상)'
  return collabs
    .filter((collab) => collab.marketDate)
    .map((collab) => ({
      collabId: collab.id,
      title: collab.title || nameOf(collab.influencerId),
      sellerName: nameOf(collab.influencerId),
      start: collab.marketDate!,
      // 종료일을 안 적었으면 하루짜리로 본다
      end: collab.marketEndDate ?? collab.marketDate!,
    }))
    .sort((a, b) => a.start.localeCompare(b.start))
}

/**
 * 지금이 어느 국면인가.
 * 공구가 겹쳐 있으면 진행 중인 것을 우선으로 본다 — 지금 돈이 나가는 쪽이 중요하다.
 */
export function marketPhase(
  markets: MarketWindow[],
  prepDays: number,
  boostDays: number,
): MarketPhase {
  const now = today()

  const running = markets.find((market) => market.start <= now && now <= market.end)
  if (running) {
    return { kind: 'running', market: running, daysLeft: daysBetween(now, running.end) }
  }

  const soon = markets
    .filter((market) => market.start > now)
    .find((market) => daysBetween(now, market.start) <= prepDays)
  if (soon) {
    return { kind: 'soon', market: soon, daysUntil: daysBetween(now, soon.start) }
  }

  // 끝난 지 얼마 안 된 것 중 가장 최근
  const ended = [...markets]
    .filter((market) => market.end < now && daysBetween(market.end, now) <= boostDays)
    .sort((a, b) => b.end.localeCompare(a.end))[0]
  if (ended) {
    return { kind: 'justEnded', market: ended, daysSince: daysBetween(ended.end, now) }
  }

  return { kind: 'none' }
}

/** 화면에 보여줄 한 줄 */
export function describePhase(phase: MarketPhase): string {
  switch (phase.kind) {
    case 'running':
      return `${phase.market.sellerName} 공구 중 (${phase.daysLeft}일 남음) — 증액을 멈춥니다`
    case 'soon':
      return `${phase.market.sellerName} 공구가 ${phase.daysUntil}일 뒤 시작 — 예산을 줄일 때입니다`
    case 'justEnded':
      return `${phase.market.sellerName} 공구가 ${phase.daysSince}일 전 끝남 — 영상을 광고로 돌릴 때입니다`
    default:
      return '공구 일정 없음 — 평소대로 운영합니다'
  }
}
