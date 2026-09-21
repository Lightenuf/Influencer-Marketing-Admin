/**
 * 메타 마케팅 API 중개소.
 *
 * 어드민은 정적 사이트라 토큰을 둘 곳이 없다. System User 토큰은 광고 계정의 예산까지
 * 바꿀 수 있어 브라우저에 두면 누구나 꺼내 쓸 수 있으므로, 이 함수만 토큰을 쥐고
 * 어드민을 대신해 메타를 부른다.
 *
 * 로그인한 팀원만 부를 수 있다 — Supabase가 Authorization 헤더의 토큰을 먼저 검사한다.
 *
 * 필요한 Secret
 *   META_ACCESS_TOKEN    System User 토큰
 *   META_AD_ACCOUNT_ID   광고 계정 번호 (act_ 없이 숫자만, 예: 1234567890)
 */

const GRAPH = 'https://graph.facebook.com/v21.0'

/**
 * 설정은 요청이 올 때마다 읽는다.
 * 함수가 이미 떠 있는 상태에서 Secret을 넣거나 고쳐도 다시 배포하지 않고 반영되게 하기 위함.
 */
let TOKEN = ''
let ACCOUNT = ''

function loadSecrets() {
  TOKEN = (Deno.env.get('META_ACCESS_TOKEN') ?? '').trim()
  ACCOUNT = (Deno.env.get('META_AD_ACCOUNT_ID') ?? '').trim().replace(/^act_/, '')
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

interface GraphRow {
  [key: string]: unknown
}

/** 메타는 오류도 200으로 주는 경우가 있어, 본문을 열어 확인한다. */
async function graph(path: string, params: Record<string, string> = {}): Promise<GraphRow[]> {
  const url = new URL(`${GRAPH}/${path}`)
  url.searchParams.set('access_token', TOKEN)
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value)

  const rows: GraphRow[] = []
  let next: string | null = url.toString()

  // 계정이 크면 여러 쪽으로 나뉘어 온다. 다음 쪽이 없을 때까지 따라간다.
  while (next) {
    const response = await fetch(next)
    const body = await response.json()
    if (body.error) {
      throw new Error(`${body.error.type ?? 'MetaError'}: ${body.error.message}`)
    }
    rows.push(...(body.data ?? []))
    next = body.paging?.next ?? null
    // 너무 많이 따라가지 않는다 — 한도에 걸리는 것을 막는다.
    if (rows.length > 5000) break
  }
  return rows
}

async function post(path: string, form: Record<string, string>) {
  const body = new URLSearchParams({ ...form, access_token: TOKEN })
  const response = await fetch(`${GRAPH}/${path}`, { method: 'POST', body })
  const result = await response.json()
  if (result.error) {
    throw new Error(`${result.error.type ?? 'MetaError'}: ${result.error.message}`)
  }
  return result
}

/** 구매는 픽셀 설정에 따라 이름이 조금씩 다르다. 먼저 잡히는 것을 쓴다. */
const PURCHASE_TYPES = [
  'omni_purchase',
  'purchase',
  'offsite_conversion.fb_pixel_purchase',
  'onsite_web_purchase',
]

const pick = (list: unknown, types: string[]): number => {
  if (!Array.isArray(list)) return 0
  for (const type of types) {
    const found = list.find((item) => (item as GraphRow).action_type === type)
    if (found) return Number((found as GraphRow).value ?? 0)
  }
  return 0
}

/** 메타 insights 한 줄을 어드민이 쓰는 모양으로 옮긴다 */
function toInsight(row: GraphRow, level: 'campaign' | 'adset' | 'ad') {
  const idKey = level === 'campaign' ? 'campaign_id' : level === 'adset' ? 'adset_id' : 'ad_id'
  return {
    level,
    id: String(row[idKey] ?? ''),
    spend: Number(row.spend ?? 0),
    revenue: pick(row.action_values, PURCHASE_TYPES),
    results: pick(row.actions, PURCHASE_TYPES),
    reach: Number(row.reach ?? 0),
    impressions: Number(row.impressions ?? 0),
    linkClicks: Number(row.inline_link_clicks ?? 0),
  }
}

const INSIGHT_FIELDS =
  'campaign_id,adset_id,ad_id,spend,impressions,reach,inline_link_clicks,actions,action_values'

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  loadSecrets()

  // 설정이 제대로 들어갔는지 확인하는 용도. 토큰 값은 내보내지 않고 길이만 알린다.
  const peek = request.headers.get('x-meta-diag')
  if (peek) {
    return json({
      tokenLength: TOKEN.length,
      accountId: ACCOUNT ? `${ACCOUNT.slice(0, 4)}…(${ACCOUNT.length}자리)` : '(없음)',
      metaSecretNames: Object.keys(Deno.env.toObject()).filter((key) => key.includes('META')),
    })
  }

  if (!TOKEN || !ACCOUNT) {
    return json(
      { error: 'META_ACCESS_TOKEN 또는 META_AD_ACCOUNT_ID가 설정되지 않았습니다.' },
      500,
    )
  }

  try {
    const { action, params = {} } = await request.json()
    const act = `act_${ACCOUNT}`

    switch (action) {
      case 'campaigns': {
        const rows = await graph(`${act}/campaigns`, {
          fields: 'id,name,status,objective,daily_budget,lifetime_budget',
          limit: '200',
        })
        return json(
          rows.map((row) => ({
            id: String(row.id),
            name: String(row.name ?? ''),
            status: row.status === 'ACTIVE' ? 'ACTIVE' : 'PAUSED',
            objective: String(row.objective ?? ''),
            // 캠페인에 예산이 있으면 캠페인 예산 최적화(CBO)를 쓰고 있는 것이다.
            isCbo: row.daily_budget != null || row.lifetime_budget != null,
            dailyBudget: row.daily_budget != null ? Number(row.daily_budget) : null,
            lifetimeBudget: row.lifetime_budget != null ? Number(row.lifetime_budget) : null,
          })),
        )
      }

      case 'adsets': {
        const rows = await graph(`${act}/adsets`, {
          fields: 'id,campaign_id,name,status,daily_budget,lifetime_budget,start_time,end_time',
          limit: '500',
        })
        return json(
          rows.map((row) => ({
            id: String(row.id),
            campaignId: String(row.campaign_id ?? ''),
            name: String(row.name ?? ''),
            status: row.status === 'ACTIVE' ? 'ACTIVE' : 'PAUSED',
            dailyBudget: row.daily_budget != null ? Number(row.daily_budget) : null,
            lifetimeBudget: row.lifetime_budget != null ? Number(row.lifetime_budget) : null,
            startDate: String(row.start_time ?? '').slice(0, 10),
            endDate: row.end_time ? String(row.end_time).slice(0, 10) : null,
          })),
        )
      }

      case 'ads': {
        const rows = await graph(`${act}/ads`, {
          fields:
            'id,adset_id,name,status,created_time,creative{object_type,thumbnail_url,branded_content_sponsor_page_id,instagram_branded_content}',
          limit: '500',
        })
        return json(
          rows.map((row) => {
            const creative = (row.creative ?? {}) as GraphRow
            const objectType = String(creative.object_type ?? '')
            return {
              id: String(row.id),
              adsetId: String(row.adset_id ?? ''),
              name: String(row.name ?? ''),
              status: row.status === 'ACTIVE' ? 'ACTIVE' : 'PAUSED',
              creativeType: objectType === 'VIDEO' ? 'video' : 'image',
              thumbnailUrl: creative.thumbnail_url ? String(creative.thumbnail_url) : null,
              isPartnership:
                creative.branded_content_sponsor_page_id != null ||
                creative.instagram_branded_content != null,
              createdAt: String(row.created_time ?? ''),
            }
          }),
        )
      }

      case 'audiences': {
        const rows = await graph(`${act}/customaudiences`, {
          fields: 'id,name,approximate_count_lower_bound',
          limit: '200',
        })
        return json(
          rows.map((row) => ({
            id: String(row.id),
            name: String(row.name ?? ''),
            approximateCount:
              row.approximate_count_lower_bound != null
                ? Number(row.approximate_count_lower_bound)
                : null,
          })),
        )
      }

      case 'insights': {
        const level = params.level as 'campaign' | 'adset' | 'ad'
        const rows = await graph(`${act}/insights`, {
          level,
          fields: INSIGHT_FIELDS,
          time_range: JSON.stringify({ since: params.from, until: params.to }),
          limit: '500',
        })
        return json(rows.map((row) => toInsight(row, level)))
      }

      case 'weekly': {
        const adIds = (params.adIds ?? []) as string[]
        if (adIds.length === 0) return json([])
        const rows = await graph(`${act}/insights`, {
          level: 'ad',
          fields: INSIGHT_FIELDS,
          time_range: JSON.stringify({ since: params.from, until: params.to }),
          time_increment: '7',
          filtering: JSON.stringify([{ field: 'ad.id', operator: 'IN', value: adIds }]),
          limit: '1000',
        })
        return json(
          rows.map((row) => {
            const spend = Number(row.spend ?? 0)
            const revenue = pick(row.action_values, PURCHASE_TYPES)
            return {
              adId: String(row.ad_id ?? ''),
              weekStart: String(row.date_start ?? ''),
              spend,
              revenue,
              roas: spend > 0 ? revenue / spend : 0,
            }
          }),
        )
      }

      case 'setAdStatus': {
        await post(String(params.adId), { status: String(params.status) })
        return json({ ok: true })
      }

      case 'setDailyBudget': {
        // 원화는 보조 단위가 없어 원 그대로 보낸다. (달러였다면 센트로 보내야 한다)
        await post(String(params.id), { daily_budget: String(Math.round(Number(params.won))) })
        return json({ ok: true })
      }

      default:
        return json({ error: `알 수 없는 요청입니다: ${action}` }, 400)
    }
  } catch (error) {
    // 메타가 준 메시지를 그대로 넘겨 어드민에서 원인을 볼 수 있게 한다.
    return json({ error: error instanceof Error ? error.message : String(error) }, 502)
  }
})
