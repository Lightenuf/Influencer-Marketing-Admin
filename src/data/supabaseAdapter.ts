import { requireSupabase } from '@/lib/supabase'
import type { MetaUploadPreset } from './metaTypes'
import {
  emptyConditions,
  type Campaign,
  type CampaignConversion,
  type CampaignOption,
  type CampaignPatch,
  type CustomerGroup,
  type CustomerPreview,
  type SendTargets,
} from './types'
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
  DiscoveryRequest,
  DncAuditEntry,
  Influencer,
  MessageTemplate,
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

const toMessageTemplate = (row: Row): MessageTemplate => ({
  id: row.id,
  name: row.name,
  body: row.body ?? '',
  sortOrder: row.sort_order ?? 0,
  updatedBy: row.updated_by ?? null,
  updatedAt: row.updated_at,
  createdAt: row.created_at,
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
  contactedDates: row.contacted_dates ?? [],
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
  // 예전 이름으로 저장된 기록도 새 이름으로 읽는다.
  stage: row.stage === '마켓 대기중' ? '마켓 준비 중' : row.stage,
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
  marketEndDate: row.market_end_date,
  marketRevenue: row.market_revenue ?? 0,
  marketUnits: row.market_units ?? 0,
  isSettled: row.is_settled ?? false,
  contentLinks: row.content_links ?? [],
  memo: row.memo ?? '',
  targetRevenue: row.target_revenue ?? 0,
  settlementAmount: row.settlement_amount ?? 0,
  plannedUnits: row.planned_units_by_product ?? {},
  sortOrder: row.sort_order ?? 0,
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

const collabColumns = (
  input: Partial<
    CollabInput & Pick<Collab, 'memo' | 'targetRevenue' | 'plannedUnits' | 'settlementAmount'>
  >,
): Row => {
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
  if (input.marketEndDate !== undefined) row.market_end_date = input.marketEndDate
  if (input.marketRevenue !== undefined) row.market_revenue = input.marketRevenue
  if (input.marketUnits !== undefined) row.market_units = input.marketUnits
  if (input.isSettled !== undefined) row.is_settled = input.isSettled
  if (input.settlementAmount !== undefined) row.settlement_amount = input.settlementAmount
  if (input.contentLinks !== undefined) row.content_links = input.contentLinks
  if (input.memo !== undefined) row.memo = input.memo
  if (input.targetRevenue !== undefined) row.target_revenue = input.targetRevenue
  if (input.plannedUnits !== undefined) row.planned_units_by_product = input.plannedUnits
  return row
}

const toCampaign = (row: Row): Campaign => ({
  id: String(row.id),
  channel: (row.channel as Campaign['channel']) ?? 'sms',
  status: (row.status as Campaign['status']) ?? 'draft',
  sentAt: (row.sent_at as string) ?? null,
  messageType: String(row.message_type ?? ''),
  title: String(row.title ?? ''),
  targetCount: Number(row.target_count ?? 0),
  successCount: Number(row.success_count ?? 0),
  clickCount: Number(row.click_count ?? 0),
  unsubscribeCount: Number(row.unsubscribe_count ?? 0),
  visitCount: Number(row.visit_count ?? 0),
  purchaseCount: Number(row.purchase_count ?? 0),
  purchaseAmount: Number(row.purchase_amount ?? 0),
  costWon: Number(row.cost_won ?? 0),
  segmentId: (row.segment_id as string) ?? null,
  segmentName: String(row.segment_name ?? ''),
  conditions: (row.conditions as Campaign['conditions']) ?? emptyConditions(),
  messageBody: String(row.message_body ?? ''),
  imageUrl: String(row.image_url ?? ''),
  isAd: Boolean(row.is_ad),
  source: (row.source as Campaign['source']) ?? 'manual',
  purpose: String(row.purpose ?? ''),
  concepts: (row.concepts as string[]) ?? [],
  offerType: String(row.offer_type ?? '없음'),
  offerValue: String(row.offer_value ?? ''),
  hypothesis: String(row.hypothesis ?? ''),
  retrospective: String(row.retrospective ?? ''),
  error: String(row.error ?? ''),
  createdAt: String(row.created_at),
  updatedAt: String(row.updated_at ?? row.created_at),
})

/** 화면이 쓰는 이름을 DB 칸 이름으로 바꾼다 */
const patchToRow = (patch: CampaignPatch): Row => {
  const row: Row = {}
  const map: Record<string, string> = {
    title: 'title',
    purpose: 'purpose',
    concepts: 'concepts',
    offerType: 'offer_type',
    offerValue: 'offer_value',
    hypothesis: 'hypothesis',
    retrospective: 'retrospective',
    status: 'status',
    sentAt: 'sent_at',
    targetCount: 'target_count',
    successCount: 'success_count',
    clickCount: 'click_count',
    unsubscribeCount: 'unsubscribe_count',
    visitCount: 'visit_count',
    purchaseCount: 'purchase_count',
    purchaseAmount: 'purchase_amount',
  }
  for (const [key, column] of Object.entries(map)) {
    const value = (patch as Record<string, unknown>)[key]
    if (value !== undefined) row[column] = value as Row[string]
  }
  return row
}

/** supabase-js는 오류 본문을 Response에 담아 준다 — 열어서 이유를 꺼낸다 */
async function readFunctionError(error: unknown): Promise<string | null> {
  const context = (error as { context?: unknown }).context
  if (context instanceof Response) {
    try {
      const body = await context.json()
      if (body?.error) return String(body.error)
    } catch {
      // 본문이 JSON이 아니면 기본 메시지를 쓴다.
    }
  }
  return null
}

const toCustomerGroup = (row: Row): CustomerGroup => ({
  id: row.id,
  name: row.name,
  conditions: row.conditions ?? emptyConditions(),
  createdBy: row.created_by,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
})

const toUploadPreset = (row: Row): MetaUploadPreset => ({
  id: row.id,
  name: row.name,
  objective: row.objective,
  adsetId: row.adset_id,
  cta: row.cta,
  landingUrl: row.landing_url ?? '',
  primaryText: row.primary_text ?? '',
  isPartnership: row.is_partnership ?? false,
  createdBy: row.created_by,
  createdAt: row.created_at,
})

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

const toDiscoveryRequest = (row: Row): DiscoveryRequest => ({
  id: row.id,
  keywords: row.keywords ?? [],
  minFollowers: row.min_followers ?? 0,
  wanted: row.wanted ?? 0,
  status: row.status,
  resultRaw: row.result_raw ?? '',
  note: row.note ?? '',
  requestedBy: row.requested_by ?? null,
  requestedAt: row.requested_at,
  finishedAt: row.finished_at,
})

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

  async logContact(id, date) {
    const db = requireSupabase()
    const current = await this.getInfluencer(id)
    if (!current) throw new Error('인플루언서를 찾을 수 없습니다.')
    const { data, error } = await db
      .from('influencers')
      .update({ contacted_dates: [...current.contactedDates, date].sort() })
      .eq('id', id)
      .select()
      .single()
    if (error) throw new Error(error.message)
    return toInfluencer(data as Row)
  },

  async undoContact(id) {
    const db = requireSupabase()
    const current = await this.getInfluencer(id)
    if (!current) throw new Error('인플루언서를 찾을 수 없습니다.')
    const { data, error } = await db
      .from('influencers')
      .update({ contacted_dates: current.contactedDates.slice(0, -1) })
      .eq('id', id)
      .select()
      .single()
    if (error) throw new Error(error.message)
    return toInfluencer(data as Row)
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
    const current = unwrap(await db.from('collabs').select('held_at').eq('id', id).single())
    // 넘어온 항목만 바꾼다. 빠진 항목은 기존 값을 지킨다.
    const patch: Row = {
      is_on_hold: true,
      // 수정일 때는 최초 보류일을 그대로 둔다.
      held_at: current.held_at ?? new Date().toISOString(),
    }
    if (change.reason !== undefined) patch.hold_reason = change.reason
    if (change.detail !== undefined) patch.hold_detail = change.detail
    if (change.recontactAt !== undefined) patch.recontact_at = change.recontactAt
    const row = unwrap(await db.from('collabs').update(patch).eq('id', id).select().single())
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

  async reorderCollabs(orderedIds) {
    const db = requireSupabase()
    await Promise.all(
      orderedIds.map((id, index) => db.from('collabs').update({ sort_order: index }).eq('id', id)),
    )
  },

  async deleteCollab(id) {
    const db = requireSupabase()
    const { error } = await db.from('collabs').delete().eq('id', id)
    if (error) throw new Error(error.message)
  },

  async listCustomerGroups() {
    const db = requireSupabase()
    const rows = unwrap<Row[]>(
      await db.from('customer_groups').select('*').order('updated_at', { ascending: false }),
    )
    return rows.map(toCustomerGroup)
  },

  async createCustomerGroup(input, actorId) {
    const db = requireSupabase()
    const row = unwrap(
      await db
        .from('customer_groups')
        .insert({ name: input.name, conditions: input.conditions, created_by: actorId })
        .select()
        .single(),
    )
    return toCustomerGroup(row)
  },

  async updateCustomerGroup(id, input) {
    const db = requireSupabase()
    const row = unwrap(
      await db
        .from('customer_groups')
        .update({ name: input.name, conditions: input.conditions })
        .eq('id', id)
        .select()
        .single(),
    )
    return toCustomerGroup(row)
  },

  async deleteCustomerGroup(id) {
    const db = requireSupabase()
    const { error } = await db.from('customer_groups').delete().eq('id', id)
    if (error) throw new Error(error.message)
  },

  async previewCustomerGroup(conditions, limit) {
    const db = requireSupabase()
    // 세는 규칙은 DB 함수 한곳에 있다. 조건을 SQL로 옮기지 않고 그대로 넘긴다.
    const { data, error } = await db.rpc('preview_customer_group', {
      conditions,
      row_limit: limit,
    })
    if (error) throw new Error(error.message)
    const result = (data ?? {}) as Partial<CustomerPreview>
    return {
      total: result.total ?? 0,
      smsAgreed: result.smsAgreed ?? 0,
      rows: result.rows ?? [],
      syncedAt: result.syncedAt ?? null,
    }
  },

  async listSendTargets(conditions, limit) {
    const db = requireSupabase()
    const { data, error } = await db.rpc('list_send_targets', {
      conditions,
      row_limit: limit,
    })
    if (error) throw new Error(error.message)
    const result = (data ?? {}) as Partial<SendTargets>
    return {
      total: result.total ?? 0,
      sendable: result.sendable ?? 0,
      noNumber: result.noNumber ?? 0,
      optedOut: result.optedOut ?? 0,
      rows: result.rows ?? [],
    }
  },

  async checkSendNumbers(numbers) {
    const db = requireSupabase()
    const { data, error } = await db.rpc('check_send_numbers', { numbers })
    if (error) throw new Error(error.message)
    const result = (data ?? {}) as Partial<SendTargets>
    return {
      total: result.total ?? 0,
      sendable: result.sendable ?? 0,
      noNumber: 0,
      optedOut: result.optedOut ?? 0,
      rows: result.rows ?? [],
    }
  },

  async listCampaigns() {
    const db = requireSupabase()
    const rows = unwrap<Row[]>(
      await db
        .from('message_campaigns')
        .select('*')
        .order('sent_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false }),
    )
    return rows.map(toCampaign)
  },

  async getCampaign(id) {
    const db = requireSupabase()
    const { data, error } = await db
      .from('message_campaigns')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    if (error) throw new Error(error.message)
    return data ? toCampaign(data as Row) : null
  },

  async updateCampaign(id, patch) {
    const db = requireSupabase()
    const { error } = await db.from('message_campaigns').update(patchToRow(patch)).eq('id', id)
    if (error) throw new Error(error.message)
  },

  async deleteCampaign(id) {
    const db = requireSupabase()
    const { error } = await db.from('message_campaigns').delete().eq('id', id)
    if (error) throw new Error(error.message)
  },

  async sendCampaign(input, _actorId) {
    const db = requireSupabase()
    // 발송사 열쇠는 Edge Function만 쥔다. 브라우저에서 직접 부르지 않는다.
    const { data, error } = await db.functions.invoke('sms-proxy', {
      body: { action: 'send', params: input },
    })
    if (error) {
      const detail = await readFunctionError(error)
      throw new Error(detail ?? '보내지 못했습니다.')
    }
    if (data && typeof data === 'object' && 'error' in data) {
      throw new Error(String((data as { error: unknown }).error))
    }
    return toCampaign((data as { campaign: Row }).campaign)
  },

  async campaignConversion(id, windowDays) {
    const db = requireSupabase()
    const { data, error } = await db.rpc('campaign_conversion', {
      campaign: id,
      window_days: windowDays,
    })
    if (error) throw new Error(error.message)
    const result = (data ?? {}) as Partial<CampaignConversion>
    return {
      purchaseCount: result.purchaseCount ?? 0,
      purchaseAmount: result.purchaseAmount ?? 0,
      buyers: result.buyers ?? 0,
    }
  },

  async importCampaigns(rows) {
    const db = requireSupabase()
    const { error } = await db.from('message_campaigns').upsert(
      rows.map((row) => ({
        channel: row.channel,
        status: row.status,
        sent_at: row.sentAt,
        message_type: row.messageType,
        title: row.title,
        target_count: row.targetCount,
        success_count: row.successCount,
        visit_count: row.visitCount,
        purchase_amount: row.purchaseAmount,
        source: 'imweb_import',
      })),
      { onConflict: 'channel,sent_at,message_type' },
    )
    if (error) throw new Error(error.message)
    return rows.length
  },

  async listCampaignOptions() {
    const db = requireSupabase()
    const rows = unwrap<Row[]>(
      await db
        .from('campaign_options')
        .select('*')
        .order('kind')
        .order('sort_order')
        .order('label'),
    )
    return rows.map((row) => ({
      id: String(row.id),
      kind: row.kind as CampaignOption['kind'],
      label: String(row.label),
      sortOrder: Number(row.sort_order ?? 0),
    }))
  },

  async addCampaignOption(kind, label) {
    const db = requireSupabase()
    const { error } = await db
      .from('campaign_options')
      .upsert({ kind, label, sort_order: 50 }, { onConflict: 'kind,label' })
    if (error) throw new Error(error.message)
  },

  async removeCampaignOption(id) {
    const db = requireSupabase()
    const { error } = await db.from('campaign_options').delete().eq('id', id)
    if (error) throw new Error(error.message)
  },

  async listOptouts() {
    const db = requireSupabase()
    const rows = unwrap<Row[]>(
      await db.from('customer_optouts').select('*').order('opted_out_at', { ascending: false }),
    )
    return rows.map((row) => ({
      callnum: String(row.callnum),
      memberCode: (row.member_code as string) ?? null,
      channel: String(row.channel ?? 'sms'),
      reason: String(row.reason ?? ''),
      source: String(row.source ?? 'admin'),
      optedOutAt: String(row.opted_out_at),
    }))
  },

  async addOptout(callnum, reason) {
    const db = requireSupabase()
    const { error } = await db
      .from('customer_optouts')
      .upsert({ callnum, reason, source: 'admin' }, { onConflict: 'callnum' })
    if (error) throw new Error(error.message)
  },

  async removeOptout(callnum) {
    const db = requireSupabase()
    const { error } = await db.from('customer_optouts').delete().eq('callnum', callnum)
    if (error) throw new Error(error.message)
  },

  async listUploadPresets() {
    const db = requireSupabase()
    const rows = unwrap<Row[]>(
      await db.from('meta_upload_presets').select('*').order('created_at', { ascending: false }),
    )
    return rows.map(toUploadPreset)
  },

  async createUploadPreset(input, actorId) {
    const db = requireSupabase()
    const row = unwrap(
      await db
        .from('meta_upload_presets')
        .insert({
          name: input.name,
          objective: input.objective,
          adset_id: input.adsetId,
          cta: input.cta,
          landing_url: input.landingUrl,
          primary_text: input.primaryText,
          is_partnership: input.isPartnership,
          created_by: actorId,
        })
        .select()
        .single(),
    )
    return toUploadPreset(row)
  },

  async deleteUploadPreset(id) {
    const db = requireSupabase()
    const { error } = await db.from('meta_upload_presets').delete().eq('id', id)
    if (error) throw new Error(error.message)
  },

  async listDiscoveryRequests() {
    const db = requireSupabase()
    const rows = unwrap<Row[]>(
      await db.from('discovery_requests').select('*').order('requested_at', { ascending: false }),
    )
    return rows.map(toDiscoveryRequest)
  },

  async createDiscoveryRequest(input, actorId: string) {
    const db = requireSupabase()
    const row = unwrap(
      await db
        .from('discovery_requests')
        .insert({
          keywords: input.keywords,
          min_followers: input.minFollowers,
          wanted: input.wanted,
          requested_by: actorId,
        })
        .select()
        .single(),
    )
    return toDiscoveryRequest(row)
  },

  async updateDiscoveryRequest(id, patch) {
    const db = requireSupabase()
    const columns: Row = {}
    if (patch.status !== undefined) {
      columns.status = patch.status
      if (patch.status === '완료' || patch.status === '실패') {
        columns.finished_at = new Date().toISOString()
      }
    }
    if (patch.resultRaw !== undefined) columns.result_raw = patch.resultRaw
    if (patch.note !== undefined) columns.note = patch.note
    const row = unwrap(
      await db.from('discovery_requests').update(columns).eq('id', id).select().single(),
    )
    return toDiscoveryRequest(row)
  },

  async deleteDiscoveryRequest(id) {
    const db = requireSupabase()
    const { error } = await db.from('discovery_requests').delete().eq('id', id)
    if (error) throw new Error(error.message)
  },

  async listMessageTemplates() {
    const db = requireSupabase()
    const rows = unwrap<Row[]>(await db.from('message_templates').select('*').order('sort_order'))
    return rows.map(toMessageTemplate)
  },

  async saveMessageTemplate(id, patch, actorId) {
    const db = requireSupabase()
    const row: Row = { updated_by: actorId, updated_at: new Date().toISOString() }
    if (patch.name !== undefined) row.name = patch.name
    if (patch.body !== undefined) row.body = patch.body
    return toMessageTemplate(
      unwrap(await db.from('message_templates').update(row).eq('id', id).select().single()),
    )
  },

  async createMessageTemplate(name, actorId) {
    const db = requireSupabase()
    return toMessageTemplate(
      unwrap(
        await db
          .from('message_templates')
          .insert({ name, body: '', updated_by: actorId })
          .select()
          .single(),
      ),
    )
  },

  async deleteMessageTemplate(id) {
    const db = requireSupabase()
    const { error } = await db.from('message_templates').delete().eq('id', id)
    if (error) throw new Error(error.message)
  },

  async listReasonTags() {
    const db = requireSupabase()
    const rows = unwrap<Row[]>(await db.from('reason_tags').select('*').order('label'))
    return rows.map((row): ReasonTag => ({
      id: row.id,
      label: row.label,
      createdBy: row.created_by ?? null,
      createdAt: row.created_at,
    }))
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
    return {
      id: row.id,
      label: row.label,
      createdBy: row.created_by ?? null,
      createdAt: row.created_at,
    }
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
