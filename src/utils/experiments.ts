import { metaCostPerResult, metaRoas, sumInsights } from '@/data/metaTypes'
import type { AdRow } from './adAggregate'

/**
 * 실험 집계와 판정 (9-2).
 *
 * 메타는 소재별로 예산을 고르게 나누지 않는다. 한 값에만 돈이 몰리면
 * 그 값이 좋아 보이게 된다. 그래서 값별 지출 비중을 늘 같이 보여준다.
 */

export const VARIABLES = ['angle', 'hook', 'format', 'offer', 'segment'] as const
export type Variable = (typeof VARIABLES)[number]

export const VARIABLE_LABELS: Record<Variable, string> = {
  angle: '앵글',
  hook: '훅',
  format: '포맷',
  offer: '오퍼',
  segment: '세그먼트',
}

export type Verdict = 'win' | 'lose' | 'inconclusive' | ''

export interface VariantResult {
  value: string
  ads: number
  spend: number
  revenue: number
  results: number
  roas: number
  cpa: number
  /** 전체 지출에서 이 값이 가져간 몫 */
  spendShare: number
  /** 판단 최소 지출을 넘겼나 */
  enough: boolean
}

export interface ExperimentResult {
  variants: VariantResult[]
  totalSpend: number
  /** 이겼다고 본 값 */
  winner: string
  verdict: Verdict
  /** 왜 그렇게 판정했는지 한 줄 */
  why: string
}

/**
 * 실험 하나를 집계한다.
 *
 * 값별로 합쳐서 견준다. 광고 하나하나를 견주지 않는 이유는,
 * 같은 값에 속한 소재가 여러 개일 때 그중 하나가 튀면 값 전체를 오해하게 되기 때문이다.
 */
export function scoreExperiment(
  rows: AdRow[],
  variable: Variable,
  variants: string[],
  metric: 'roas' | 'cpa',
  minSpend: number,
  target: number | null,
  finished: boolean,
): ExperimentResult {
  const byValue = new Map<string, AdRow[]>()
  for (const value of variants) byValue.set(value, [])
  for (const row of rows) {
    const value = row.tags?.[variable] ?? ''
    if (byValue.has(value)) byValue.get(value)!.push(row)
  }

  const totalSpend = rows.reduce((sum, row) => sum + row.insight.spend, 0)

  const results: VariantResult[] = variants.map((value) => {
    const list = byValue.get(value) ?? []
    const insight = sumInsights(
      list.map((row) => ({ level: 'ad' as const, id: row.ad.id, ...row.insight })),
    )
    return {
      value,
      ads: list.length,
      spend: insight.spend,
      revenue: insight.revenue,
      results: insight.results,
      roas: metaRoas(insight),
      cpa: metaCostPerResult(insight),
      spendShare: totalSpend > 0 ? insight.spend / totalSpend : 0,
      enough: insight.spend >= minSpend,
    }
  })

  // 높을수록 좋은 것(ROAS)과 낮을수록 좋은 것(CPA)을 갈라 본다
  const ranked = [...results].sort((a, b) =>
    metric === 'roas' ? b.roas - a.roas : (a.cpa || Infinity) - (b.cpa || Infinity),
  )
  const best = ranked[0]
  const notEnough = results.filter((row) => !row.enough)

  if (!finished) {
    return {
      variants: results,
      totalSpend,
      winner: '',
      verdict: '',
      why: notEnough.length
        ? `아직 도는 중입니다. ${notEnough.map((row) => row.value).join(', ')} 이(가) 최소 지출에 못 미칩니다.`
        : '아직 도는 중입니다. 기간이 끝나면 판정합니다.',
    }
  }

  // 기간이 끝났는데 덜 쓴 값이 있으면 견줄 수 없다
  if (notEnough.length > 0) {
    return {
      variants: results,
      totalSpend,
      winner: '',
      verdict: 'inconclusive',
      why: `${notEnough.map((row) => row.value).join(', ')} 이(가) 값별 최소 지출 ${minSpend.toLocaleString()}원에 못 미쳐 견줄 수 없습니다. 기간을 늘리거나 예산을 올려주세요.`,
    }
  }

  // 기준값을 정해 뒀으면 그것부터 본다
  if (target != null) {
    const passed = metric === 'roas' ? best.roas >= target : best.cpa > 0 && best.cpa <= target
    return {
      variants: results,
      totalSpend,
      winner: passed ? best.value : '',
      verdict: passed ? 'win' : 'lose',
      why: passed
        ? `${best.value} 이(가) 기준(${metric === 'roas' ? 'ROAS' : 'CPA'} ${target})을 넘었습니다.`
        : `어느 값도 기준(${metric === 'roas' ? 'ROAS' : 'CPA'} ${target})을 넘지 못했습니다.`,
    }
  }

  // 기준값이 없으면 값끼리 견준다. 차이가 작으면 우연일 수 있다
  const second = ranked[1]
  const gap =
    metric === 'roas'
      ? second && second.roas > 0
        ? (best.roas - second.roas) / second.roas
        : 1
      : second && best.cpa > 0
        ? (second.cpa - best.cpa) / best.cpa
        : 1

  if (gap < 0.15) {
    return {
      variants: results,
      totalSpend,
      winner: '',
      verdict: 'inconclusive',
      why: `1등과 2등 차이가 ${Math.round(gap * 100)}%로 작습니다. 우연일 수 있어 판정하지 않습니다.`,
    }
  }

  return {
    variants: results,
    totalSpend,
    winner: best.value,
    verdict: 'win',
    why: `${best.value} 이(가) 2등보다 ${Math.round(gap * 100)}% 낫습니다.`,
  }
}

/** 값별 최소 지출 — 실험에 따로 적지 않았으면 운영 기준을 쓴다 */
export const minSpendOf = (experiment: { minSpend: number }, fallback: number) =>
  experiment.minSpend > 0 ? experiment.minSpend : fallback

/**
 * 전환 수가 적어 통계적 유의성을 말하기 어렵다.
 * 참고용으로 '얼마나 믿을 만한가'만 거칠게 보여준다 (9-2).
 */
export function confidenceHint(variants: VariantResult[]): string {
  const total = variants.reduce((sum, row) => sum + row.results, 0)
  if (total < 10) return '전환이 너무 적어 참고만 하세요'
  if (total < 30) return '전환이 적은 편입니다 — 방향만 보세요'
  return '전환 수가 견줄 만합니다'
}

/** 지출이 한쪽으로 쏠렸는지 — 메타가 고르게 나누지 않았다는 뜻이다 */
export function isSkewed(variants: VariantResult[]): boolean {
  if (variants.length < 2) return false
  const shares = variants.map((row) => row.spendShare)
  return Math.max(...shares) > 0.7
}
