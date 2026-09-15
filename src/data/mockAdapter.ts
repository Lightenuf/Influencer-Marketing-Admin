import type {
  CollabInput,
  DataRepository,
  DncChange,
  InfluencerInput,
  ShipmentInput,
} from './repository'
import type {
  Collab,
  CollabStage,
  CommunicationLog,
  DncAuditEntry,
  DncReason,
  Influencer,
  Shipment,
  TeamMember,
} from './types'

const STORAGE_KEY = 'breevo-influencer-admin:v1'

export interface Database {
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
  influencers: [],
  dncAuditLog: [],
  collabs: [],
  shipments: [],
  notes: [],
})

function read(): Database {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyDb()
    return { ...emptyDb(), ...(JSON.parse(raw) as Partial<Database>) }
  } catch {
    return emptyDb()
  }
}

function write(db: Database) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db))
}

const uid = () => crypto.randomUUID()
const now = () => new Date().toISOString()

/** 실제 네트워크 호출처럼 보이게 하는 최소 지연 — 로딩 상태 UI를 검증하기 위함 */
const tick = <T,>(value: T): Promise<T> =>
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
      stageEnteredAt: now(),
      isCancelled: false,
      cancelReason: null,
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

  async cancelCollab(id: string, reason: DncReason, reasonDetail: string) {
    const db = read()
    const collab = requireCollab(db, id)
    collab.isCancelled = true
    collab.stage = '종료'
    collab.stageEnteredAt = now()
    collab.cancelReason = reason
    collab.cancelReasonDetail = reasonDetail
    collab.cancelledAt = now()
    collab.updatedAt = now()
    write(db)
    return tick(collab)
  },

  async deleteCollab(id) {
    const db = read()
    db.collabs = db.collabs.filter((c) => c.id !== id)
    db.shipments = db.shipments.map((s) => (s.collabId === id ? { ...s, collabId: null } : s))
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
