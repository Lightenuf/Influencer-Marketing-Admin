/**
 * 문자·알림톡 발송 중개소 (솔라피).
 *
 * 어드민은 정적 사이트라 열쇠를 둘 곳이 없다. 발송 열쇠는 돈이 나가는 열쇠라
 * 브라우저에 두면 누구나 꺼내 쓸 수 있으므로, 이 함수만 쥐고 대신 부른다.
 *
 * 로그인한 팀원만 부를 수 있다 — Supabase가 Authorization 헤더를 먼저 검사한다.
 *
 * 발송 대상을 브라우저가 정해서 넘기지 않는다. 조건만 받아 이 함수가 DB에서 다시 뽑는다.
 * 브라우저를 거치면 번호를 바꿔치기할 수 있기 때문이다.
 *
 * 필요한 Secret
 *   SOLAPI_API_KEY      솔라피 API Key
 *   SOLAPI_API_SECRET   솔라피 API Secret
 *   SOLAPI_SENDER       사전등록한 발신번호 (숫자만, 예: 15222696)
 *   SOLAPI_PFID         (브랜드 메시지를 쓸 때만) 카카오 채널 pfId
 */

const SOLAPI = 'https://api.solapi.com'

/** 한 번에 보낼 수 있는 수. 넘으면 나눠 보낸다. */
const CHUNK = 1000

/** 광고 문자를 보내면 안 되는 시간 (밤 9시 ~ 아침 8시, 한국 시간) */
const NIGHT_START = 21
const NIGHT_END = 8

let API_KEY = ''
let API_SECRET = ''
let SENDER = ''
let PFID = ''

function loadSecrets() {
  API_KEY = (Deno.env.get('SOLAPI_API_KEY') ?? '').trim()
  API_SECRET = (Deno.env.get('SOLAPI_API_SECRET') ?? '').trim()
  SENDER = (Deno.env.get('SOLAPI_SENDER') ?? '').trim().replace(/[^0-9]/g, '')
  PFID = (Deno.env.get('SOLAPI_PFID') ?? '').trim()
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })

/** 솔라피는 HMAC 서명으로 신원을 확인한다. 열쇠 자체는 보내지 않는다. */
async function authHeader(): Promise<string> {
  const date = new Date().toISOString()
  const salt = crypto.randomUUID().replace(/-/g, '')

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(API_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signed = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(date + salt))
  const signature = Array.from(new Uint8Array(signed))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')

  return `HMAC-SHA256 apiKey=${API_KEY}, date=${date}, salt=${salt}, signature=${signature}`
}

/** 한글은 2바이트로 센다 — 90바이트를 넘으면 LMS가 되어 요금이 오른다 */
function messageBytes(text: string): number {
  let bytes = 0
  for (const ch of text) bytes += ch.charCodeAt(0) > 0x7f ? 2 : 1
  return bytes
}

/** 지금이 한국 시간으로 광고 발송 금지 시간인지 */
function isNightInKorea(): boolean {
  const hour = Number(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Seoul',
      hour: '2-digit',
      hour12: false,
    }).format(new Date()),
  )
  return hour >= NIGHT_START || hour < NIGHT_END
}

interface Target {
  memberCode: string
  name: string
  callnum: string
}

/** 이 함수는 서비스 열쇠로 DB를 본다 — 발송 대상을 브라우저 말이 아니라 DB에서 정하기 위함 */
function dbHeaders(): Record<string, string> {
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  }
}

const DB = Deno.env.get('SUPABASE_URL') ?? ''

async function rpc<T>(name: string, body: unknown): Promise<T> {
  const response = await fetch(`${DB}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: dbHeaders(),
    body: JSON.stringify(body),
  })
  if (!response.ok) throw new Error(`대상을 불러오지 못했습니다 (${response.status})`)
  return (await response.json()) as T
}

async function insert<T>(table: string, rows: unknown): Promise<T> {
  const response = await fetch(`${DB}/rest/v1/${table}`, {
    method: 'POST',
    headers: { ...dbHeaders(), Prefer: 'return=representation' },
    body: JSON.stringify(rows),
  })
  if (!response.ok) {
    throw new Error(`${table} 기록에 실패했습니다: ${await response.text()}`)
  }
  return (await response.json()) as T
}

async function patch(table: string, match: string, body: unknown): Promise<void> {
  await fetch(`${DB}/rest/v1/${table}?${match}`, {
    method: 'PATCH',
    headers: dbHeaders(),
    body: JSON.stringify(body),
  })
}

/** 고친 뒤의 캠페인을 다시 읽어 화면에 그대로 넘긴다 */
async function reload(id: string): Promise<unknown> {
  const response = await fetch(`${DB}/rest/v1/message_campaigns?id=eq.${id}&select=*`, {
    headers: dbHeaders(),
  })
  const [row] = await response.json()
  return row
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  loadSecrets()

  // 열쇠를 드러내지 않고 설정이 됐는지만 알려준다
  if (request.headers.get('x-sms-diag')) {
    return json({
      apiKey: API_KEY ? '설정됨' : '없음',
      apiSecret: API_SECRET ? '설정됨' : '없음',
      sender: SENDER ? `${SENDER.slice(0, 3)}****` : '없음',
      pfId: PFID ? '설정됨' : '없음',
    })
  }

  try {
    const { action, params } = await request.json()
    if (action !== 'send') return json({ error: '알 수 없는 요청입니다.' }, 400)

    if (!API_KEY || !API_SECRET || !SENDER) {
      return json({ error: '발송 설정이 아직 없습니다. 솔라피 열쇠와 발신번호를 넣어주세요.' }, 400)
    }

    const {
      title,
      messageBody,
      channel,
      messageType,
      isAd,
      targetMode,
      segmentId,
      segmentName,
      conditions,
      numbers,
      purpose,
      concepts,
      offerType,
      offerValue,
      hypothesis,
      draftOnly,
    } = params

    const text = String(messageBody ?? '')
    if (!draftOnly && !text.trim()) return json({ error: '보낼 내용이 비어 있습니다.' }, 400)

    if (!draftOnly && isAd && isNightInKorea()) {
      return json(
        { error: '광고 문자는 밤 9시부터 아침 8시까지 보낼 수 없습니다. 낮에 다시 시도해주세요.' },
        400,
      )
    }

    // 고객군으로 보낼 때는 대상을 브라우저가 아니라 DB에서 다시 뽑는다.
    // 번호를 직접 넣을 때는 번호 자체가 사람이 넣은 것이라 그대로 쓰되,
    // 수신거부 거르기는 여기서 한다 — 화면에서만 거르면 우회할 수 있다.
    const targets =
      targetMode === 'numbers'
        ? await rpc<{ rows: Target[] }>('check_send_numbers', { numbers: numbers ?? [] })
        : await rpc<{ rows: Target[] }>('list_send_targets', {
            conditions,
            row_limit: 100000,
          })
    const rows = targets.rows ?? []
    if (!draftOnly && rows.length === 0) {
      return json({ error: '보낼 수 있는 대상이 없습니다.' }, 400)
    }

    const kind = channel === 'brand_message' ? String(messageType) : messageBytes(text) > 90 ? 'LMS' : 'SMS'
    const unit = channel === 'brand_message' ? 15 : kind === 'LMS' ? 50 : kind === 'MMS' ? 100 : 20

    // 보내기 전에 먼저 남긴다. 중간에 끊겨도 무엇을 보내려 했는지 알 수 있어야 한다.
    const [campaign] = await insert<{ id: string }[]>('message_campaigns', {
      channel: channel ?? 'sms',
      status: draftOnly ? 'draft' : 'pending',
      message_type: kind,
      title: title ?? '',
      target_count: rows.length,
      cost_won: rows.length * unit,
      segment_id: segmentId ?? null,
      segment_name: segmentName ?? '',
      conditions,
      message_body: text,
      is_ad: !!isAd,
      source: 'admin_send',
      purpose: purpose ?? '',
      concepts: concepts ?? [],
      offer_type: offerType ?? '없음',
      offer_value: offerValue ?? '',
      hypothesis: hypothesis ?? '',
    })

    // 임시저장이면 여기서 멈춘다. 아무 데도 보내지 않는다.
    if (draftOnly) {
      return json({ campaign: await reload(campaign.id) })
    }

    let sent = 0
    let failed = 0
    const failures: string[] = []

    for (let start = 0; start < rows.length; start += CHUNK) {
      const part = rows.slice(start, start + CHUNK)
      const messages = part.map((target) => ({
        to: target.callnum.replace(/[^0-9]/g, ''),
        from: SENDER,
        text,
        ...(title ? { subject: String(title) } : {}),
      }))

      const response = await fetch(`${SOLAPI}/messages/v4/send-many/detail`, {
        method: 'POST',
        headers: { Authorization: await authHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages }),
      })
      const result = await response.json()

      if (!response.ok) {
        failed += part.length
        failures.push(result?.errorMessage ?? `발송 실패 (${response.status})`)
        continue
      }

      sent += Number(result?.groupInfo?.count?.registeredSuccess ?? part.length)
      failed += Number(result?.groupInfo?.count?.registeredFailed ?? 0)

      // 받은 사람을 남긴다 — 나중에 이들의 주문을 세어 구매 전환을 낸다
      await insert(
        'campaign_recipients',
        part.map((target) => ({
          campaign_id: campaign.id,
          member_code: target.memberCode,
          callnum: target.callnum,
          status: 'sent',
        })),
      )
    }

    await patch('message_campaigns', `id=eq.${campaign.id}`, {
      success_count: sent,
      cost_won: sent * unit,
      status: sent === 0 ? 'failed' : 'sent',
      error: failures.join(' / ').slice(0, 500),
      sent_at: new Date().toISOString(),
    })

    return json({ campaign: await reload(campaign.id) })
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : String(error) }, 500)
  }
})
