import type { MetaAd } from '@/data/metaTypes'
import { normalizeName } from './adNameParser'

/**
 * 같은 소재를 알아보는 열쇠 (5-4).
 *
 * 같은 소재가 여러 광고 세트에 복제돼 있다. 광고 단위로 세면 하나의 소재가
 * 여러 줄로 갈라져, 어느 소재가 좋았는지 판단할 수 없다.
 *
 * 우선순위: 이미지 해시·동영상 ID → 게시물 ID → 정규화한 이름.
 * 앞의 것일수록 확실하다. 이름은 마지막 수단이다 — 사람이 같은 이름을
 * 다른 소재에 붙였을 수 있기 때문이다.
 */
export function creativeKeyOf(ad: MetaAd): string {
  if (ad.imageHash) return `img:${ad.imageHash}`
  if (ad.videoId) return `vid:${ad.videoId}`
  if (ad.postId) return `post:${ad.postId}`
  return `name:${normalizeName(ad.name)}`
}

/** 열쇠가 같은 광고끼리 묶는다 */
export function groupByCreative(ads: MetaAd[]): Map<string, MetaAd[]> {
  const groups = new Map<string, MetaAd[]>()
  for (const ad of ads) {
    const key = creativeKeyOf(ad)
    groups.set(key, [...(groups.get(key) ?? []), ad])
  }
  return groups
}

/** 열쇠를 무엇으로 정했는지 — 화면에서 확실한 정도를 보여줄 때 쓴다 */
export function keyConfidence(key: string): '확실' | '보통' | '이름으로 추정' {
  if (key.startsWith('img:') || key.startsWith('vid:')) return '확실'
  if (key.startsWith('post:')) return '보통'
  return '이름으로 추정'
}
