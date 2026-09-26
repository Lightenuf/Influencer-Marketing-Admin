import { supabase } from '@/lib/supabase'
import type {
  AdTags,
  AdTagsInput,
  NameAlias,
  OpsSettings,
  TagDimension,
  TagOption,
} from './adTypes'
import { DEFAULT_OPS } from './adTypes'

/**
 * 퍼포먼스 태그·운영 기준 창구.
 *
 * 인플루언서·CRM이 쓰는 `repository`와 따로 둔다.
 * 퍼포먼스 작업이 그쪽 파일을 건드리지 않게 하기 위함이다.
 */
export interface AdTagRepository {
  listTagOptions(): Promise<TagOption[]>
  addTagOption(dimension: TagDimension, label: string): Promise<void>
  setTagOptionActive(id: string, active: boolean): Promise<void>

  listNameAliases(): Promise<NameAlias[]>
  addNameAlias(dimension: string, token: string, label: string): Promise<void>
  removeNameAlias(id: string): Promise<void>

  listAdTags(): Promise<AdTags[]>
  /** 여러 광고의 태그를 한 번에 저장한다. 일괄 태깅에서 쓴다 */
  saveAdTags(rows: (AdTagsInput & { adId: string })[], actorId: string): Promise<number>

  getOpsSettings(): Promise<OpsSettings>
  saveOpsSettings(patch: Partial<OpsSettings>): Promise<void>

  /**
   * 자사몰 실매출 — MER과 신규 구매 비중에 쓴다.
   * 메타가 말하는 매출은 메타 기준이라, 실제로 번 돈은 주문에서 직접 센다.
   */
  getShopRevenue(from: string, to: string): Promise<ShopRevenue>
}

export interface ShopRevenue {
  revenue: number
  orders: number
  buyers: number
  newOrders: number
  newRevenue: number
  syncedAt: string | null
}

type Row = Record<string, unknown>

const requireDb = () => {
  if (!supabase) throw new Error('로그인 정보가 없습니다. 다시 로그인해주세요.')
  return supabase
}

const toTags = (row: Row): AdTags => ({
  adId: String(row.ad_id),
  accountId: String(row.account_id ?? ''),
  creativeKey: String(row.creative_key ?? ''),
  source: String(row.source ?? ''),
  format: String(row.format ?? ''),
  angle: String(row.angle ?? ''),
  hook: String(row.hook ?? ''),
  segment: String(row.segment ?? ''),
  offer: String(row.offer ?? ''),
  landing: String(row.landing ?? ''),
  creatorId: (row.creator_id as string) ?? null,
  assetId: (row.asset_id as string) ?? null,
  copyId: (row.copy_id as string) ?? null,
  templateId: (row.template_id as string) ?? null,
  experimentId: (row.experiment_id as string) ?? null,
  taggedFrom: String(row.tagged_from ?? 'manual'),
  updatedAt: String(row.updated_at ?? ''),
})

/** 화면이 쓰는 이름을 DB 칸 이름으로 바꾼다 */
const toRow = (input: AdTagsInput): Row => {
  const map: Record<string, string> = {
    accountId: 'account_id',
    creativeKey: 'creative_key',
    source: 'source',
    format: 'format',
    angle: 'angle',
    hook: 'hook',
    segment: 'segment',
    offer: 'offer',
    landing: 'landing',
    creatorId: 'creator_id',
    assetId: 'asset_id',
    copyId: 'copy_id',
    templateId: 'template_id',
    experimentId: 'experiment_id',
    taggedFrom: 'tagged_from',
  }
  const row: Row = {}
  for (const [key, column] of Object.entries(map)) {
    const value = (input as Record<string, unknown>)[key]
    if (value !== undefined) row[column] = value
  }
  return row
}

const supabaseAdTags: AdTagRepository = {
  async listTagOptions() {
    const db = requireDb()
    const { data, error } = await db
      .from('ad_tag_options')
      .select('*')
      .order('dimension')
      .order('sort_order')
    if (error) throw new Error(error.message)
    return (data ?? []).map((row: Row) => ({
      id: String(row.id),
      dimension: row.dimension as TagDimension,
      label: String(row.label),
      sortOrder: Number(row.sort_order ?? 50),
      active: row.active !== false,
    }))
  },

  async addTagOption(dimension, label) {
    const db = requireDb()
    const { error } = await db
      .from('ad_tag_options')
      .upsert({ dimension, label }, { onConflict: 'dimension,label' })
    if (error) throw new Error(error.message)
  },

  async setTagOptionActive(id, active) {
    const db = requireDb()
    const { error } = await db.from('ad_tag_options').update({ active }).eq('id', id)
    if (error) throw new Error(error.message)
  },

  async listNameAliases() {
    const db = requireDb()
    const { data, error } = await db.from('ad_name_aliases').select('*').order('dimension')
    if (error) throw new Error(error.message)
    return (data ?? []).map((row: Row) => ({
      id: String(row.id),
      dimension: String(row.dimension),
      token: String(row.token),
      label: String(row.label),
    }))
  },

  async addNameAlias(dimension, token, label) {
    const db = requireDb()
    const { error } = await db
      .from('ad_name_aliases')
      .upsert({ dimension, token, label }, { onConflict: 'dimension,token' })
    if (error) throw new Error(error.message)
  },

  async removeNameAlias(id) {
    const db = requireDb()
    const { error } = await db.from('ad_name_aliases').delete().eq('id', id)
    if (error) throw new Error(error.message)
  },

  async listAdTags() {
    const db = requireDb()
    const { data, error } = await db.from('ad_tags').select('*')
    if (error) throw new Error(error.message)
    return (data ?? []).map(toTags)
  },

  async saveAdTags(rows, actorId) {
    if (rows.length === 0) return 0
    const db = requireDb()
    const { error } = await db.from('ad_tags').upsert(
      rows.map((row) => ({ ad_id: row.adId, tagged_by: actorId, ...toRow(row) })),
      { onConflict: 'ad_id' },
    )
    if (error) throw new Error(error.message)
    return rows.length
  },

  async getOpsSettings() {
    const db = requireDb()
    const { data, error } = await db.from('ops_settings').select('*')
    if (error) throw new Error(error.message)
    const ops = { ...DEFAULT_OPS } as Record<string, unknown>
    for (const row of (data ?? []) as Row[]) {
      if (row.key != null) ops[String(row.key)] = row.value
    }
    return ops as unknown as OpsSettings
  },

  async getShopRevenue(from, to) {
    const db = requireDb()
    const { data, error } = await db.rpc('shop_revenue', { from_day: from, to_day: to })
    if (error) throw new Error(error.message)
    const row = (data ?? {}) as Partial<ShopRevenue>
    return {
      revenue: row.revenue ?? 0,
      orders: row.orders ?? 0,
      buyers: row.buyers ?? 0,
      newOrders: row.newOrders ?? 0,
      newRevenue: row.newRevenue ?? 0,
      syncedAt: row.syncedAt ?? null,
    }
  },

  async saveOpsSettings(patch) {
    const db = requireDb()
    const rows = Object.entries(patch).map(([key, value]) => ({
      key,
      value: value as never,
      updated_at: new Date().toISOString(),
    }))
    if (rows.length === 0) return
    const { error } = await db.from('ops_settings').upsert(rows, { onConflict: 'key' })
    if (error) throw new Error(error.message)
  },
}

// ── 미리보기 모드 ──
// 브라우저에만 저장한다. 실제 메타 계정을 건드리지 않고 화면을 눌러볼 수 있어야 한다.

const KEY = 'breevo-ad-tags:v1'

interface LocalDb {
  options: TagOption[]
  aliases: NameAlias[]
  tags: AdTags[]
  ops: Partial<OpsSettings>
}

const readLocal = (): LocalDb => {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw) as LocalDb
  } catch {
    // 저장소를 못 읽어도 화면은 떠야 한다
  }
  return { options: [], aliases: [], tags: [], ops: {} }
}

const writeLocal = (db: LocalDb) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(db))
  } catch {
    // 사적 모드 등에서 저장이 막혀도 넘어간다
  }
}

const tick = <T>(value: T) => new Promise<T>((resolve) => setTimeout(() => resolve(value), 60))

const mockAdTags: AdTagRepository = {
  async listTagOptions() {
    const db = readLocal()
    if (db.options.length === 0) {
      const { DEMO_TAG_OPTIONS } = await import('./adDemoData')
      db.options = DEMO_TAG_OPTIONS
      writeLocal(db)
    }
    return tick(db.options)
  },

  async addTagOption(dimension, label) {
    const db = readLocal()
    if (db.options.some((o) => o.dimension === dimension && o.label === label)) return
    db.options = [
      ...db.options,
      { id: crypto.randomUUID(), dimension, label, sortOrder: 50, active: true },
    ]
    writeLocal(db)
  },

  async setTagOptionActive(id, active) {
    const db = readLocal()
    db.options = db.options.map((o) => (o.id === id ? { ...o, active } : o))
    writeLocal(db)
  },

  async listNameAliases() {
    const db = readLocal()
    if (db.aliases.length === 0) {
      const { DEMO_NAME_ALIASES } = await import('./adDemoData')
      db.aliases = DEMO_NAME_ALIASES
      writeLocal(db)
    }
    return tick(db.aliases)
  },

  async addNameAlias(dimension, token, label) {
    const db = readLocal()
    if (db.aliases.some((a) => a.dimension === dimension && a.token === token)) return
    db.aliases = [...db.aliases, { id: crypto.randomUUID(), dimension, token, label }]
    writeLocal(db)
  },

  async removeNameAlias(id) {
    const db = readLocal()
    db.aliases = db.aliases.filter((a) => a.id !== id)
    writeLocal(db)
  },

  async listAdTags() {
    return tick(readLocal().tags)
  },

  async saveAdTags(rows, _actorId) {
    const db = readLocal()
    const incoming = new Map(rows.map((row) => [row.adId, row]))
    const kept = db.tags.filter((t) => !incoming.has(t.adId))
    const made = rows.map((row) => ({
      adId: row.adId,
      accountId: row.accountId ?? '',
      creativeKey: row.creativeKey ?? '',
      source: row.source ?? '',
      format: row.format ?? '',
      angle: row.angle ?? '',
      hook: row.hook ?? '',
      segment: row.segment ?? '',
      offer: row.offer ?? '',
      landing: row.landing ?? '',
      creatorId: row.creatorId ?? null,
      assetId: row.assetId ?? null,
      copyId: row.copyId ?? null,
      templateId: row.templateId ?? null,
      experimentId: row.experimentId ?? null,
      taggedFrom: row.taggedFrom ?? 'manual',
      updatedAt: new Date().toISOString(),
    }))
    db.tags = [...kept, ...made]
    writeLocal(db)
    return tick(rows.length)
  },

  async getOpsSettings() {
    return tick({ ...DEFAULT_OPS, ...readLocal().ops })
  },

  async getShopRevenue(_from, _to) {
    // 미리보기 모드에는 주문 자료가 없다. 카드는 숨겨진다.
    return tick({
      revenue: 0,
      orders: 0,
      buyers: 0,
      newOrders: 0,
      newRevenue: 0,
      syncedAt: null,
    })
  },

  async saveOpsSettings(patch) {
    const db = readLocal()
    db.ops = { ...db.ops, ...patch }
    writeLocal(db)
  },
}

export const adTagRepository: AdTagRepository = supabase === null ? mockAdTags : supabaseAdTags
