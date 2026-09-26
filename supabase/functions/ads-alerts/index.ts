/**
 * 광고 이상 감지 — 하루 한 번 돌고, 어드민에서 눌러서도 돈다.
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
  const response = await fetch(`${DB}/rest/v1/ops_settings?select=key,value`, {
    headers: dbHeaders(),
  })
  const rows = (await response.json()) as { key: string; value: unknown }[]
  const out: Record<string, unknown> = {}
  for (const row of rows) out[row.key] = row.value
  return out
}

async function dailySpend(from: string, to: string): Promise<Map<string, { spend: number; revenue: number }>> {
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
        const names = live.slice(0, 3).map((row) => String(row.name ?? '')).join(', ')
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
        evidence: { yesterday: Math.round(yesterday.spend), lastWeek: Math.round(lastWeekSame.spend) },
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
      const names = rejected.slice(0, 5).map((row) => String(row.name ?? '')).join(', ')
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
async function saveAndNotify(alerts: Alert[]): Promise<{ saved: number; notified: number }> {
  const openResponse = await fetch(
    `${DB}/rest/v1/ad_alerts?resolved_at=is.null&select=fingerprint`,
    { headers: dbHeaders() },
  )
  const open = new Set(
    ((await openResponse.json()) as { fingerprint: string }[]).map((row) => row.fingerprint),
  )

  const fresh = alerts.filter((alert) => !open.has(alert.fingerprint))
  if (fresh.length === 0) return { saved: 0, notified: 0 }

  const now = new Date().toISOString()
  const webhook = (Deno.env.get('SLACK_WEBHOOK_URL') ?? '').trim()

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

  const icon = { critical: '🚨', warn: '⚠️', info: 'ℹ️' }
  const text = fresh
    .map((alert) => `${icon[alert.level]} *${alert.title}*\n${alert.detail}`)
    .join('\n\n')

  await fetch(webhook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: `브리보 광고 알림\n\n${text}\n\n<https://lightenuf.github.io/Influencer-Marketing-Admin/#/ads/actions|오늘의 액션에서 보기>`,
    }),
  })

  return { saved: fresh.length, notified: fresh.length }
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
    const alerts = await detect()
    const result = await saveAndNotify(alerts)
    return json({ found: alerts.length, ...result, alerts })
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : String(error) }, 500)
  }
})
