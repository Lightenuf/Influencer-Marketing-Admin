/**
 * 광고 이상 감지 — 하루 한 번 돌고, 어드민에서 눌러서도 돈다.
 *
 * 배포된 이름은 `smart-worker` 다. Supabase 가 붙인 기본 이름을 그대로 쓰고 있다 —
 * 이름을 바꾸려면 함수를 다시 배포해야 해서, 부르는 쪽을 맞췄다.
 *
 * 9월 16일에 광고가 멈췄는데 열흘 동안 아무도 몰랐다. 그래서 만들었다.
 *
 * 같은 문제로 매일 알림이 오면 사람이 무시하게 된다.
 * 한 번 알린 것은 사람이 '확인함'을 누르거나 문제가 사라질 때까지 다시 알리지 않는다.
 *
 * 필요한 Secret
 *   META_ACCESS_TOKEN, META_AD_ACCOUNT_ID   메타 조회 (meta-proxy 와 같은 것을 쓴다)
 *   SLACK_WEBHOOK_URL                       알림 보낼 곳. 없으면 기록만 남긴다
 *   ALERTS_CRON_KEY                         (선택) 스케줄러가 쓸 열쇠
 */

const GRAPH = 'https://graph.facebook.com/v21.0'

/**
 * 어드민 화면 주소.
 *
 * 해시(#/)를 붙이면 안 된다 — 이 앱은 경로 방식(BrowserRouter)이라
 * 해시는 무시되고 첫 화면으로 떨어진다. 한 번 그렇게 내보낸 적이 있다.
 */
const HOME = 'https://lightenuf.github.io/Influencer-Marketing-Admin/'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-key',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })

const DB = Deno.env.get('SUPABASE_URL') ?? ''

function dbHeaders(): Record<string, string> {
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  return { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }
}

interface Row {
  [key: string]: unknown
}

/**
 * 표에서 줄을 읽는다.
 * 읽지 못해도 빈 목록을 준다 — 표 하나가 없다고 리포트 전체가 죽으면 안 된다.
 */
async function rows(path: string): Promise<Row[]> {
  try {
    const response = await fetch(`${DB}/rest/v1/${path}`, { headers: dbHeaders() })
    const body = await response.json()
    return Array.isArray(body) ? body : []
  } catch {
    return []
  }
}

async function graph(path: string, params: Record<string, string> = {}): Promise<Row[]> {
  const token = Deno.env.get('META_ACCESS_TOKEN') ?? ''
  const url = new URL(`${GRAPH}/${path}`)
  url.searchParams.set('access_token', token)
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value)
  const body = await (await fetch(url.toString())).json()
  if (body.error) throw new Error(body.error.message ?? '메타 호출 실패')
  return Array.isArray(body.data) ? body.data : [body]
}

/** 구매 전환만 고른다 — meta-proxy 와 같은 기준 */
const PURCHASE = ['purchase', 'omni_purchase', 'offsite_conversion.fb_pixel_purchase']
const pick = (list: unknown, types: string[]) => {
  if (!Array.isArray(list)) return 0
  for (const type of types) {
    const found = list.find((item) => (item as Row).action_type === type)
    if (found) return Number((found as Row).value ?? 0)
  }
  return 0
}

const day = (offset: number) => {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() + offset)
  return date.toISOString().slice(0, 10)
}

interface Alert {
  kind: string
  level: 'info' | 'warn' | 'critical'
  title: string
  detail: string
  evidence: Record<string, unknown>
  fingerprint: string
}

/** 운영 기준에서 숫자를 읽는다. 코드에 박지 않는다 */
async function loadSettings(): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = {}
  for (const row of await rows('ops_settings?select=key,value')) {
    out[String(row.key)] = row.value
  }
  return out
}

async function dailySpend(
  from: string,
  to: string,
): Promise<Map<string, { spend: number; revenue: number }>> {
  const account = (Deno.env.get('META_AD_ACCOUNT_ID') ?? '').replace(/^act_/, '')
  const rows = await graph(`act_${account}/insights`, {
    fields: 'spend,actions,action_values',
    time_range: JSON.stringify({ since: from, until: to }),
    time_increment: '1',
    limit: '500',
  })
  const out = new Map<string, { spend: number; revenue: number }>()
  for (const row of rows) {
    out.set(String(row.date_start), {
      spend: Number(row.spend ?? 0),
      revenue: pick(row.action_values, PURCHASE),
    })
  }
  return out
}

async function detect(): Promise<Alert[]> {
  const settings = await loadSettings()
  const num = (key: string, fallback: number) => Number(settings[key] ?? fallback)
  const alerts: Alert[] = []

  const account = (Deno.env.get('META_AD_ACCOUNT_ID') ?? '').replace(/^act_/, '')

  // ── 1. 지출이 멈췄나 ──
  // 어제 지출이 직전 7일 평균에 견줘 확 떨어졌으면 멈춘 것으로 본다.
  const series = await dailySpend(day(-9), day(-1))
  const yesterday = series.get(day(-1)) ?? { spend: 0, revenue: 0 }
  const before = [...series.entries()].filter(([key]) => key < day(-1))
  const average =
    before.length > 0 ? before.reduce((sum, [, value]) => sum + value.spend, 0) / before.length : 0

  if (average > 0 && yesterday.spend < average * num('spendStopRatio', 0.1)) {
    alerts.push({
      kind: 'spendStopped',
      level: 'critical',
      title: '광고 지출이 멈췄습니다',
      detail: `어제(${day(-1)}) 지출이 ${Math.round(yesterday.spend).toLocaleString()}원입니다. 직전 7일 평균은 ${Math.round(average).toLocaleString()}원이었습니다.`,
      evidence: { yesterday: Math.round(yesterday.spend), average: Math.round(average) },
      // 날짜를 넣지 않는다 — 멈춰 있는 동안 매일 새 알림이 뜨면 안 된다
      fingerprint: 'spendStopped',
    })
  }

  // ── 1-2. 켜져 있는데 안 나간다 ──
  // 위 '멈춤' 규칙은 멈추는 순간을 잡는다. 이미 며칠 지나면 직전 평균도 0이라 안 걸린다.
  // 그래서 상태를 따로 본다 — 돌아가라고 켜 뒀는데 돈이 안 나가는 것은 그 자체로 이상이다.
  const totalRecent = [...series.values()].reduce((sum, value) => sum + value.spend, 0)
  if (totalRecent === 0) {
    try {
      const campaigns = await graph(`act_${account}/campaigns`, {
        fields: 'id,name,effective_status,daily_budget',
        limit: '200',
      })
      const live = campaigns.filter(
        (row) => String(row.effective_status) === 'ACTIVE' && Number(row.daily_budget ?? 0) > 0,
      )
      if (live.length > 0) {
        const names = live
          .slice(0, 3)
          .map((row) => String(row.name ?? ''))
          .join(', ')
        alerts.push({
          kind: 'noDelivery',
          level: 'critical',
          title: `켜져 있는 캠페인 ${live.length}개가 돌지 않습니다`,
          detail: `${names}${live.length > 3 ? ' 외' : ''} — 예산이 잡혀 있는데 최근 9일 지출이 0원입니다. 결제 수단, 광고 심사, 타겟 설정을 확인해주세요.`,
          evidence: { campaigns: live.length, days: 9 },
          fingerprint: 'noDelivery',
        })
      }
    } catch {
      // 캠페인을 못 읽는 것은 계정 문제에서 잡힌다
    }
  }

  // ── 2. 지출 급증 ──
  const lastWeekSame = series.get(day(-8))
  if (lastWeekSame && lastWeekSame.spend > 0) {
    const ratio = yesterday.spend / lastWeekSame.spend
    if (ratio >= num('spendSpikeRatio', 1.5)) {
      alerts.push({
        kind: 'spendSpike',
        level: 'warn',
        title: '광고 지출이 갑자기 늘었습니다',
        detail: `어제 ${Math.round(yesterday.spend).toLocaleString()}원으로, 전주 같은 요일(${Math.round(lastWeekSame.spend).toLocaleString()}원)보다 ${Math.round((ratio - 1) * 100)}% 많습니다.`,
        evidence: {
          yesterday: Math.round(yesterday.spend),
          lastWeek: Math.round(lastWeekSame.spend),
        },
        fingerprint: `spendSpike:${day(-1)}`,
      })
    }
  }

  // ── 3. ROAS 급락 ──
  const recent = [...series.entries()].filter(([key]) => key >= day(-3))
  const older = [...series.entries()].filter(([key]) => key < day(-3))
  const roasOf = (list: [string, { spend: number; revenue: number }][]) => {
    const spend = list.reduce((sum, [, value]) => sum + value.spend, 0)
    const revenue = list.reduce((sum, [, value]) => sum + value.revenue, 0)
    return spend > 0 ? revenue / spend : 0
  }
  const nowRoas = roasOf(recent)
  const beforeRoas = roasOf(older)
  if (beforeRoas > 0 && nowRoas > 0 && nowRoas < beforeRoas * num('roasDropRatio', 0.6)) {
    alerts.push({
      kind: 'roasDrop',
      level: 'warn',
      title: 'ROAS가 크게 떨어졌습니다',
      detail: `최근 3일 ROAS ${nowRoas.toFixed(2)}, 그 앞 기간은 ${beforeRoas.toFixed(2)}였습니다.`,
      evidence: { now: Number(nowRoas.toFixed(2)), before: Number(beforeRoas.toFixed(2)) },
      fingerprint: `roasDrop:${day(-1)}`,
    })
  }

  // ── 4. 계정 상태 — 미납·정지 ──
  try {
    const [info] = await graph(`act_${account}`, {
      fields: 'account_status,disable_reason,balance,currency',
    })
    const status = Number(info?.account_status ?? 1)
    if (status !== 1) {
      const labels: Record<number, string> = {
        2: '정지됨',
        3: '결제가 밀렸습니다',
        7: '검토 중',
        9: '유예 기간',
        101: '닫힘',
      }
      alerts.push({
        kind: 'accountIssue',
        level: 'critical',
        title: `광고 계정에 문제가 있습니다 — ${labels[status] ?? `상태 ${status}`}`,
        detail: '메타 광고관리자에서 결제 수단과 계정 상태를 확인해주세요.',
        evidence: { status, disableReason: Number(info?.disable_reason ?? 0) },
        fingerprint: `accountIssue:${status}`,
      })
    }
  } catch (error) {
    alerts.push({
      kind: 'accountIssue',
      level: 'warn',
      title: '광고 계정 상태를 읽지 못했습니다',
      detail: String(error).slice(0, 200),
      evidence: {},
      fingerprint: 'accountIssue:unreadable',
    })
  }

  // ── 5. 광고 반려 ──
  try {
    const rows = await graph(`act_${account}/ads`, {
      fields: 'id,name,effective_status,issues_info',
      limit: '500',
    })
    const rejected = rows.filter((row) => String(row.effective_status) === 'DISAPPROVED')
    if (rejected.length > 0) {
      const names = rejected
        .slice(0, 5)
        .map((row) => String(row.name ?? ''))
        .join(', ')
      alerts.push({
        kind: 'adRejected',
        level: 'warn',
        title: `광고 ${rejected.length}개가 반려됐습니다`,
        detail: `${names}${rejected.length > 5 ? ' 외' : ''}`,
        evidence: { count: rejected.length },
        fingerprint: `adRejected:${rejected.length}`,
      })
    }
  } catch {
    // 광고를 못 읽는 것은 위 계정 문제에서 이미 잡힌다
  }

  // ── 6. 토큰 만료 임박 ──
  try {
    const url = new URL('https://graph.facebook.com/debug_token')
    const token = Deno.env.get('META_ACCESS_TOKEN') ?? ''
    url.searchParams.set('input_token', token)
    url.searchParams.set('access_token', token)
    const body = await (await fetch(url.toString())).json()
    const data = body?.data ?? {}
    const expires = Number(data.expires_at ?? 0)
    if (data.is_valid === false) {
      alerts.push({
        kind: 'tokenExpiring',
        level: 'critical',
        title: '메타 토큰이 만료됐습니다',
        detail: '광고 자료를 더 이상 읽을 수 없습니다. 토큰을 다시 발급해 Secret에 넣어주세요.',
        evidence: {},
        fingerprint: 'tokenInvalid',
      })
    } else if (expires > 0) {
      const daysLeft = Math.round((expires * 1000 - Date.now()) / 86_400_000)
      if (daysLeft <= num('tokenWarnDays', 14)) {
        alerts.push({
          kind: 'tokenExpiring',
          level: 'warn',
          title: `메타 토큰이 ${daysLeft}일 뒤 만료됩니다`,
          detail: '만료되면 광고 화면이 모두 멈춥니다. 미리 새로 발급해주세요.',
          evidence: { daysLeft },
          fingerprint: 'tokenExpiring',
        })
      }
    }
  } catch {
    // 토큰을 못 읽으면 위에서 이미 다른 알림이 떴을 것이다
  }

  return alerts
}

/** 이미 열려 있는 것은 다시 알리지 않는다 */
async function saveAndNotify(
  alerts: Alert[],
  notify = true,
): Promise<{ saved: number; notified: number }> {
  const open = new Set(
    (await rows('ad_alerts?resolved_at=is.null&select=fingerprint')).map((row) =>
      String(row.fingerprint),
    ),
  )

  const fresh = alerts.filter((alert) => !open.has(alert.fingerprint))
  if (fresh.length === 0) return { saved: 0, notified: 0 }

  const now = new Date().toISOString()
  const webhook = notify ? (Deno.env.get('SLACK_WEBHOOK_URL') ?? '').trim() : ''

  await fetch(`${DB}/rest/v1/ad_alerts`, {
    method: 'POST',
    headers: { ...dbHeaders(), Prefer: 'return=minimal' },
    body: JSON.stringify(
      fresh.map((alert) => ({
        kind: alert.kind,
        level: alert.level,
        title: alert.title,
        detail: alert.detail,
        evidence: alert.evidence,
        fingerprint: alert.fingerprint,
        notified_at: webhook ? now : null,
      })),
    ),
  })

  if (!webhook) return { saved: fresh.length, notified: 0 }

  // '왜?'를 슬랙에서 되묻지 않게, 판단에 쓴 숫자를 같이 싣는다.
  // 되물으려면 Claude 를 불러야 하고 그건 돈이 든다.
  const icon = { critical: '🚨', warn: '⚠️', info: 'ℹ️' }
  const won = (value: number) => `${Math.round(value).toLocaleString()}원`

  const evidenceLine = (alert: Alert): string => {
    const e = alert.evidence as Record<string, number>
    switch (alert.kind) {
      case 'spendStopped':
        return `어제 ${won(e.yesterday ?? 0)} · 직전 7일 평균 ${won(e.average ?? 0)}`
      case 'noDelivery':
        return `예산이 잡힌 캠페인 ${e.campaigns ?? 0}개 · 최근 ${e.days ?? 0}일 지출 0원`
      case 'spendSpike':
        return `어제 ${won(e.yesterday ?? 0)} · 전주 같은 요일 ${won(e.lastWeek ?? 0)}`
      case 'roasDrop':
        return `최근 3일 ROAS ${e.now ?? 0} · 그 앞 기간 ${e.before ?? 0}`
      case 'adRejected':
        return `반려된 광고 ${e.count ?? 0}개`
      case 'tokenExpiring':
        return e.daysLeft != null ? `${e.daysLeft}일 남음` : '지금 만료됨'
      default:
        return ''
    }
  }

  const text = fresh
    .map((alert) => {
      const evidence = evidenceLine(alert)
      return [
        `${icon[alert.level]} *${alert.title}*`,
        alert.detail,
        evidence ? `\`${evidence}\`` : '',
      ]
        .filter(Boolean)
        .join('\n')
    })
    .join('\n\n')

  await fetch(webhook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: [
        `*브리보 광고 알림* · ${new Date().toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' })}`,
        '',
        text,
        '',
        `<${HOME}ads/actions|오늘의 액션> · <${HOME}ads/insights|성과 분석>`,
      ].join('\n'),
    }),
  })

  return { saved: fresh.length, notified: fresh.length }
}

/** 슬랙으로 보낸다. 웹훅이 없으면 조용히 넘어간다 */
async function toSlack(text: string): Promise<boolean> {
  const webhook = (Deno.env.get('SLACK_WEBHOOK_URL') ?? '').trim()
  if (!webhook) return false
  await fetch(webhook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  })
  return true
}

/**
 * 같은 것을 두 번 보내지 않는다.
 * 스케줄러가 두 번 돌거나 사람이 버튼을 또 눌러도 한 번만 가야 한다.
 * 표의 유니크 제약이 막아주므로, 넣는 데 성공했을 때만 보낸다.
 */
async function claimOnce(kind: string, periodKey: string): Promise<boolean> {
  const response = await fetch(`${DB}/rest/v1/notification_log`, {
    method: 'POST',
    headers: { ...dbHeaders(), Prefer: 'return=minimal' },
    body: JSON.stringify({ kind, period_key: periodKey }),
  })
  return response.ok
}

/**
 * 잡아 둔 자물쇠를 푼다.
 *
 * 자물쇠를 먼저 잡고 일을 하는데, 그 일이 실패하면 보내지도 못한 채 자물쇠만 남는다.
 * 그러면 그 주 리포트는 영영 오지 않는다. 실패했으면 풀어서 다음에 다시 하게 한다.
 */
async function releaseClaim(kind: string, periodKey: string): Promise<void> {
  await fetch(`${DB}/rest/v1/notification_log?kind=eq.${kind}&period_key=eq.${periodKey}`, {
    method: 'DELETE',
    headers: dbHeaders(),
  })
}

const won = (value: number) => `${Math.round(value).toLocaleString()}원`
const ratio = (value: number) => value.toFixed(2)

/** 한국 날짜 */
function seoulDay(offset = 0): string {
  const now = new Date()
  now.setUTCHours(now.getUTCHours() + 9 + offset * 24)
  return now.toISOString().slice(0, 10)
}

/** 그 주 월요일 — 주간 리포트를 한 주에 한 번만 보내기 위한 열쇠 */
function mondayOf(day: string): string {
  const date = new Date(`${day}T00:00:00Z`)
  const shift = (date.getUTCDay() + 6) % 7
  date.setUTCDate(date.getUTCDate() - shift)
  return date.toISOString().slice(0, 10)
}

/** 기간 집계 — 계정 전체 */
async function totals(from: string, to: string) {
  const account = (Deno.env.get('META_AD_ACCOUNT_ID') ?? '').replace(/^act_/, '')
  const rows = await graph(`act_${account}/insights`, {
    fields: 'spend,impressions,inline_link_clicks,actions,action_values',
    time_range: JSON.stringify({ since: from, until: to }),
    limit: '100',
  })
  const sum = { spend: 0, revenue: 0, results: 0, impressions: 0, linkClicks: 0 }
  for (const row of rows) {
    sum.spend += Number(row.spend ?? 0)
    sum.revenue += pick(row.action_values, PURCHASE)
    sum.results += pick(row.actions, PURCHASE)
    sum.impressions += Number(row.impressions ?? 0)
    sum.linkClicks += Number(row.inline_link_clicks ?? 0)
  }
  return {
    ...sum,
    roas: sum.spend > 0 ? sum.revenue / sum.spend : 0,
    cpa: sum.results > 0 ? sum.spend / sum.results : 0,
  }
}

async function countOpenSuggestions(): Promise<number> {
  return (await rows('action_suggestions?status=eq.open&select=id')).length
}

/** ── 일일 요약 (매일 09:00) ── */
async function dailySummary(settings: Record<string, unknown>) {
  if (settings.notifyDaily === false) return { sent: false, why: '설정에서 꺼져 있습니다' }
  const day = seoulDay(-1)
  if (!(await claimOnce('daily', day))) return { sent: false, why: '오늘 이미 보냈습니다' }

  try {
    const t = await totals(day, day)
    const open = await countOpenSuggestions()

    const body =
      t.spend === 0
        ? '어제는 광고가 돌지 않았습니다.'
        : [
            `지출 ${won(t.spend)} · 매출 ${won(t.revenue)}`,
            `ROAS ${ratio(t.roas)} · 전환 ${t.results}건 · CPA ${t.results > 0 ? won(t.cpa) : '-'}`,
          ].join('\n')

    await toSlack(
      [
        `*어제 광고 요약* · ${day}`,
        '',
        body,
        '',
        open > 0 ? `오늘 볼 제안 ${open}개` : '새 제안은 없습니다',
        `<${HOME}ads/actions|오늘의 액션>`,
      ].join('\n'),
    )
    return { sent: true }
  } catch (error) {
    await releaseClaim('daily', day)
    throw error
  }
}

/** ── 승인 요청 (발생 즉시) ── */
async function approvalRequests(settings: Record<string, unknown>) {
  if (settings.notifyApproval === false) return { sent: 0, why: '설정에서 꺼져 있습니다' }

  const pending = await rows(
    'action_suggestions?status=eq.open&needs_approval=is.true&notified_at=is.null&select=id,kind,target_name,evidence,effect',
  )
  if (pending.length === 0) return { sent: 0 }

  const lines = pending.map((row) => {
    const effect = (row.effect ?? {}) as { from?: number; to?: number }
    const change =
      effect.from && effect.to ? ` — 일예산 ${won(effect.from)} → ${won(effect.to)}` : ''
    return `• ${row.target_name}${change}`
  })

  await toSlack(
    [
      `*승인이 필요한 예산 변경 ${pending.length}건*`,
      '',
      lines.join('\n'),
      '',
      '가드레일에 걸려 바로 실행되지 않았습니다. 승인 권한이 있는 분이 확인해주세요.',
      `<${HOME}ads/actions|오늘의 액션에서 보기>`,
    ].join('\n'),
  )

  await fetch(`${DB}/rest/v1/action_suggestions?id=in.(${pending.map((r) => r.id).join(',')})`, {
    method: 'PATCH',
    headers: dbHeaders(),
    body: JSON.stringify({ notified_at: new Date().toISOString() }),
  })
  return { sent: pending.length }
}

/**
 * ── 주간 리포트 (월요일 09:00) ──
 *
 * 숫자는 집계값만 쓴다. 서술만 Claude 가 쓴다 —
 * 모델이 숫자를 지어내면 그 리포트는 못 믿을 것이 된다.
 */
async function weeklyReport(settings: Record<string, unknown>) {
  if (settings.notifyWeekly === false) return { sent: false, why: '설정에서 꺼져 있습니다' }

  const thisMonday = mondayOf(seoulDay(0))
  if (!(await claimOnce('weekly', thisMonday)))
    return { sent: false, why: '이번 주에 이미 보냈습니다' }

  try {
    const shift = (day: string, by: number) => {
      const date = new Date(`${day}T00:00:00Z`)
      date.setUTCDate(date.getUTCDate() + by)
      return date.toISOString().slice(0, 10)
    }
    const lastFrom = shift(thisMonday, -7)
    const lastTo = shift(thisMonday, -1)
    const beforeFrom = shift(thisMonday, -14)
    const beforeTo = shift(thisMonday, -8)

    const now = await totals(lastFrom, lastTo)
    const before = await totals(beforeFrom, beforeTo)

    // 태그별 성과 — 광고별 지표에 어드민 태그를 붙여 묶는다
    const account = (Deno.env.get('META_AD_ACCOUNT_ID') ?? '').replace(/^act_/, '')
    const adRows = await graph(`act_${account}/insights`, {
      level: 'ad',
      fields: 'ad_id,spend,actions,action_values',
      time_range: JSON.stringify({ since: lastFrom, until: lastTo }),
      limit: '500',
    })
    const tagRows = await rows('ad_tags?select=ad_id,angle,format')
    const tags = new Map(
      tagRows.map((row) => [
        String(row.ad_id),
        { angle: String(row.angle ?? ''), format: String(row.format ?? '') },
      ]),
    )

    const group = (key: 'angle' | 'format') => {
      const map = new Map<string, { spend: number; revenue: number }>()
      for (const row of adRows) {
        const tag = tags.get(String(row.ad_id))?.[key]
        if (!tag) continue
        const cur = map.get(tag) ?? { spend: 0, revenue: 0 }
        map.set(tag, {
          spend: cur.spend + Number(row.spend ?? 0),
          revenue: cur.revenue + pick(row.action_values, PURCHASE),
        })
      }
      return [...map.entries()]
        .filter(([, v]) => v.spend > 0)
        .map(([name, v]) => ({ name, spend: v.spend, roas: v.revenue / v.spend }))
        .sort((a, b) => b.roas - a.roas)
    }

    const angles = group('angle')
    const formats = group('format')

    // 지난주에 실행한 것과 결과
    const logs = await rows(
      `action_logs?created_at=gte.${lastFrom}&select=kind,action,target_name,outcome`,
    )
    const done = logs.filter((row) => row.action === 'executed')

    // 실험
    const experiments = await rows('experiments?select=name,status,verdict,learning')
    const running = experiments.filter((row) => row.status === 'running')
    const finished = experiments.filter((row) => row.status === 'done' && row.verdict)

    const open = await countOpenSuggestions()

    // 여기까지가 숫자다. 아래 서술만 Claude 가 쓴다.
    const facts = [
      `기간: ${lastFrom} ~ ${lastTo}`,
      `지출 ${won(now.spend)} (전주 ${won(before.spend)})`,
      `매출 ${won(now.revenue)} (전주 ${won(before.revenue)})`,
      `ROAS ${ratio(now.roas)} (전주 ${ratio(before.roas)})`,
      `전환 ${now.results}건 (전주 ${before.results}건)`,
      `CPA ${now.results > 0 ? won(now.cpa) : '-'}`,
      '',
      `앵글 상위: ${
        angles
          .slice(0, 3)
          .map((a) => `${a.name} ROAS ${ratio(a.roas)}`)
          .join(', ') || '없음'
      }`,
      `앵글 하위: ${
        angles
          .slice(-2)
          .map((a) => `${a.name} ROAS ${ratio(a.roas)}`)
          .join(', ') || '없음'
      }`,
      `포맷: ${formats.map((f) => `${f.name} ROAS ${ratio(f.roas)}`).join(', ') || '없음'}`,
      '',
      `실행한 액션 ${done.length}건`,
      `진행 중 실험 ${running.length}개 · 끝난 실험 ${finished.length}개`,
      `열린 제안 ${open}개`,
    ].join('\n')

    let narrative = ''
    const claudeKey = (Deno.env.get('ANTHROPIC_API_KEY') ?? '').trim()
    if (claudeKey) {
      try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': claudeKey,
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'claude-sonnet-5',
            max_tokens: 700,
            system:
              '너는 브리보의 퍼포먼스 마케터다. 주간 리포트의 해설을 쓴다.\n' +
              '주어진 숫자만 쓴다. 없는 숫자를 지어내지 마라.\n' +
              '3~4문장으로, 무엇이 달라졌고 이번 주에 무엇을 볼지 적어라.\n' +
              '인사말이나 머리말 없이 본문만 쓴다.',
            messages: [{ role: 'user', content: facts }],
          }),
        })
        const body = await response.json()
        narrative = (body.content ?? [])
          .filter((part: { type: string }) => part.type === 'text')
          .map((part: { text: string }) => part.text)
          .join('')
          .trim()
      } catch {
        // 해설을 못 써도 숫자는 보낸다
      }
    }

    await toSlack(
      [
        `*지난주 광고 리포트* · ${lastFrom} ~ ${lastTo}`,
        '',
        `지출 ${won(now.spend)} · 매출 ${won(now.revenue)} · ROAS ${ratio(now.roas)} · 전환 ${now.results}건`,
        `전주 대비 지출 ${arrow(now.spend, before.spend)} · ROAS ${arrow(now.roas, before.roas)}`,
        '',
        angles.length > 0
          ? `앵글 상위 — ${angles
              .slice(0, 3)
              .map((a) => `${a.name} ${ratio(a.roas)}`)
              .join(' · ')}`
          : '앵글별로 볼 자료가 아직 없습니다 (태깅이 필요합니다)',
        formats.length > 0
          ? `포맷 — ${formats.map((f) => `${f.name} ${ratio(f.roas)}`).join(' · ')}`
          : '',
        '',
        `실행한 액션 ${done.length}건 · 진행 중 실험 ${running.length}개 · 열린 제안 ${open}개`,
        narrative ? `\n${narrative}` : '',
        '',
        `<${HOME}ads/insights|성과 분석> · <${HOME}ads/actions|오늘의 액션>`,
      ]
        .filter((line) => line !== '')
        .join('\n'),
    )
    return { sent: true }
  } catch (error) {
    await releaseClaim('weekly', thisMonday)
    throw error
  }
}

/** 전주 대비 오르내림 */
function arrow(now: number, before: number): string {
  if (before === 0) return '견줄 수 없음'
  const change = ((now - before) / before) * 100
  if (Math.abs(change) < 0.5) return '그대로'
  return `${change > 0 ? '▲' : '▼'} ${Math.abs(change).toFixed(0)}%`
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  // 스케줄러는 로그인 토큰이 없어 별도 열쇠로 부른다
  const cronKey = (Deno.env.get('ALERTS_CRON_KEY') ?? '').trim()
  const given = request.headers.get('x-cron-key') ?? ''
  const fromCron = cronKey.length > 0 && given === cronKey
  if (!fromCron && !request.headers.get('authorization')) {
    return json({ error: '권한이 없습니다.' }, 401)
  }

  try {
    const body = await request.json().catch(() => ({}))
    const job = String(body?.job ?? 'alerts')
    const settings = await loadSettings()

    if (job === 'daily') return json(await dailySummary(settings))
    if (job === 'weekly') return json(await weeklyReport(settings))
    if (job === 'approvals') return json(await approvalRequests(settings))

    if (settings.notifyAlerts === false) {
      // 알림은 꺼져 있어도 감지는 한다. 화면에는 떠야 하기 때문이다.
      const alerts = await detect()
      const result = await saveAndNotify(alerts, false)
      return json({ found: alerts.length, ...result, alerts })
    }

    const alerts = await detect()
    const result = await saveAndNotify(alerts)
    return json({ found: alerts.length, ...result, alerts })
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : String(error) }, 500)
  }
})
