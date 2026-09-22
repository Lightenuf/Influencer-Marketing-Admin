import { PRODUCTS } from './types'
import type { MetaUploadPreset } from './metaTypes'
import type {
  CollabInput,
  DataRepository,
  DncChange,
  HoldChange,
  InfluencerInput,
  ShipmentInput,
} from './repository'
import { DEFAULT_REASON_TAGS } from './types'
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

const STORAGE_KEY = 'breevo-influencer-admin:v1'

export interface Database {
  discoveryRequests: DiscoveryRequest[]
  uploadPresets: MetaUploadPreset[]
  reasonTags: ReasonTag[]
  messageTemplates: MessageTemplate[]
  influencers: Influencer[]
  dncAuditLog: DncAuditEntry[]
  collabs: Collab[]
  shipments: Shipment[]
  notes: CommunicationLog[]
}

const TEAM_MEMBERS: TeamMember[] = [
  { id: 'u-1', email: 'hjkim@lightenuf.com', displayName: '김한주', role: 'admin' },
  { id: 'u-2', email: 'marketer1@lightenuf.com', displayName: '마케터 A', role: 'member' },
  { id: 'u-3', email: 'marketer2@lightenuf.com', displayName: '마케터 B', role: 'member' },
]

const emptyDb = (): Database => ({
  discoveryRequests: [],
  uploadPresets: [],
  reasonTags: [],
  messageTemplates: [],
  influencers: [],
  dncAuditLog: [],
  collabs: [],
  shipments: [],
  notes: [],
})

/**
 * 단계 이름을 5단계로 바꾸기 전에 저장된 기록을 새 이름으로 옮긴다.
 * 이미 저장돼 있던 카드가 어느 칸에도 안 나타나는 일을 막기 위한 것.
 */
const LEGACY_STAGES: Record<string, CollabStage> = {
  요청: '회신완료',
  협의중: '테스트중',
  진행중: '미팅 확정',
  종료: '마켓 준비 중',
  '미팅 조율중': '테스트 통과',
  '마켓 대기중': '마켓 준비 중',
}

function migrate(db: Database): Database {
  db.collabs = db.collabs.map((collab) => ({
    ...collab,
    stage: LEGACY_STAGES[collab.stage] ?? collab.stage,
    isOnHold: collab.isOnHold ?? false,
    holdReason: collab.holdReason ?? null,
    holdDetail: collab.holdDetail ?? '',
    heldAt: collab.heldAt ?? null,
    recontactAt: collab.recontactAt ?? null,
    testFeedback: collab.testFeedback ?? null,
    memo: collab.memo ?? '',
    targetRevenue: collab.targetRevenue ?? 0,
    settlementAmount: collab.settlementAmount ?? 0,
    // 맛을 나누기 전에는 숫자 하나였다. 그 값은 첫 맛으로 옮긴다.
    plannedUnits:
      typeof collab.plannedUnits === 'number'
        ? { [PRODUCTS[0]]: collab.plannedUnits }
        : (collab.plannedUnits ?? {}),
    sortOrder: collab.sortOrder ?? 0,
    lastContactedAt: collab.lastContactedAt ?? null,
    meetingAt: collab.meetingAt ?? null,
    marketDate: collab.marketDate ?? null,
    marketRevenue: collab.marketRevenue ?? 0,
    marketUnits: collab.marketUnits ?? 0,
    isSettled: collab.isSettled ?? false,
    contentLinks: collab.contentLinks ?? [],
    cancelReasons:
      collab.cancelReasons ??
      // 사유가 하나였던 시절의 기록을 배열로 옮긴다.
      ((collab as unknown as { cancelReason?: string | null }).cancelReason
        ? [(collab as unknown as { cancelReason: string }).cancelReason]
        : []),
  }))
  db.uploadPresets = db.uploadPresets ?? []
  db.influencers = db.influencers.map((influencer) => ({
    ...influencer,
    followingCount: influencer.followingCount ?? 0,
    contactedDates: influencer.contactedDates ?? [],
  }))
  return db
}

function read(): Database {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return withDefaultTags(emptyDb())
    return withDefaultTags(migrate({ ...emptyDb(), ...(JSON.parse(raw) as Partial<Database>) }))
  } catch {
    return withDefaultTags(emptyDb())
  }
}

/** 사유 태그가 비어 있으면 기본값으로 채운다. */
function withDefaultTags(db: Database): Database {
  if (db.reasonTags.length > 0) return db
  db.reasonTags = DEFAULT_REASON_TAGS.map((label, index) => ({
    id: `tag-default-${index}`,
    label,
    createdBy: null,
    createdAt: new Date(0).toISOString(),
  }))
  return db
}

function write(db: Database) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db))
}

const uid = () => crypto.randomUUID()
const now = () => new Date().toISOString()

/** 실제 네트워크 호출처럼 보이게 하는 최소 지연 — 로딩 상태 UI를 검증하기 위함 */
const tick = <T>(value: T): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(value), 60))

function requireInfluencer(db: Database, id: string): Influencer {
  const found = db.influencers.find((i) => i.id === id)
  if (!found) throw new Error('인플루언서를 찾을 수 없습니다.')
  return found
}

function requireCollab(db: Database, id: string): Collab {
  const found = db.collabs.find((c) => c.id === id)
  if (!found) throw new Error('협업 건을 찾을 수 없습니다.')
  return found
}

export const mockAdapter: DataRepository = {
  async listTeamMembers() {
    return tick(TEAM_MEMBERS)
  },

  async listInfluencers() {
    const db = read()
    return tick([...db.influencers].sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
  },

  async getInfluencer(id) {
    const db = read()
    return tick(db.influencers.find((i) => i.id === id) ?? null)
  },

  async createInfluencer(input: InfluencerInput, actorId: string) {
    const db = read()
    const influencer: Influencer = {
      ...input,
      id: uid(),
      contactedDates: [],
      doNotContact: false,
      dncReason: null,
      dncSetBy: null,
      dncSetAt: null,
      createdBy: actorId,
      createdAt: now(),
      updatedAt: now(),
    }
    db.influencers.push(influencer)
    write(db)
    return tick(influencer)
  },

  async updateInfluencer(id, patch) {
    const db = read()
    const influencer = requireInfluencer(db, id)
    Object.assign(influencer, patch, { updatedAt: now() })
    write(db)
    return tick(influencer)
  },

  async logContact(id, date) {
    const db = read()
    const influencer = requireInfluencer(db, id)
    influencer.contactedDates = [...influencer.contactedDates, date].sort()
    influencer.updatedAt = now()
    write(db)
    return tick(influencer)
  },

  async undoContact(id) {
    const db = read()
    const influencer = requireInfluencer(db, id)
    influencer.contactedDates = influencer.contactedDates.slice(0, -1)
    influencer.updatedAt = now()
    write(db)
    return tick(influencer)
  },

  async deleteInfluencer(id) {
    const db = read()
    db.influencers = db.influencers.filter((i) => i.id !== id)
    db.collabs = db.collabs.filter((c) => c.influencerId !== id)
    db.shipments = db.shipments.filter((s) => s.influencerId !== id)
    db.notes = db.notes.filter((n) => n.influencerId !== id)
    // 감사 로그는 인플루언서를 삭제해도 남긴다.
    write(db)
    return tick(undefined)
  },

  async changeDnc(change: DncChange, actorId: string) {
    const db = read()
    const influencer = requireInfluencer(db, change.influencerId)
    const timestamp = now()

    const entry: DncAuditEntry = {
      id: uid(),
      influencerId: change.influencerId,
      action: change.action,
      reason: change.reason,
      reasonDetail: change.reasonDetail,
      setBy: actorId,
      setAt: timestamp,
    }
    db.dncAuditLog.push(entry)

    const isSet = change.action === 'set'
    influencer.doNotContact = isSet
    influencer.dncReason = isSet ? change.reason : null
    influencer.dncSetBy = isSet ? actorId : null
    influencer.dncSetAt = isSet ? timestamp : null
    influencer.updatedAt = timestamp
    if (isSet && influencer.status !== '취소') influencer.status = '취소'

    write(db)
    return tick(influencer)
  },

  async listDncAudit(influencerId?: string) {
    const db = read()
    const entries = influencerId
      ? db.dncAuditLog.filter((e) => e.influencerId === influencerId)
      : db.dncAuditLog
    return tick([...entries].sort((a, b) => b.setAt.localeCompare(a.setAt)))
  },

  async listCollabs() {
    const db = read()
    return tick([...db.collabs].sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
  },

  async createCollab(input: CollabInput) {
    const db = read()
    const collab: Collab = {
      ...input,
      id: uid(),
      memo: '',
      targetRevenue: 0,
      settlementAmount: 0,
      plannedUnits: {},
      sortOrder: 0,
      stageEnteredAt: now(),
      isOnHold: false,
      holdReason: null,
      holdDetail: '',
      heldAt: null,
      recontactAt: null,
      isCancelled: false,
      cancelReasons: [],
      cancelReasonDetail: '',
      cancelledAt: null,
      createdAt: now(),
      updatedAt: now(),
    }
    db.collabs.push(collab)
    write(db)
    return tick(collab)
  },

  async updateCollab(id, patch) {
    const db = read()
    const collab = requireCollab(db, id)
    if (patch.stage && patch.stage !== collab.stage) collab.stageEnteredAt = now()
    Object.assign(collab, patch, { updatedAt: now() })
    write(db)
    return tick(collab)
  },

  async moveCollabStage(id: string, stage: CollabStage) {
    const db = read()
    const collab = requireCollab(db, id)
    if (collab.stage !== stage) {
      collab.stage = stage
      collab.stageEnteredAt = now()
      collab.updatedAt = now()
    }
    write(db)
    return tick(collab)
  },

  async cancelCollab(id: string, reasons: string[], reasonDetail: string) {
    const db = read()
    const collab = requireCollab(db, id)
    collab.isCancelled = true
    collab.cancelReasons = reasons
    collab.cancelReasonDetail = reasonDetail
    collab.cancelledAt = now()
    collab.updatedAt = now()
    write(db)
    return tick(collab)
  },

  async holdCollab(id: string, change: Partial<HoldChange>) {
    const db = read()
    const collab = requireCollab(db, id)
    collab.isOnHold = true
    // 넘어온 항목만 바꾼다. 빠진 항목은 기존 값을 지킨다.
    if (change.reason !== undefined) collab.holdReason = change.reason
    if (change.detail !== undefined) collab.holdDetail = change.detail
    if (change.recontactAt !== undefined) collab.recontactAt = change.recontactAt
    // 수정일 때는 최초 보류일을 그대로 둔다.
    if (!collab.heldAt) collab.heldAt = now()
    collab.updatedAt = now()
    write(db)
    return tick(collab)
  },

  async resumeCollab(id: string) {
    const db = read()
    const collab = requireCollab(db, id)
    collab.isOnHold = false
    collab.holdReason = null
    collab.holdDetail = ''
    collab.heldAt = null
    collab.recontactAt = null
    // 보류 기간은 체류일수에서 빼준다 — 복귀한 날부터 다시 센다.
    collab.stageEnteredAt = now()
    collab.updatedAt = now()
    write(db)
    return tick(collab)
  },

  async setCancelDate(id: string, date: string) {
    const db = read()
    const collab = requireCollab(db, id)
    // 날짜만 받아 그날 정오로 저장한다 (시간대 때문에 날짜가 하루 밀리지 않도록).
    collab.cancelledAt = new Date(`${date}T12:00:00`).toISOString()
    collab.updatedAt = now()
    write(db)
    return tick(collab)
  },

  async reorderCollabs(orderedIds) {
    const db = read()
    orderedIds.forEach((id, index) => {
      const collab = db.collabs.find((item) => item.id === id)
      if (collab) collab.sortOrder = index
    })
    write(db)
  },

  async deleteCollab(id) {
    const db = read()
    db.collabs = db.collabs.filter((c) => c.id !== id)
    db.shipments = db.shipments.map((s) => (s.collabId === id ? { ...s, collabId: null } : s))
    write(db)
    return tick(undefined)
  },

  async listUploadPresets() {
    const db = read()
    return tick([...(db.uploadPresets ?? [])].reverse())
  },

  async createUploadPreset(input, actorId) {
    const db = read()
    const preset = { ...input, id: uid(), createdBy: actorId, createdAt: now() }
    db.uploadPresets = [...(db.uploadPresets ?? []), preset]
    write(db)
    return tick(preset)
  },

  async deleteUploadPreset(id) {
    const db = read()
    db.uploadPresets = (db.uploadPresets ?? []).filter((preset) => preset.id !== id)
    write(db)
  },

  async listDiscoveryRequests() {
    const db = read()
    return tick(
      [...db.discoveryRequests].sort((a, b) => b.requestedAt.localeCompare(a.requestedAt)),
    )
  },

  async createDiscoveryRequest(input, actorId: string) {
    const db = read()
    const request: DiscoveryRequest = {
      ...input,
      id: uid(),
      status: '대기',
      resultRaw: '',
      note: '',
      requestedBy: actorId,
      requestedAt: now(),
      finishedAt: null,
    }
    db.discoveryRequests.push(request)
    write(db)
    return tick(request)
  },

  async updateDiscoveryRequest(id, patch) {
    const db = read()
    const request = db.discoveryRequests.find((item) => item.id === id)
    if (!request) throw new Error('발굴 요청을 찾을 수 없습니다.')
    Object.assign(request, patch)
    if (patch.status === '완료' || patch.status === '실패') request.finishedAt = now()
    write(db)
    return tick(request)
  },

  async deleteDiscoveryRequest(id) {
    const db = read()
    db.discoveryRequests = db.discoveryRequests.filter((item) => item.id !== id)
    write(db)
    return tick(undefined)
  },

  async listMessageTemplates() {
    const db = read()
    return tick([...db.messageTemplates].sort((a, b) => a.sortOrder - b.sortOrder))
  },

  async saveMessageTemplate(id, patch, actorId) {
    const db = read()
    const found = db.messageTemplates.find((item) => item.id === id)
    if (!found) throw new Error('메시지 템플릿을 찾을 수 없습니다.')
    if (patch.name !== undefined) found.name = patch.name
    if (patch.body !== undefined) found.body = patch.body
    found.updatedBy = actorId
    found.updatedAt = now()
    write(db)
    return tick(found)
  },

  async createMessageTemplate(name, actorId) {
    const db = read()
    const template: MessageTemplate = {
      id: uid(),
      name,
      body: '',
      sortOrder: db.messageTemplates.length,
      updatedBy: actorId,
      updatedAt: now(),
      createdAt: now(),
    }
    db.messageTemplates.push(template)
    write(db)
    return tick(template)
  },

  async deleteMessageTemplate(id: string) {
    const db = read()
    db.messageTemplates = db.messageTemplates.filter((item) => item.id !== id)
    write(db)
  },

  async listReasonTags() {
    const db = read()
    return tick([...db.reasonTags].sort((a, b) => a.label.localeCompare(b.label, 'ko')))
  },

  async createReasonTag(label: string, actorId: string) {
    const db = read()
    const trimmed = label.trim()
    const existing = db.reasonTags.find((tag) => tag.label === trimmed)
    if (existing) return tick(existing)
    const tag: ReasonTag = { id: uid(), label: trimmed, createdBy: actorId, createdAt: now() }
    db.reasonTags.push(tag)
    write(db)
    return tick(tag)
  },

  async deleteReasonTag(id: string) {
    const db = read()
    db.reasonTags = db.reasonTags.filter((tag) => tag.id !== id)
    write(db)
    return tick(undefined)
  },

  async listShipments() {
    const db = read()
    return tick([...db.shipments].sort((a, b) => b.requestedAt.localeCompare(a.requestedAt)))
  },

  async createShipment(input: ShipmentInput) {
    const db = read()
    const shipment: Shipment = { ...input, id: uid(), createdAt: now(), updatedAt: now() }
    db.shipments.push(shipment)
    write(db)
    return tick(shipment)
  },

  async updateShipment(id, patch) {
    const db = read()
    const shipment = db.shipments.find((s) => s.id === id)
    if (!shipment) throw new Error('출고 건을 찾을 수 없습니다.')
    Object.assign(shipment, patch, { updatedAt: now() })
    write(db)
    return tick(shipment)
  },

  async deleteShipment(id) {
    const db = read()
    db.shipments = db.shipments.filter((s) => s.id !== id)
    write(db)
    return tick(undefined)
  },

  async listNotes(influencerId: string) {
    const db = read()
    return tick(
      db.notes
        .filter((n) => n.influencerId === influencerId)
        .sort((a, b) => b.loggedAt.localeCompare(a.loggedAt)),
    )
  },

  async addNote(influencerId: string, note: string, authorId: string) {
    const db = read()
    const entry: CommunicationLog = {
      id: uid(),
      influencerId,
      authorId,
      note,
      loggedAt: now(),
    }
    db.notes.push(entry)
    write(db)
    return tick(entry)
  },

  async deleteNote(id) {
    const db = read()
    db.notes = db.notes.filter((n) => n.id !== id)
    write(db)
    return tick(undefined)
  },

  async loadDemoData() {
    const { buildDemoDatabase } = await import('./demoData')
    write(buildDemoDatabase())
    return tick(undefined)
  },

  async resetAll() {
    write(emptyDb())
    return tick(undefined)
  },
}
