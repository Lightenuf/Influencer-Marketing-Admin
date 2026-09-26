import { supabase } from '@/lib/supabase'

/**
 * 소재 창구 — 에셋·카피·조합.
 *
 * 이미지 원본은 Supabase 스토리지(`ad_assets` 버킷)에 두고, 표에는 경로만 적는다.
 */

export interface AdAsset {
  id: string
  path: string
  fileName: string
  width: number
  height: number
  product: string
  scene: string
  tone: string
  ratio: string
  origin: string
  status: string
  memo: string
  createdAt: string
}

export interface AdCopy {
  id: string
  headline: string
  subhead: string
  badge: string
  body: string
  linkTitle: string
  segment: string
  angle: string
  hook: string
  offerType: string
  offerValue: string
  source: string
  status: string
  rejectReason: string
  flags: { level: string; field: string; message: string }[]
  createdAt: string
}

export interface CreativeDraft {
  id: string
  copyId: string
  assetId: string
  templateKey: string
  ratio: string
  renderedPath: string
  status: string
  rejectReason: string
  uploadedAdId: string
  createdAt: string
}

export interface StudioRepository {
  listAssets(): Promise<AdAsset[]>
  /** 파일을 보관함에 올리고 표에 적는다 */
  addAsset(file: File, meta: Partial<AdAsset>, actorId: string): Promise<AdAsset>
  updateAsset(id: string, patch: Partial<AdAsset>): Promise<void>
  /** 화면에 보여줄 임시 주소 — 버킷이 비공개라 서명된 주소가 필요하다 */
  assetUrl(path: string): Promise<string>

  listCopies(): Promise<AdCopy[]>
  addCopies(rows: Partial<AdCopy>[], actorId: string): Promise<number>
  updateCopy(id: string, patch: Partial<AdCopy>): Promise<void>
  deleteCopy(id: string): Promise<void>

  listDrafts(): Promise<CreativeDraft[]>
  addDrafts(rows: Partial<CreativeDraft>[], actorId: string): Promise<number>
  updateDraft(id: string, patch: Partial<CreativeDraft>): Promise<void>
  /** 만들어진 이미지를 보관함에 올린다 */
  saveRendered(draftId: string, blob: Blob): Promise<string>
}

type Row = Record<string, unknown>

const requireDb = () => {
  if (!supabase) throw new Error('로그인 정보가 없습니다. 다시 로그인해주세요.')
  return supabase
}

const BUCKET = 'ad_assets'

const toAsset = (row: Row): AdAsset => ({
  id: String(row.id),
  path: String(row.path),
  fileName: String(row.file_name ?? ''),
  width: Number(row.width ?? 0),
  height: Number(row.height ?? 0),
  product: String(row.product ?? ''),
  scene: String(row.scene ?? ''),
  tone: String(row.tone ?? ''),
  ratio: String(row.ratio ?? ''),
  origin: String(row.origin ?? ''),
  status: String(row.status ?? 'active'),
  memo: String(row.memo ?? ''),
  createdAt: String(row.created_at),
})

const toCopy = (row: Row): AdCopy => ({
  id: String(row.id),
  headline: String(row.headline ?? ''),
  subhead: String(row.subhead ?? ''),
  badge: String(row.badge ?? ''),
  body: String(row.body ?? ''),
  linkTitle: String(row.link_title ?? ''),
  segment: String(row.segment ?? ''),
  angle: String(row.angle ?? ''),
  hook: String(row.hook ?? ''),
  offerType: String(row.offer_type ?? '없음'),
  offerValue: String(row.offer_value ?? ''),
  source: String(row.source ?? 'manual'),
  status: String(row.status ?? 'draft'),
  rejectReason: String(row.reject_reason ?? ''),
  flags: (row.flags as AdCopy['flags']) ?? [],
  createdAt: String(row.created_at),
})

const toDraft = (row: Row): CreativeDraft => ({
  id: String(row.id),
  copyId: String(row.copy_id ?? ''),
  assetId: String(row.asset_id ?? ''),
  templateKey: String(row.template_key ?? ''),
  ratio: String(row.ratio ?? ''),
  renderedPath: String(row.rendered_path ?? ''),
  status: String(row.status ?? 'draft'),
  rejectReason: String(row.reject_reason ?? ''),
  uploadedAdId: String(row.uploaded_ad_id ?? ''),
  createdAt: String(row.created_at),
})

/** 화면 이름 → DB 칸 이름 */
const columns: Record<string, string> = {
  fileName: 'file_name',
  linkTitle: 'link_title',
  offerType: 'offer_type',
  offerValue: 'offer_value',
  rejectReason: 'reject_reason',
  copyId: 'copy_id',
  assetId: 'asset_id',
  templateKey: 'template_key',
  renderedPath: 'rendered_path',
  uploadedAdId: 'uploaded_ad_id',
}

const toRow = (patch: Record<string, unknown>): Row => {
  const row: Row = {}
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue
    if (['id', 'createdAt'].includes(key)) continue
    row[columns[key] ?? key] = value as Row[string]
  }
  return row
}

const supabaseStudio: StudioRepository = {
  async listAssets() {
    const db = requireDb()
    const { data, error } = await db
      .from('ad_assets')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) throw new Error(error.message)
    return (data ?? []).map(toAsset)
  },

  async addAsset(file, meta, actorId) {
    const db = requireDb()
    const path = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
    const { error: upError } = await db.storage.from(BUCKET).upload(path, file)
    if (upError) throw new Error(upError.message)

    const { data, error } = await db
      .from('ad_assets')
      .insert({ path, file_name: file.name, created_by: actorId, ...toRow(meta) })
      .select()
      .single()
    if (error) throw new Error(error.message)
    return toAsset(data as Row)
  },

  async updateAsset(id, patch) {
    const db = requireDb()
    const { error } = await db.from('ad_assets').update(toRow(patch)).eq('id', id)
    if (error) throw new Error(error.message)
  },

  async assetUrl(path) {
    const db = requireDb()
    const { data, error } = await db.storage.from(BUCKET).createSignedUrl(path, 60 * 60)
    if (error) throw new Error(error.message)
    return data.signedUrl
  },

  async listCopies() {
    const db = requireDb()
    const { data, error } = await db
      .from('ad_copies')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) throw new Error(error.message)
    return (data ?? []).map(toCopy)
  },

  async addCopies(rows, actorId) {
    const db = requireDb()
    const { error } = await db
      .from('ad_copies')
      .insert(rows.map((row) => ({ created_by: actorId, ...toRow(row) })))
    if (error) throw new Error(error.message)
    return rows.length
  },

  async updateCopy(id, patch) {
    const db = requireDb()
    const { error } = await db.from('ad_copies').update(toRow(patch)).eq('id', id)
    if (error) throw new Error(error.message)
  },

  async deleteCopy(id) {
    const db = requireDb()
    const { error } = await db.from('ad_copies').delete().eq('id', id)
    if (error) throw new Error(error.message)
  },

  async listDrafts() {
    const db = requireDb()
    const { data, error } = await db
      .from('creative_drafts')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) throw new Error(error.message)
    return (data ?? []).map(toDraft)
  },

  async addDrafts(rows, actorId) {
    const db = requireDb()
    const { error } = await db
      .from('creative_drafts')
      .insert(rows.map((row) => ({ created_by: actorId, ...toRow(row) })))
    if (error) throw new Error(error.message)
    return rows.length
  },

  async updateDraft(id, patch) {
    const db = requireDb()
    const { error } = await db.from('creative_drafts').update(toRow(patch)).eq('id', id)
    if (error) throw new Error(error.message)
  },

  async saveRendered(draftId, blob) {
    const db = requireDb()
    const path = `rendered/${draftId}.png`
    const { error: upError } = await db.storage
      .from(BUCKET)
      .upload(path, blob, { upsert: true, contentType: 'image/png' })
    if (upError) throw new Error(upError.message)
    const { error } = await db
      .from('creative_drafts')
      .update({ rendered_path: path })
      .eq('id', draftId)
    if (error) throw new Error(error.message)
    return path
  },
}

// ── 미리보기 모드 ──
// 파일은 브라우저 메모리에만 둔다. 새로고침하면 사라진다.

const mem = {
  assets: [] as AdAsset[],
  copies: [] as AdCopy[],
  drafts: [] as CreativeDraft[],
  files: new Map<string, string>(),
}

const tick = <T>(value: T) => new Promise<T>((resolve) => setTimeout(() => resolve(value), 60))

const mockStudio: StudioRepository = {
  async listAssets() {
    return tick(mem.assets)
  },

  async addAsset(file, meta, _actorId) {
    const path = `local/${crypto.randomUUID()}`
    mem.files.set(path, URL.createObjectURL(file))
    const made: AdAsset = {
      id: crypto.randomUUID(),
      path,
      fileName: file.name,
      width: meta.width ?? 0,
      height: meta.height ?? 0,
      product: meta.product ?? '',
      scene: meta.scene ?? '',
      tone: meta.tone ?? '',
      ratio: meta.ratio ?? '',
      origin: meta.origin ?? '힘스필드',
      status: 'active',
      memo: '',
      createdAt: new Date().toISOString(),
    }
    mem.assets = [made, ...mem.assets]
    return tick(made)
  },

  async updateAsset(id, patch) {
    mem.assets = mem.assets.map((row) => (row.id === id ? { ...row, ...patch } : row))
  },

  async assetUrl(path) {
    return tick(mem.files.get(path) ?? '')
  },

  async listCopies() {
    return tick(mem.copies)
  },

  async addCopies(rows, _actorId) {
    const made = rows.map((row) => ({
      id: crypto.randomUUID(),
      headline: '',
      subhead: '',
      badge: '',
      body: '',
      linkTitle: '',
      segment: '',
      angle: '',
      hook: '',
      offerType: '없음',
      offerValue: '',
      source: 'manual',
      status: 'draft',
      rejectReason: '',
      flags: [],
      createdAt: new Date().toISOString(),
      ...row,
    })) as AdCopy[]
    mem.copies = [...made, ...mem.copies]
    return tick(made.length)
  },

  async updateCopy(id, patch) {
    mem.copies = mem.copies.map((row) => (row.id === id ? { ...row, ...patch } : row))
  },

  async deleteCopy(id) {
    mem.copies = mem.copies.filter((row) => row.id !== id)
  },

  async listDrafts() {
    return tick(mem.drafts)
  },

  async addDrafts(rows, _actorId) {
    const made = rows.map((row) => ({
      id: crypto.randomUUID(),
      copyId: '',
      assetId: '',
      templateKey: '',
      ratio: '',
      renderedPath: '',
      status: 'draft',
      rejectReason: '',
      uploadedAdId: '',
      createdAt: new Date().toISOString(),
      ...row,
    })) as CreativeDraft[]
    mem.drafts = [...made, ...mem.drafts]
    return tick(made.length)
  },

  async updateDraft(id, patch) {
    mem.drafts = mem.drafts.map((row) => (row.id === id ? { ...row, ...patch } : row))
  },

  async saveRendered(draftId, blob) {
    const path = `local/rendered/${draftId}`
    mem.files.set(path, URL.createObjectURL(blob))
    mem.drafts = mem.drafts.map((row) =>
      row.id === draftId ? { ...row, renderedPath: path } : row,
    )
    return tick(path)
  },
}

export const studioRepository: StudioRepository = supabase === null ? mockStudio : supabaseStudio
