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
 *   META_AD_ACCOUNT_ID   기본 광고 계정 번호 (act_ 없이 숫자만, 예: 1234567890)
 *   META_AD_ACCOUNT_IDS  (선택) 쉼표로 이어 붙인 계정 목록. 계정을 오갈 때 쓴다.
 *                        여기 적힌 계정만 부를 수 있다 — 브라우저가 아무 계정이나
 *                        넘기지 못하게 하기 위함이다.
 */

const GRAPH = 'https://graph.facebook.com/v21.0'

/**
 * 설정은 요청이 올 때마다 읽는다.
 * 함수가 이미 떠 있는 상태에서 Secret을 넣거나 고쳐도 다시 배포하지 않고 반영되게 하기 위함.
 */
let TOKEN = ''
let ACCOUNT = ''
let ACCOUNTS: string[] = []

/** 크리에이티브를 만들 때 '누가 올리는 광고인지'로 쓰인다 */
let PAGE_ID = ''
let INSTAGRAM_ID = ''

function loadSecrets() {
  TOKEN = (Deno.env.get('META_ACCESS_TOKEN') ?? '').trim()
  ACCOUNT = (Deno.env.get('META_AD_ACCOUNT_ID') ?? '').trim().replace(/^act_/, '')
  // 기본 계정은 늘 목록에 있다. 설정하지 않았으면 계정 하나로 동작한다.
  ACCOUNTS = [
    ...new Set(
      [ACCOUNT, ...(Deno.env.get('META_AD_ACCOUNT_IDS') ?? '').split(',')]
        .map((id) => id.trim().replace(/^act_/, ''))
        .filter(Boolean),
    ),
  ]
  PAGE_ID = (Deno.env.get('META_PAGE_ID') ?? '').trim()
  INSTAGRAM_ID = (Deno.env.get('META_INSTAGRAM_ACTOR_ID') ?? '').trim()
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
      accountCount: ACCOUNTS.length,
      pageId: PAGE_ID || '(없음 — 소재 업로드에 필요)',
      instagramId: INSTAGRAM_ID || '(없음 — 소재 업로드에 필요)',
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
    // 브라우저가 고른 계정을 그대로 믿지 않는다. 허용 목록에 있는 것만 받는다.
    const asked = String(params.accountId ?? '').trim().replace(/^act_/, '')
    if (asked && !ACCOUNTS.includes(asked)) {
      return json({ error: `허용되지 않은 광고 계정입니다: ${asked}` }, 400)
    }
    const act = `act_${asked || ACCOUNT}`

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
            'id,adset_id,name,status,created_time,creative{object_type,thumbnail_url,image_hash,video_id,effective_object_story_id,branded_content_sponsor_page_id,instagram_branded_content}',
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
              // 같은 소재가 여러 세트에 복제돼 있어, 합산하려면 무엇이 같은 소재인지 알아야 한다 (5-4)
              imageHash: creative.image_hash ? String(creative.image_hash) : null,
              videoId: creative.video_id ? String(creative.video_id) : null,
              postId: creative.effective_object_story_id
                ? String(creative.effective_object_story_id)
                : null,
              createdAt: String(row.created_time ?? ''),
            }
          }),
        )
      }

      case 'health': {
        // 광고가 안 나갈 때 왜인지 알려주는 신호들을 한 번에 모은다.
        // 어드민 화면에서는 '켜짐/꺼짐'만 보이지만, 실제로 전달되는지는
        // 상위 캠페인 상태·계정 상태·심사 결과까지 봐야 안다.
        const out: Record<string, unknown> = {}

        // 1) 계정 — 미납·정지
        try {
          const [account] = await graph(act, {
            fields: 'account_status,disable_reason,balance,amount_spent,currency',
          })
          out.account = {
            // 1 활성 · 2 정지 · 3 미납 · 7 검토중 · 9 유예
            status: Number(account?.account_status ?? 0),
            disableReason: Number(account?.disable_reason ?? 0),
            balance: Number(account?.balance ?? 0),
            currency: String(account?.currency ?? ''),
          }
        } catch (error) {
          out.account = { error: String(error) }
        }

        // 2) 토큰 만료 — 과거에 실제로 끊긴 적이 있다
        try {
          const url = new URL('https://graph.facebook.com/debug_token')
          url.searchParams.set('input_token', TOKEN)
          url.searchParams.set('access_token', TOKEN)
          const body = await (await fetch(url.toString())).json()
          const data = body?.data ?? {}
          out.token = {
            valid: data.is_valid === true,
            // 0 이면 만료 없음(System User 토큰)
            expiresAt: Number(data.expires_at ?? 0),
            scopes: (data.scopes ?? []).length,
          }
        } catch (error) {
          out.token = { error: String(error) }
        }

        // 3) 광고 — 실제 전달 상태. 상위가 꺼져 있으면 여기에 드러난다
        try {
          const rows = await graph(`${act}/ads`, {
            fields: 'id,name,effective_status,issues_info',
            limit: '500',
          })
          const counts: Record<string, number> = {}
          const troubled: { id: string; name: string; status: string; issue: string }[] = []
          for (const row of rows) {
            const status = String(row.effective_status ?? '')
            counts[status] = (counts[status] ?? 0) + 1
            const issues = (row.issues_info ?? []) as GraphRow[]
            if (issues.length > 0 || status === 'DISAPPROVED' || status === 'WITH_ISSUES') {
              troubled.push({
                id: String(row.id),
                name: String(row.name ?? ''),
                status,
                issue: String(issues[0]?.error_summary ?? issues[0]?.error_message ?? ''),
              })
            }
          }
          out.ads = { counts, troubled: troubled.slice(0, 20) }
        } catch (error) {
          out.ads = { error: String(error) }
        }

        return json(out)
      }

      case 'accounts': {
        // 이름까지 붙여 준다 — 화면에서 번호만 보면 어느 계정인지 알 수 없다
        const rows = await Promise.all(
          ACCOUNTS.map(async (id) => {
            try {
              const [info] = await graph(`act_${id}`, { fields: 'name' })
              return { id, name: String(info?.name ?? `계정 ${id}`) }
            } catch {
              // 토큰에 권한이 없는 계정이면 이름을 못 읽는다. 목록에는 남긴다.
              return { id, name: `계정 ${id} (이름을 읽지 못함)` }
            }
          }),
        )
        return json(rows)
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

      case 'daily': {
        // 피로도(빈도 상승 + CTR 연속 하락)를 보려면 하루 단위가 필요하다.
        // 주 단위로는 사흘 연속 떨어지는 흐름이 보이지 않는다.
        const adIds = (params.adIds ?? []) as string[]
        if (adIds.length === 0) return json([])
        const rows = await graph(`${act}/insights`, {
          level: 'ad',
          fields: INSIGHT_FIELDS,
          time_range: JSON.stringify({ since: params.from, until: params.to }),
          time_increment: '1',
          filtering: JSON.stringify([{ field: 'ad.id', operator: 'IN', value: adIds }]),
          limit: '2000',
        })
        return json(
          rows.map((row) => {
            const spend = Number(row.spend ?? 0)
            const revenue = pick(row.action_values, PURCHASE_TYPES)
            const impressions = Number(row.impressions ?? 0)
            const reach = Number(row.reach ?? 0)
            const linkClicks = Number(row.inline_link_clicks ?? 0)
            return {
              adId: String(row.ad_id ?? ''),
              day: String(row.date_start ?? ''),
              spend,
              revenue,
              results: pick(row.actions, PURCHASE_TYPES),
              impressions,
              reach,
              linkClicks,
              ctr: impressions > 0 ? (linkClicks / impressions) * 100 : 0,
              // 한 사람이 평균 몇 번 봤나. 오르면 같은 사람에게 반복 노출되고 있다는 뜻이다.
              frequency: reach > 0 ? impressions / reach : 0,
            }
          }),
        )
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

      case 'igAccounts': {
        // 인스타 계정 ID는 용도별로 여러 개다. 광고에 쓸 수 있는 것만 모아 보여준다.
        const found: GraphRow[] = []

        try {
          const linked = await graph(`${act}/instagram_accounts`, { fields: 'id,username' })
          for (const row of linked) found.push({ ...row, from: '광고 계정에 연결됨' })
        } catch (error) {
          found.push({ from: '광고 계정에 연결됨', error: String(error) })
        }

        if (PAGE_ID) {
          try {
            const viaPage = await graph(`${PAGE_ID}/instagram_accounts`, { fields: 'id,username' })
            for (const row of viaPage) found.push({ ...row, from: '페이지에 연결됨' })
          } catch (error) {
            found.push({ from: '페이지에 연결됨', error: String(error) })
          }
          try {
            const backed = await graph(`${PAGE_ID}/page_backed_instagram_accounts`, {
              fields: 'id,username',
            })
            for (const row of backed) found.push({ ...row, from: '페이지 전용 계정' })
          } catch (error) {
            found.push({ from: '페이지 전용 계정', error: String(error) })
          }
        }

        return json({ current: INSTAGRAM_ID, candidates: found })
      }

      case 'uploadImage': {
        // 이미지는 크지 않아 함수를 거쳐 그대로 넘긴다.
        const form = new URLSearchParams({
          access_token: TOKEN,
          bytes: String(params.base64),
          name: String(params.name ?? 'creative'),
        })
        const response = await fetch(`${GRAPH}/${act}/adimages`, { method: 'POST', body: form })
        const result = await response.json()
        if (result.error) throw new Error(result.error.message)
        // 응답이 { images: { <파일이름>: { hash } } } 모양으로 온다.
        const first = Object.values(result.images ?? {})[0] as GraphRow | undefined
        if (!first?.hash) throw new Error('이미지를 올렸지만 메타가 해시를 주지 않았습니다.')
        return json({ kind: 'image', imageHash: String(first.hash) })
      }

      case 'uploadVideo': {
        // 영상은 함수를 통과시키지 않는다. 주소만 넘기면 메타가 직접 받아간다.
        const result = await post(`${act}/advideos`, {
          file_url: String(params.fileUrl),
          name: String(params.name ?? 'creative'),
        })
        if (!result.id) throw new Error('영상을 올렸지만 메타가 id를 주지 않았습니다.')
        return json({ kind: 'video', videoId: String(result.id), thumbnailUrl: null })
      }

      case 'createAd': {
        if (!PAGE_ID) throw new Error('META_PAGE_ID가 설정되지 않았습니다.')

        const assets = (params.creatives ?? []) as Array<GraphRow & { ref: GraphRow }>
        if (assets.length === 0) throw new Error('올릴 소재가 없습니다.')

        const link = String(params.landingUrl)
        const message = String(params.primaryText ?? '')
        const cta = { type: String(params.cta), value: { link } }
        const isVideo = assets[0].ref.kind === 'video'

        const storySpec: GraphRow = { page_id: PAGE_ID }
        // 인스타 계정을 적으면 인스타에도 같은 계정으로 나간다. 적지 않으면 페이지 이름으로 나간다.
        if (INSTAGRAM_ID) storySpec.instagram_user_id = INSTAGRAM_ID

        const creativePayload: Record<string, string> = { name: `${params.name} 소재` }

        if (assets.length === 1) {
          // 소재가 하나면 그대로 쓴다.
          const only = assets[0].ref
          if (isVideo) {
            storySpec.video_data = {
              video_id: only.videoId,
              message,
              call_to_action: cta,
              ...(only.thumbnailUrl ? { image_url: only.thumbnailUrl } : {}),
            }
          } else {
            storySpec.link_data = { image_hash: only.imageHash, link, message, call_to_action: cta }
          }
          creativePayload.object_story_spec = JSON.stringify(storySpec)
        } else {
          /**
           * 여러 비율을 올렸으면 광고는 하나로 두고, 노출 자리에 따라 소재가 갈리게 한다.
           * 피드에는 정사각을, 스토리·릴스에는 세로를 쓴다.
           */
          const labelKey = isVideo ? 'video_label' : 'image_label'
          const slots = [...new Set(assets.map((asset) => String(asset.slot)))]

          const positionsOf = (slot: string) => {
            if (slot === 'story') {
              return {
                publisher_platforms: ['facebook', 'instagram'],
                facebook_positions: ['story'],
                instagram_positions: ['story', 'reels'],
              }
            }
            if (slot === 'ig_feed') {
              return {
                publisher_platforms: ['instagram'],
                instagram_positions: ['stream', 'explore'],
              }
            }
            if (slot === 'fb_feed') {
              return { publisher_platforms: ['facebook'], facebook_positions: ['feed'] }
            }
            return {
              publisher_platforms: ['facebook', 'instagram'],
              facebook_positions: ['feed'],
              instagram_positions: ['stream', 'explore'],
            }
          }

          const feedSpec: GraphRow = {
            ad_formats: [isVideo ? 'SINGLE_VIDEO' : 'SINGLE_IMAGE'],
            bodies: [{ text: message }],
            link_urls: [{ website_url: link }],
            call_to_action_types: [String(params.cta)],
            // 규칙이 닿지 않는 자리도 있으므로 맨 앞 소재를 기본으로 삼는다.
            // (기본이 없으면 메타가 'Invalid parameter'로 되돌려 보낸다)
            asset_customization_rules: slots.map((slot, index) => ({
              customization_spec: positionsOf(slot),
              [labelKey]: { name: slot },
              ...(index === 0 ? { is_default: true } : {}),
            })),
          }

          if (isVideo) {
            feedSpec.videos = assets.map((asset) => ({
              video_id: asset.ref.videoId,
              adlabels: [{ name: String(asset.slot) }],
            }))
          } else {
            feedSpec.images = assets.map((asset) => ({
              hash: asset.ref.imageHash,
              adlabels: [{ name: String(asset.slot) }],
            }))
          }

          creativePayload.object_story_spec = JSON.stringify(storySpec)
          creativePayload.asset_feed_spec = JSON.stringify(feedSpec)
        }

        // 파트너십 광고는 원작자를 함께 적어야 한다.
        if (params.isPartnership && params.partnerInstagramId) {
          creativePayload.branded_content = JSON.stringify({
            instagram_branded_content: { sponsor_id: params.partnerInstagramId },
          })
        }

        let made
        try {
          made = await post(`${act}/adcreatives`, creativePayload)
        } catch (error) {
          // 예전 이름을 쓰는 계정도 있어 한 번 더 시도한다.
          const message = error instanceof Error ? error.message : String(error)
          if (INSTAGRAM_ID && /instagram/i.test(message)) {
            delete storySpec.instagram_user_id
            storySpec.instagram_actor_id = INSTAGRAM_ID
            creativePayload.object_story_spec = JSON.stringify(storySpec)
            made = await post(`${act}/adcreatives`, creativePayload)
          } else {
            throw error
          }
        }

        // 항상 멈춘 상태로 만든다 — 확인하고 사람이 켠다.
        const ad = await post(`${act}/ads`, {
          name: String(params.name),
          adset_id: String(params.adsetId),
          creative: JSON.stringify({ creative_id: made.id }),
          status: 'PAUSED',
        })
        return json({ id: String(ad.id) })
      }

      case 'createCampaign': {
        const payload: Record<string, string> = {
          name: String(params.name),
          objective: String(params.objective),
          status: 'PAUSED',
          special_ad_categories: '[]',
        }
        if (params.dailyBudget) {
          payload.daily_budget = String(Math.round(Number(params.dailyBudget)))
        }
        const made = await post(`${act}/campaigns`, payload)
        return json({ id: String(made.id) })
      }

      case 'createAdSet': {
        const targeting: GraphRow = {
          geo_locations: { countries: ['KR'] },
          age_min: Number(params.ageMin ?? 18),
          age_max: Number(params.ageMax ?? 65),
        }
        if (params.genders === 'male') targeting.genders = [1]
        if (params.genders === 'female') targeting.genders = [2]
        const excluded = (params.excludedAudienceIds ?? []) as string[]
        if (excluded.length > 0) {
          targeting.excluded_custom_audiences = excluded.map((id) => ({ id }))
        }

        const payload: Record<string, string> = {
          name: String(params.name),
          campaign_id: String(params.campaignId),
          billing_event: 'IMPRESSIONS',
          optimization_goal: 'OFFSITE_CONVERSIONS',
          targeting: JSON.stringify(targeting),
          status: 'PAUSED',
        }
        if (params.dailyBudget) {
          payload.daily_budget = String(Math.round(Number(params.dailyBudget)))
        }
        const made = await post(`${act}/adsets`, payload)
        return json({ id: String(made.id) })
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
