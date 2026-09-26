import type { OpsSettings } from '@/data/adTypes'
import type { MetaAd, MetaAdSet, MetaCampaign, MetaDayPoint, MetaInsight } from '@/data/metaTypes'
import { metaCostPerResult, metaCtr, metaRoas, sumInsights } from '@/data/metaTypes'
import type { AdRow } from './adAggregate'
import type { MarketPhase } from './marketWindow'

/**
 * 제안 규칙 (요청서 7-1).
 *
 * 순수 함수로 둔다 — 화면에서도, 나중에 스케줄러에서도 같은 코드가 돌아야
 * "화면에서 본 제안"과 "밤에 계산된 제안"이 달라지지 않는다.
 *
 * 모든 기준값은 운영 기준에서 읽는다. 여기에 숫자를 박지 않는다.
 */

export const RULE_KINDS = [
  'increase',
  'decrease',
  'off',
  'promote',
  'scaleTest',
  'replace',
  'fatigue',
  'thinAdSet',
  // 공구 일정에 맞춘 것들
  'marketCut',
  'marketRestore',
  'marketUgc',
] as const
export type RuleKind = (typeof RULE_KINDS)[number]

export const RULE_LABELS: Record<RuleKind, string> = {
  increase: '증액',
  decrease: '감액',
  off: 'OFF',
  promote: '승격',
  scaleTest: '테스트 증량',
  replace: '교체 후보',
  fatigue: '피로도',
  thinAdSet: '세트 소재 부족',
  marketCut: '공구 대비 감액',
  marketRestore: '공구 후 증액',
  marketUgc: '공구 영상 활용',
}

/** 손실을 막는 것이 먼저, 기회가 다음, 유지보수가 마지막 (7-2) */
const RULE_ORDER: Record<RuleKind, number> = {
  off: 1,
  decrease: 2,
  // 공구는 날짜가 정해져 있어 놓치면 만회할 수 없다. 앞에 세운다.
  marketCut: 3,
  marketRestore: 4,
  marketUgc: 5,
  increase: 6,
  promote: 7,
  scaleTest: 8,
  replace: 9,
  fatigue: 10,
  thinAdSet: 11,
}

export interface Suggestion {
  kind: RuleKind
  targetLevel: 'campaign' | 'adset' | 'ad'
  targetId: string
  targetName: string
  /** 사람이 읽는 한 줄 */
  title: string
  /** 판단에 쓴 숫자 */
  evidence: Record<string, number | string>
  /** 실행하면 무엇이 어떻게 되는가 */
  effect: { kind: 'budget'; from: number; to: number } | { kind: 'status'; to: 'PAUSED' } | null
  confident: boolean
  needsApproval: boolean
}

export interface RuleInput {
  ops: OpsSettings
  /** 판단 기간 집계 */
  rows: AdRow[]
  campaigns: MetaCampaign[]
  adsets: MetaAdSet[]
  ads: MetaAd[]
  insights: MetaInsight[]
  /** 캠페인·세트 단위 집계 */
  campaignInsights: MetaInsight[]
  adsetInsights: MetaInsight[]
  /** 피로도 판단용 일별 값 */
  daily: MetaDayPoint[]
  /** 그 대상의 마지막 예산 변경 시각 */
  lastBudgetChange: Map<string, string>
  /** 파생값 */
  breakEven: number
  minSpend: number
  /** 공구 일정 — 없으면 평소대로 판단한다 */
  phase: MarketPhase
}

const won = (value: number | null) => (value == null ? 0 : value)

/** 오늘 것은 아직 확정이 아니다 — 판단에서 뺀다 (7장 계산 시점) */
export const excludeToday = (day: string) => day < new Date().toISOString().slice(0, 10)

export function buildSuggestions(input: RuleInput): Suggestion[] {
  const { ops, rows, adsets, ads, breakEven, minSpend, phase } = input
  const out: Suggestion[] = []

  // 공구 기간에는 셀러 채널이 매출을 만든다. 광고로 겹쳐 태우지 않는다.
  const holdIncrease = phase.kind === 'running' || phase.kind === 'soon'

  const insightOf = (list: MetaInsight[], id: string) => list.find((row) => row.id === id)
  const daysSince = (iso: string | undefined) =>
    iso ? (Date.now() - new Date(iso).getTime()) / 86_400_000 : Infinity

  // ── 증액·감액: 예산이 붙어 있는 곳(CBO 캠페인 또는 세트)에만 ──
  const budgetTargets: {
    level: 'campaign' | 'adset'
    id: string
    name: string
    budget: number
  }[] = [
    ...input.campaigns
      .filter((c) => won(c.dailyBudget) > 0)
      .map((c) => ({
        level: 'campaign' as const,
        id: c.id,
        name: c.name,
        budget: won(c.dailyBudget),
      })),
    ...adsets
      .filter((s) => won(s.dailyBudget) > 0)
      .map((s) => ({
        level: 'adset' as const,
        id: s.id,
        name: s.name,
        budget: won(s.dailyBudget),
      })),
  ]

  for (const target of budgetTargets) {
    const insight =
      target.level === 'campaign'
        ? insightOf(input.campaignInsights, target.id)
        : insightOf(input.adsetInsights, target.id)
    if (!insight) continue

    const roas = metaRoas(insight)
    const changed = daysSince(input.lastBudgetChange.get(`${target.level}:${target.id}`))

    // 공구 대비 감액 — 곧 시작하거나 하는 중인데 아직 예산이 크다
    if (holdIncrease && target.budget > ops.marketFloorWon) {
      const market = 'market' in phase ? phase.market : null
      out.push({
        kind: 'marketCut',
        targetLevel: target.level,
        targetId: target.id,
        targetName: target.name,
        title: `${target.name} 예산을 공구용 최소로 낮추세요`,
        evidence: {
          공구: market?.sellerName ?? '',
          기간: market ? `${market.start} ~ ${market.end}` : '',
          지금_예산: target.budget,
          최소_예산: ops.marketFloorWon,
        },
        effect: { kind: 'budget', from: target.budget, to: ops.marketFloorWon },
        confident: true,
        needsApproval: false,
      })
      continue
    }

    // 공구 후 증액 — 공구가 끝났는데 아직 최소 예산에 머물러 있다
    if (phase.kind === 'justEnded' && target.budget <= ops.marketFloorWon && roas >= breakEven) {
      const next = Math.round(target.budget * (1 + ops.increaseStep))
      out.push({
        kind: 'marketRestore',
        targetLevel: target.level,
        targetId: target.id,
        targetName: target.name,
        title: `${target.name} 예산을 다시 올리세요 — ${phase.market.sellerName} 공구가 끝났습니다`,
        evidence: {
          공구_종료: phase.market.end,
          지출: Math.round(insight.spend),
          ROAS: Number(roas.toFixed(2)),
          손익분기: Number(breakEven.toFixed(2)),
        },
        effect: { kind: 'budget', from: target.budget, to: next },
        confident: insight.spend >= minSpend,
        needsApproval: next - target.budget >= ops.approvalAmountWon,
      })
      continue
    }

    // 증액 — 손익분기를 넉넉히 넘고, 마지막 조정 후 충분히 지났을 때
    if (!holdIncrease && roas >= breakEven * 1.2 && changed >= ops.increaseIntervalDays) {
      const next = Math.round(target.budget * (1 + ops.increaseStep))
      out.push({
        kind: 'increase',
        targetLevel: target.level,
        targetId: target.id,
        targetName: target.name,
        title: `${target.name} 예산을 ${Math.round(ops.increaseStep * 100)}% 올리세요`,
        evidence: {
          지출: Math.round(insight.spend),
          전환: insight.results,
          ROAS: Number(roas.toFixed(2)),
          손익분기: Number(breakEven.toFixed(2)),
          마지막_조정_후: `${Math.round(changed)}일`,
        },
        effect: { kind: 'budget', from: target.budget, to: next },
        confident: insight.spend >= minSpend,
        needsApproval:
          next - target.budget >= ops.approvalAmountWon || ops.increaseStep > ops.dailyIncreaseCap,
      })
    }

    // 감액 — 손익분기에 못 미치는데 이미 충분히 썼을 때
    if (roas < breakEven && insight.spend >= minSpend * 3) {
      const next = Math.round(target.budget * (1 - ops.decreaseStep))
      out.push({
        kind: 'decrease',
        targetLevel: target.level,
        targetId: target.id,
        targetName: target.name,
        title: `${target.name} 예산을 ${Math.round(ops.decreaseStep * 100)}% 줄이고 새 소재를 넣으세요`,
        evidence: {
          지출: Math.round(insight.spend),
          전환: insight.results,
          ROAS: Number(roas.toFixed(2)),
          손익분기: Number(breakEven.toFixed(2)),
        },
        effect: { kind: 'budget', from: target.budget, to: next },
        confident: true,
        needsApproval: false,
      })
    }
  }

  // ── 광고 단위 ──
  const testSets = new Set(ops.testAdSetIds)

  for (const row of rows) {
    const { ad, insight } = row
    const roas = metaRoas(insight)
    const inTestSet = testSets.has(ad.adsetId)

    // OFF — 쓸 만큼 썼는데 본전도 못 뽑을 때
    if (insight.spend >= minSpend && roas < 1.0) {
      out.push({
        kind: 'off',
        targetLevel: 'ad',
        targetId: ad.id,
        targetName: ad.name,
        title: `${ad.name} 을 끄세요 — 쓴 돈도 못 벌고 있습니다`,
        evidence: {
          지출: Math.round(insight.spend),
          매출: Math.round(insight.revenue),
          전환: insight.results,
          ROAS: Number(roas.toFixed(2)),
        },
        effect: { kind: 'status', to: 'PAUSED' },
        confident: true,
        needsApproval: false,
      })
      continue
    }

    // 승격 — 테스트 세트에서 충분히 검증됐을 때
    if (inTestSet && insight.spend >= minSpend && roas >= breakEven) {
      out.push({
        kind: 'promote',
        targetLevel: 'ad',
        targetId: ad.id,
        targetName: ad.name,
        title: `${ad.name} 을 본 캠페인으로 올리세요`,
        evidence: {
          지출: Math.round(insight.spend),
          전환: insight.results,
          ROAS: Number(roas.toFixed(2)),
          손익분기: Number(breakEven.toFixed(2)),
        },
        effect: null,
        confident: true,
        needsApproval: false,
      })
    }

    // 테스트 증량 — 아직 덜 썼는데 성적이 좋을 때
    if (!inTestSet && insight.spend < minSpend && insight.spend > 0 && roas >= breakEven) {
      out.push({
        kind: 'scaleTest',
        targetLevel: 'ad',
        targetId: ad.id,
        targetName: ad.name,
        title: `${ad.name} 을 테스트 세트로 복제해 더 태워보세요`,
        evidence: {
          지출: Math.round(insight.spend),
          판단_최소_지출: minSpend,
          ROAS: Number(roas.toFixed(2)),
        },
        effect: null,
        confident: false,
        needsApproval: false,
      })
    }

    // 교체 후보 — 켜져 있는데 메타가 거의 고르지 않는 것
    if (
      ad.status === 'ACTIVE' &&
      daysSince(ad.createdAt) >= ops.judgeDays &&
      insight.spend < minSpend * 0.25
    ) {
      out.push({
        kind: 'replace',
        targetLevel: 'ad',
        targetId: ad.id,
        targetName: ad.name,
        title: `${ad.name} 은 메타가 고르지 않습니다 — 끄고 새 소재로 바꾸세요`,
        evidence: {
          지출: Math.round(insight.spend),
          기준: Math.round(minSpend * 0.25),
          켜진_지: `${Math.round(daysSince(ad.createdAt))}일`,
        },
        effect: { kind: 'status', to: 'PAUSED' },
        confident: false,
        needsApproval: false,
      })
    }

    // 피로도 — 같은 사람에게 반복 노출되며 클릭이 계속 떨어질 때
    if (insight.spend >= minSpend && isFatigued(input.daily, ad.id)) {
      out.push({
        kind: 'fatigue',
        targetLevel: 'ad',
        targetId: ad.id,
        targetName: ad.name,
        title: `${ad.name} 이 지쳤습니다 — 같은 사람에게 반복 노출되며 클릭이 떨어집니다`,
        evidence: {
          지출: Math.round(insight.spend),
          빈도: Number((insight.reach > 0 ? insight.impressions / insight.reach : 0).toFixed(2)),
          CTR: Number(metaCtr(insight).toFixed(2)),
        },
        effect: null,
        confident: true,
        needsApproval: false,
      })
    }
  }

  // ── 공구 영상 활용 ──
  // 공구가 끝나면 그때 만들어진 영상이 남는다. 파트너십 광고로 돌리면
  // 이미 반응이 검증된 소재를 새로 만드는 비용 없이 쓸 수 있다.
  if (phase.kind === 'justEnded') {
    const ugcLive = rows.filter((row) => row.ad.isPartnership && row.ad.status === 'ACTIVE').length
    out.push({
      kind: 'marketUgc',
      targetLevel: 'adset',
      targetId: phase.market.collabId,
      targetName: phase.market.sellerName,
      title: `${phase.market.sellerName} 공구 영상을 파트너십 광고로 올리세요`,
      evidence: {
        공구_종료: phase.market.end,
        지난_날: `${phase.daysSince}일`,
        지금_켜진_파트너십_광고: ugcLive,
      },
      effect: null,
      confident: true,
      needsApproval: false,
    })
  }

  // ── 세트 소재 부족 ──
  for (const set of adsets) {
    const live = ads.filter((ad) => ad.adsetId === set.id && ad.status === 'ACTIVE').length
    if (live > 0 && live < ops.minAdsPerAdSet) {
      out.push({
        kind: 'thinAdSet',
        targetLevel: 'adset',
        targetId: set.id,
        targetName: set.name,
        title: `${set.name} 에 켜진 소재가 ${live}개뿐입니다 — 더 넣으세요`,
        evidence: { 켜진_소재: live },
        effect: null,
        confident: true,
        needsApproval: false,
      })
    }
  }

  return out.sort(
    (a, b) =>
      RULE_ORDER[a.kind] - RULE_ORDER[b.kind] ||
      Number(b.confident) - Number(a.confident) ||
      a.targetName.localeCompare(b.targetName),
  )
}

/**
 * 지쳤는가 — 빈도가 오르면서 CTR이 사흘 연속 떨어졌는가.
 * 둘 중 하나만으로는 판단하지 않는다. 빈도만 오르는 것은 예산을 늘렸을 때도 생기고,
 * CTR만 떨어지는 것은 계절이나 경쟁 때문일 수 있다.
 */
export function isFatigued(daily: MetaDayPoint[], adId: string): boolean {
  const days = daily
    .filter((point) => point.adId === adId && excludeToday(point.day))
    .sort((a, b) => a.day.localeCompare(b.day))
  if (days.length < 4) return false

  const last4 = days.slice(-4)
  const ctrFalling =
    last4[1].ctr < last4[0].ctr && last4[2].ctr < last4[1].ctr && last4[3].ctr < last4[2].ctr
  const frequencyRising = last4[3].frequency > last4[0].frequency
  return ctrFalling && frequencyRising
}

/**
 * 제안이 하나도 없을 때 왜 없는지 (7-2).
 * "없음"만 보여주면 규칙이 도는 건지 고장인지 알 수 없다.
 */
export function whyEmpty(input: RuleInput): string {
  const total = sumInsights(
    input.rows.map((row) => ({ level: 'ad' as const, id: row.ad.id, ...row.insight })),
  )
  if (input.rows.length === 0) return '판단 기간에 돌아간 광고가 없습니다.'
  if (total.spend < input.minSpend) {
    return `판단 기간 지출이 ${Math.round(total.spend).toLocaleString()}원으로, 판단 최소 지출 ${input.minSpend.toLocaleString()}원에 못 미칩니다.`
  }
  const best = Math.max(0, ...input.campaignInsights.map(metaRoas))
  if (best < input.breakEven * 1.2) {
    return `손익분기(${input.breakEven.toFixed(2)})를 넉넉히 넘는 캠페인이 없어 증액 제안이 없습니다. 가장 높은 캠페인이 ${best.toFixed(2)}입니다.`
  }
  return '지금 기준으로는 손댈 것이 없습니다.'
}

/** 실행 결과를 나중에 재서 판정한다 (7-4) */
export function judgeOutcome(
  kind: RuleKind,
  before: { roas: number; cpa: number; spend: number },
  after: { roas: number; cpa: number; spend: number },
): '개선' | '악화' | '판단 불가' {
  // 쓴 돈이 너무 적으면 비교해봐야 의미가 없다
  if (after.spend <= 0) return '판단 불가'
  if (kind === 'off' || kind === 'replace') {
    // 끈 것은 그 광고가 아니라 계정 전체가 나아졌는지로 봐야 한다 — 여기서는 판단하지 않는다
    return '판단 불가'
  }
  const change = before.roas > 0 ? (after.roas - before.roas) / before.roas : 0
  if (Math.abs(change) < 0.05) return '판단 불가'
  return change > 0 ? '개선' : '악화'
}

export const metaCpaOf = metaCostPerResult
