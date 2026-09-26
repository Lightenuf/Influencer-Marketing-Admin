import { slotOfRatio, type PlacementSlot } from '@/data/metaTypes'
import type { AdCopy, CreativeDraft } from '@/data/studioRepository'
import { buildAdName, randomShortId } from '@/utils/adNameParser'
import { RATIOS, type RatioKey } from './templates'

/**
 * 승인한 조합을 업로드로 가져올 때 광고 이름을 짓는 규칙.
 *
 * 성과 분석은 광고 이름을 읽어 앵글·훅·포맷으로 나눈다. 그래서 이름을
 * 아무렇게나 지으면 새로 만든 광고가 전부 '미분류'로 남는다.
 */

/** 스튜디오에서 만든 소재는 정지 이미지다 */
const STUDIO_FORMAT = '지면'
const STUDIO_SOURCE = 'DA(자체 제작)'

/** 같은 카피·이미지·템플릿이면 비율만 다른 것이다 */
export const groupKey = (draft: CreativeDraft) =>
  `${draft.copyId}_${draft.assetId}_${draft.templateKey}`

/** 이 비율이 피드에 놓이는지 스토리에 놓이는지 */
export function slotOf(ratio: string): PlacementSlot {
  const size = RATIOS[ratio as RatioKey]
  return size ? slotOfRatio(size.width, size.height) : 'feed'
}

/**
 * 조합마다 꼬리표를 나눠준다. 꼬리표가 같으면 이름이 같아져 한 광고로 묶인다.
 *
 * 한 광고 안에서는 노출 자리가 겹칠 수 없다. 1:1과 9:16은 피드·스토리로 갈리니
 * 묶어도 되지만, 1:1과 4:5는 둘 다 피드라 묶으면 올리지 못하고 막힌다.
 * 그래서 자리가 겹치면 꼬리표를 새로 만들어 다른 광고가 되게 한다.
 */
export function assignTails(
  drafts: CreativeDraft[],
  makeTail: () => string = randomShortId,
): Map<string, string> {
  const buckets = new Map<string, { tail: string; slots: Set<PlacementSlot> }[]>()
  const out = new Map<string, string>()

  for (const draft of drafts) {
    const key = groupKey(draft)
    const slot = slotOf(draft.ratio)
    const list = buckets.get(key) ?? []
    let bucket = list.find((item) => !item.slots.has(slot))
    if (!bucket) {
      bucket = { tail: makeTail(), slots: new Set() }
      list.push(bucket)
      buckets.set(key, list)
    }
    bucket.slots.add(slot)
    out.set(draft.id, bucket.tail)
  }
  return out
}

/** 이름에서 태그를 읽어내므로, 만들 때부터 규칙에 맞춰 짓는다 */
export function nameFor(copy: AdCopy, shortId: string): string {
  return buildAdName({
    source: STUDIO_SOURCE,
    angle: copy.angle,
    hook: copy.hook,
    format: STUDIO_FORMAT,
    shortId,
  })
}
