import { requireSupabase } from '@/lib/supabase'
import type {
  CollabInput,
  DataRepository,
  DncChange,
  HoldChange,
  InfluencerInput,
  ShipmentInput,
} from './repository'
import type {
  Collab,
  CollabStage,
  CommunicationLog,
  DncAuditEntry,
  Influencer,
  ReasonTag,
  Shipment,
  TeamMember,
} from './types'

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>

const toTeamMember = (row: Row): TeamMember => ({
  id: row.id,
  email: row.email ?? '',
  displayName: row.display_name ?? row.email ?? '이름 없음',
  role: row.role === 'admin' ? 'admin' : 'member',
})

const toInfluencer = (row: Row): Influencer => ({
  id: row.id,
  name: row.name,
  snsPlatform: row.sns_platform,
  snsHandle: row.sns_handle,
  snsUrl: row.sns_url,
  followerCount: row.follower_count,
  followingCount: row.following_count ?? 0,
  categories: row.categories ?? [],
  avgRevenueBand: row.avg_revenue_band,
  contactEmail: row.contact_email,
  contactPhone: row.contact_phone,
  contactEtc: row.contact_etc,
  status: row.status,
  memo: row.memo,
  doNotContact: row.do_not_contact,
  dncReason: row.dnc_reason,
  dncSetBy: row.dnc_set_by,
  dncSetAt: row.dnc_set_at,
  createdBy: row.created_by ?? '',
  createdAt: row.created_at,
  updatedAt: row.updated_at,
})

const influencerColumns = (input: Partial<InfluencerInput>): Row => {
  const row: Row = {}
  if (input.name !== undefined) row.name = input.name
  if (input.snsPlatform !== undefined) row.sns_platform = input.snsPlatform
  if (input.snsHandle !== undefined) row.sns_handle = input.snsHandle
  if (input.snsUrl !== undefined) row.sns_url = input.snsUrl
  if (input.followerCount !== undefined) row.follower_count = input.followerCount
  if (input.followingCount !== undefined) row.following_count = input.followingCount
  if (input.categories !== undefined) row.categories = input.categories
  if (input.avgRevenueBand !== undefined) row.avg_revenue_band = input.avgRevenueBand
  if (input.contactEmail !== undefined) row.contact_email = input.contactEmail
  if (input.contactPhone !== undefined) row.contact_phone = input.contactPhone
  if (input.contactEtc !== undefined) row.contact_etc = input.contactEtc
  if (input.status !== undefined) row.status = input.status
  if (input.memo !== undefined) row.memo = input.memo
  return row
}

const toDncEntry = (row: Row): DncAuditEntry => ({
  id: row.id,
  influencerId: row.influencer_id,
  action: row.action,
  reason: row.reason,
  reasonDetail: row.reason_detail,
  setBy: row.set_by,
  setAt: row.set_at,
})

const toCollab = (row: Row): Collab => ({
  id: row.id,
  influencerId: row.influencer_id,
  title: row.title,
  collabType: row.collab_type,
  stage: row.stage,
  stageEnteredAt: row.stage_entered_at,
  startDate: row.start_date,
  endDate: row.end_date,
  sampleShipDate: row.sample_ship_date,
  contentDueDate: row.content_due_date,
  fee: row.fee,
  seedingAccepted: row.seeding_accepted ?? null,
  testFeedback: row.test_feedback,
  meetingAccepted: row.meeting_accepted ?? null,
  lastContactedAt: row.last_contacted_at,
  meetingAt: row.meeting_at,
  marketDate: row.market_date,
  marketRevenue: row.market_revenue ?? 0,
  marketUnits: row.market_units ?? 0,
  isSettled: row.is_settled ?? false,
  contentLinks: row.content_links ?? [],
  isOnHold: row.is_on_hold ?? false,
  holdReason: row.hold_reason,
  holdDetail: row.hold_detail ?? '',
  heldAt: row.held_at,
  recontactAt: row.recontact_at,
  isCancelled: row.is_cancelled,
  // 사유가 하나였던 시절의 기록도 배열로 보여준다.
  cancelReasons: row.cancel_reasons ?? (row.cancel_reason ? [row.cancel_reason] : []),
  cancelReasonDetail: row.cancel_reason_detail,
  cancelledAt: row.cancelled_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
})

const collabColumns = (input: Partial<CollabInput>): Row => {
  const row: Row = {}
  if (input.influencerId !== undefined) row.influencer_id = input.influencerId
  if (input.title !== undefined) row.title = input.title
  if (input.collabType !== undefined) row.collab_type = input.collabType
  if (input.stage !== undefined) row.stage = input.stage
  if (input.startDate !== undefined) row.start_date = input.startDate
  if (input.endDate !== undefined) row.end_date = input.endDate
  if (input.sampleShipDate !== undefined) row.sample_ship_date = input.sampleShipDate
  if (input.contentDueDate !== undefined) row.content_due_date = input.contentDueDate
  if (input.fee !== undefined) row.fee = input.fee
  if (input.seedingAccepted !== undefined) row.seeding_accepted = input.seedingAccepted
  if (input.testFeedback !== undefined) row.test_feedback = input.testFeedback
  if (input.meetingAccepted !== undefined) row.meeting_accepted = input.meetingAccepted
  if (input.lastContactedAt !== undefined) row.last_contacted_at = input.lastContactedAt
  if (input.meetingAt !== undefined) row.meeting_at = input.meetingAt
  if (input.marketDate !== undefined) row.market_date = input.marketDate
  if (input.marketRevenue !== undefined) row.market_revenue = input.marketRevenue
  if (input.marketUnits !== undefined) row.market_units = input.marketUnits
  if (input.isSettled !== undefined) row.is_settled = input.isSettled
  if (input.contentLinks !== undefined) row.content_links = input.contentLinks
  return row
}

const toShipment = (row: Row): Shipment => ({
  id: row.id,
  influencerId: row.influencer_id,
  collabId: row.collab_id,
  status: row.status,
  collabType: row.collab_type,
  productName: row.product_name,
  quantity: row.quantity,
  carrier: row.carrier,
  trackingNumber: row.tracking_number,
  requestedAt: row.requested_at,
  shippedAt: row.shipped_at,
  deliveredAt: row.delivered_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
})

const shipmentColumns = (input: Partial<ShipmentInput>): Row => {
  const row: Row = {}
  if (input.influencerId !== undefined) row.influencer_id = input.influencerId
  if (input.collabId !== undefined) row.collab_id = input.collabId
  if (input.status !== undefined) row.status = input.status
  if (input.collabType !== undefined) row.collab_type = input.collabType
  if (input.productName !== undefined) row.product_name = input.productName
  if (input.quantity !== undefined) row.quantity = input.quantity
  if (input.carrier !== undefined) row.carrier = input.carrier
  if (input.trackingNumber !== undefined) row.tracking_number = input.trackingNumber
  if (input.requestedAt !== undefined) row.requested_at = input.requestedAt
  if (input.shippedAt !== undefined) row.shipped_at = input.shippedAt
  if (input.deliveredAt !== undefined) row.delivered_at = input.deliveredAt
  return row
}

const toNote = (row: Row): CommunicationLog => ({
  id: row.id,
  influencerId: row.influencer_id,
  authorId: row.author_id,
  note: row.note,
  loggedAt: row.logged_at,
})

/** Supabase 응답에서 에러를 던지고 데이터만 꺼낸다. (스키마 타입 생성 전이라 Row로 다룬다) */
function unwrap<T = Row>(result: { data: unknown; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message)
  if (result.data === null || result.data === undefined) {
    throw new Error('데이터를 찾을 수 없습니다.')
  }
  return result.data as T
}

export const supabaseAdapter: DataRepository = {
  async listTeamMembers() {
    const db = requireSupabase()
    const rows = unwrap<Row[]>(await db.from('profiles').select('*').order('display_name'))
    return rows.map(toTeamMember)
  },

  async listInfluencers() {
    const db = requireSupabase()
    const rows = unwrap<Row[]>(
      await db.from('influencers').select('*').order('created_at', { ascending: false }),
    )
    return rows.map(toInfluencer)
  },

  async getInfluencer(id) {
    const db = requireSupabase()
    const { data, error } = await db.from('influencers').select('*').eq('id', id).maybeSingle()
    if (error) throw new Error(error.message)
    return data ? toInfluencer(data as Row) : null
  },

  async createInfluencer(input, actorId) {
    const db = requireSupabase()
    const row = unwrap(
      await db
        .from('influencers')
        .insert({ ...influencerColumns(input), created_by: actorId })
        .select()
        .single(),
    )
    return toInfluencer(row)
  },

  async updateInfluencer(id, patch) {
    const db = requireSupabase()
    const row = unwrap(
      await db.from('influencers').update(influencerColumns(patch)).eq('id', id).select().single(),
    )
    return toInfluencer(row)
  },

  async deleteInfluencer(id) {
    const db = requireSupabase()
    const { error } = await db.from('influencers').delete().eq('id', id)
    if (error) throw new Error(error.message)
  },

  async changeDnc(change: DncChange, actorId: string) {
    const db = requireSupabase()
    const { error } = await db.from('dnc_audit_log').insert({
      influencer_id: change.influencerId,
      action: change.action,
      reason: change.reason,
      reason_detail: change.reasonDetail,
      set_by: actorId,
    })
    if (error) throw new Error(error.message)

    // 트리거가 인플루언서 상태를 갱신하므로 갱신된 행을 다시 읽어온다.
    const row = unwrap(
      await db.from('influencers').select('*').eq('id', change.influencerId).single(),
    )
    return toInfluencer(row)
  },

  async listDncAudit(influencerId?: string) {
    const db = requireSupabase()
    let query = db.from('dnc_audit_log').select('*').order('set_at', { ascending: false })
    if (influencerId) query = query.eq('influencer_id', influencerId)
    const rows = unwrap<Row[]>(await query)
    return rows.map(toDncEntry)
  },

  async listCollabs() {
    const db = requireSupabase()
    const rows = unwrap<Row[]>(
      await db.from('collabs').select('*').order('created_at', { ascending: false }),
    )
    return rows.map(toCollab)
  },

  async createCollab(input) {
    const db = requireSupabase()
    const row = unwrap(await db.from('collabs').insert(collabColumns(input)).select().single())
    return toCollab(row)
  },

  async updateCollab(id, patch) {
    const db = requireSupabase()
    const row = unwrap(
      await db.from('collabs').update(collabColumns(patch)).eq('id', id).select().single(),
    )
    return toCollab(row)
  },

  async moveCollabStage(id: string, stage: CollabStage) {
    const db = requireSupabase()
    const row = unwrap(await db.from('collabs').update({ stage }).eq('id', id).select().single())
    return toCollab(row)
  },

  async cancelCollab(id: string, reasons: string[], reasonDetail: string) {
    const db = requireSupabase()
    const row = unwrap(
      await db
        .from('collabs')
        .update({
          is_cancelled: true,
          cancel_reasons: reasons,
          cancel_reason_detail: reasonDetail,
          cancelled_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single(),
    )
    return toCollab(row)
  },

  async holdCollab(id: string, change: Partial<HoldChange>) {
    const db = requireSupabase()
    const current = unwrap(
      await db.from('collabs').select('held_at').eq('id', id).single(),
    )
    // 넘어온 항목만 바꾼다. 빠진 항목은 기존 값을 지킨다.
    const patch: Row = {
      is_on_hold: true,
      // 수정일 때는 최초 보류일을 그대로 둔다.
      held_at: current.held_at ?? new Date().toISOString(),
    }
    if (change.reason !== undefined) patch.hold_reason = change.reason
    if (change.detail !== undefined) patch.hold_detail = change.detail
    if (change.recontactAt !== undefined) patch.recontact_at = change.recontactAt
    const row = unwrap(
      await db
        .from('collabs')
        .update(patch)
        .eq('id', id)
        .select()
        .single(),
    )
    return toCollab(row)
  },

  async resumeCollab(id: string) {
    const db = requireSupabase()
    const row = unwrap(
      await db
        .from('collabs')
        .update({
          is_on_hold: false,
          hold_reason: null,
          hold_detail: '',
          held_at: null,
          recontact_at: null,
          stage_entered_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single(),
    )
    return toCollab(row)
  },

  async setCancelDate(id: string, date: string) {
    const db = requireSupabase()
    const row = unwrap(
      await db
        .from('collabs')
        .update({ cancelled_at: new Date(`${date}T12:00:00`).toISOString() })
        .eq('id', id)
        .select()
        .single(),
    )
    return toCollab(row)
  },

  async deleteCollab(id) {
    const db = requireSupabase()
    const { error } = await db.from('collabs').delete().eq('id', id)
    if (error) throw new Error(error.message)
  },

  async listReasonTags() {
    const db = requireSupabase()
    const rows = unwrap<Row[]>(await db.from('reason_tags').select('*').order('label'))
    return rows.map(
      (row): ReasonTag => ({
        id: row.id,
        label: row.label,
        createdBy: row.created_by ?? null,
        createdAt: row.created_at,
      }),
    )
  },

  async createReasonTag(label: string, actorId: string) {
    const db = requireSupabase()
    const row = unwrap(
      await db
        .from('reason_tags')
        .upsert({ label: label.trim(), created_by: actorId }, { onConflict: 'label' })
        .select()
        .single(),
    )
    return { id: row.id, label: row.label, createdBy: row.created_by ?? null, createdAt: row.created_at }
  },

  async deleteReasonTag(id: string) {
    const db = requireSupabase()
    const { error } = await db.from('reason_tags').delete().eq('id', id)
    if (error) throw new Error(error.message)
  },

  async listShipments() {
    const db = requireSupabase()
    const rows = unwrap<Row[]>(
      await db.from('shipments').select('*').order('requested_at', { ascending: false }),
    )
    return rows.map(toShipment)
  },

  async createShipment(input) {
    const db = requireSupabase()
    const row = unwrap(await db.from('shipments').insert(shipmentColumns(input)).select().single())
    return toShipment(row)
  },

  async updateShipment(id, patch) {
    const db = requireSupabase()
    const row = unwrap(
      await db.from('shipments').update(shipmentColumns(patch)).eq('id', id).select().single(),
    )
    return toShipment(row)
  },

  async deleteShipment(id) {
    const db = requireSupabase()
    const { error } = await db.from('shipments').delete().eq('id', id)
    if (error) throw new Error(error.message)
  },

  async listNotes(influencerId: string) {
    const db = requireSupabase()
    const rows = unwrap<Row[]>(
      await db
        .from('communication_logs')
        .select('*')
        .eq('influencer_id', influencerId)
        .order('logged_at', { ascending: false }),
    )
    return rows.map(toNote)
  },

  async addNote(influencerId: string, note: string, authorId: string) {
    const db = requireSupabase()
    const row = unwrap(
      await db
        .from('communication_logs')
        .insert({ influencer_id: influencerId, note, author_id: authorId })
        .select()
        .single(),
    )
    return toNote(row)
  },

  async deleteNote(id) {
    const db = requireSupabase()
    const { error } = await db.from('communication_logs').delete().eq('id', id)
    if (error) throw new Error(error.message)
  },

  async loadDemoData() {
    throw new Error('실제 데이터베이스에서는 예시 데이터를 넣을 수 없습니다.')
  },

  async resetAll() {
    throw new Error('실제 데이터베이스에서는 전체 초기화를 지원하지 않습니다.')
  },
}
