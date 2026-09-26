/**
 * 미리보기 모드에서 쓰는 태그 초깃값.
 *
 * `supabase/migrations/0032_ad_tags.sql` 의 초깃값과 같아야 한다 —
 * 미리보기에서 본 선택지가 실제와 다르면 화면을 믿을 수 없게 된다.
 */

import type { NameAlias, TagDimension, TagOption } from './adTypes'

const option = (dimension: string, label: string, sortOrder: number): TagOption => ({
  id: `${dimension}:${label}`,
  dimension: dimension as TagDimension,
  label,
  sortOrder,
  active: true,
})

export const DEMO_TAG_OPTIONS: TagOption[] = [
  option('source', 'DA(자체 제작)', 1),
  option('source', 'UGC(파트너십)', 2),
  option('source', 'UGC(일반)', 3),
  option('format', '지면', 1),
  option('format', '영상', 2),
  option('format', '반반', 3),
  option('format', '캐러셀', 4),
  option('angle', '원료·성분(투명성)', 1),
  option('angle', '식이섬유', 2),
  option('angle', '맛', 3),
  option('angle', '할인·오퍼', 4),
  option('angle', '권위(유통·입점)', 5),
  option('angle', '상황·고민', 6),
  option('angle', '다이어트', 7),
  option('angle', '가족', 8),
  option('angle', '창업자·브랜드', 9),
  option('angle', '트렌드', 10),
  option('angle', '제품 소개', 11),
  option('hook', '질문', 1),
  option('hook', '숫자', 2),
  option('hook', '반전', 3),
  option('hook', '고백', 4),
  option('hook', '비교', 5),
  option('segment', '결혼·출산', 1),
  option('segment', '육아', 2),
  option('segment', '다이어트', 3),
  option('segment', '40대 중후반', 4),
  option('segment', '전체', 5),
  option('offer', '없음', 1),
  option('offer', '% 할인', 2),
  option('offer', '쿠폰팩', 3),
  option('offer', '무료배송', 4),
  option('offer', '기타', 5),
]

const alias = (dimension: string, token: string, label: string): NameAlias => ({
  id: `${dimension}:${token}`,
  dimension,
  token,
  label,
})

export const DEMO_NAME_ALIASES: NameAlias[] = [
  alias('angle', '원료', '원료·성분(투명성)'),
  alias('angle', '성분', '원료·성분(투명성)'),
  alias('angle', '클린성분', '원료·성분(투명성)'),
  alias('angle', '식이섬유', '식이섬유'),
  alias('angle', '맛', '맛'),
  alias('angle', '할인', '할인·오퍼'),
  alias('angle', '오퍼', '할인·오퍼'),
  alias('angle', '쿠폰', '할인·오퍼'),
  alias('angle', '국내최초', '권위(유통·입점)'),
  alias('angle', '권위', '권위(유통·입점)'),
  alias('angle', '입점', '권위(유통·입점)'),
  alias('angle', '유통', '권위(유통·입점)'),
  alias('angle', '약국', '권위(유통·입점)'),
  alias('angle', '상황', '상황·고민'),
  alias('angle', '고민', '상황·고민'),
  alias('angle', '다이어트', '다이어트'),
  alias('angle', '식단', '다이어트'),
  alias('angle', '가족', '가족'),
  alias('angle', '엄마', '가족'),
  alias('angle', '육아', '가족'),
  alias('angle', '창업자', '창업자·브랜드'),
  alias('angle', '브랜드', '창업자·브랜드'),
  alias('angle', '트렌드', '트렌드'),
  alias('angle', '세대', '트렌드'),
  alias('angle', '제품소개', '제품 소개'),
  alias('angle', '스팩소개', '제품 소개'),
  alias('angle', '레시피', '제품 소개'),
  alias('format', '지면', '지면'),
  alias('format', '영상', '영상'),
  alias('format', '반반', '반반'),
  alias('format', '캐러셀', '캐러셀'),
  alias('hook', '질문', '질문'),
  alias('hook', '숫자', '숫자'),
  alias('hook', '반전', '반전'),
  alias('hook', '고백', '고백'),
  alias('hook', '비교', '비교'),
]
