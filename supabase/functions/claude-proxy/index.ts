/**
 * Claude 중개소 — 카피 만들기와 다음 실험 제안.
 *
 * 어드민은 정적 사이트라 열쇠를 둘 곳이 없다. Anthropic 키는 이 함수만 쥔다.
 * 로그인한 팀원만 부를 수 있다 — Supabase 가 Authorization 헤더를 먼저 검사한다.
 *
 * 브랜드 사실과 금지어는 코드에 박지 않는다. 운영 기준(ops_settings)에서 읽는다 —
 * 제품이 바뀌거나 표현이 늘 때마다 함수를 다시 배포할 수는 없다.
 *
 * 필요한 Secret
 *   ANTHROPIC_API_KEY
 *   ANTHROPIC_WORKSPACE_ID  (선택) 키가 워크스페이스에 묶여 있지 않을 때만 필요하다.
 *                           콘솔의 워크스페이스 설정에서 wrkspc_... 로 시작하는 값.
 */

const API = 'https://api.anthropic.com/v1/messages'
const MODEL = 'claude-sonnet-5'

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

const DB = Deno.env.get('SUPABASE_URL') ?? ''

function dbHeaders(): Record<string, string> {
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  return { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }
}

async function loadSettings(): Promise<Record<string, unknown>> {
  const response = await fetch(`${DB}/rest/v1/ops_settings?select=key,value`, {
    headers: dbHeaders(),
  })
  const rows = (await response.json()) as { key: string; value: unknown }[]
  const out: Record<string, unknown> = {}
  for (const row of rows) out[row.key] = row.value
  return out
}

/** Claude 에게 물어보고 JSON 만 받아낸다 */
/**
 * 잘린 JSON 배열에서 온전한 부분까지만 건진다.
 *
 * 길이 제한에 걸리면 마지막 객체가 반쯤 쓰이다 끊긴다.
 * 그 하나 때문에 열 개를 다 버리는 것보다, 끝난 것까지는 쓰는 편이 낫다.
 */
function salvageArray(text: string): unknown[] | null {
  for (let at = text.lastIndexOf('}'); at > 0; at = text.lastIndexOf('}', at - 1)) {
    try {
      return JSON.parse(`${text.slice(0, at + 1)}]`) as unknown[]
    } catch {
      // 더 앞쪽 객체에서 끊어 본다
    }
  }
  return null
}

async function ask(system: string, user: string, maxTokens = 8000): Promise<unknown> {
  const key = (Deno.env.get('ANTHROPIC_API_KEY') ?? '').trim()
  if (!key) throw new Error('ANTHROPIC_API_KEY 가 설정되지 않았습니다.')

  // 조직 전체용 키는 어느 워크스페이스를 쓸지 따로 알려줘야 한다.
  // 워크스페이스에 묶인 키를 쓰면 이 값은 없어도 된다.
  const workspace = (Deno.env.get('ANTHROPIC_WORKSPACE_ID') ?? '').trim()

  const response = await fetch(API, {
    method: 'POST',
    headers: {
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
      ...(workspace ? { 'anthropic-workspace-id': workspace } : {}),
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  })

  const body = await response.json()
  if (!response.ok) {
    throw new Error(body?.error?.message ?? `Claude 호출 실패 (${response.status})`)
  }

  // 길이에 걸려 끊겼는지 알아두면 원인을 찾기 쉽다
  const truncated = body.stop_reason === 'max_tokens'

  const text = (body.content ?? [])
    .filter((part: { type: string }) => part.type === 'text')
    .map((part: { text: string }) => part.text)
    .join('')
  if (truncated) console.warn('Claude 응답이 길이 제한에 걸려 끊겼습니다.')

  // 앞뒤에 설명이나 ``` 가 붙어 와도 JSON 덩어리만 꺼낸다
  const cleaned = text.replace(/```(?:json)?/g, '').trim()
  const start = cleaned.indexOf('[') >= 0 ? cleaned.indexOf('[') : cleaned.indexOf('{')
  if (start < 0) throw new Error('Claude 가 JSON 으로 답하지 않았습니다.')

  const body2 = cleaned.slice(start)
  try {
    return JSON.parse(body2)
  } catch {
    // 길이 제한에 걸려 끊겼을 수 있다. 온전한 데까지 건져 본다.
    const saved = salvageArray(body2)
    if (saved && saved.length > 0) return saved
    throw new Error(
      `Claude 응답을 읽지 못했습니다. 앞부분: ${body2.slice(0, 200)}`,
    )
  }
}

/** 브랜드 사실 + 규제 — 두 요청이 같이 쓴다 */
function brandSystem(settings: Record<string, unknown>): string {
  const facts = String(settings.brandFacts ?? '')
  const banned = (settings.bannedWords as string[]) ?? []
  const fiber = Number(settings.fiberGram ?? 4)

  return [
    '너는 브리보(Breevo)의 퍼포먼스 마케터다. 메타 광고 카피를 쓴다.',
    '',
    '## 브랜드 사실 (이 범위를 벗어나지 마라)',
    facts,
    '',
    '## 반드시 지킬 것',
    '- 한국 식품표시광고법을 지킨다. 질병 예방·치료나 효능·효과를 암시하지 마라.',
    `- 다음 표현은 절대 쓰지 마라: ${banned.join(', ')}`,
    `- 식이섬유 수치는 ${fiber}g 로만 적어라. 다른 수치를 지어내지 마라.`,
    '- 없는 사실(수상, 인증, 임상, 순위)을 지어내지 마라.',
    '- 숫자를 쓸 때는 브랜드 사실에 있는 것만 써라.',
    '',
    '## 답하는 방법',
    'JSON 만 출력한다. 설명이나 인사말을 붙이지 마라.',
  ].join('\n')
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  // 열쇠가 들어 있는지만 알려준다. 값은 보여주지 않는다
  if (request.headers.get('x-claude-diag')) {
    return json({ apiKey: (Deno.env.get('ANTHROPIC_API_KEY') ?? '').trim() ? '설정됨' : '없음' })
  }

  try {
    const { action, params = {} } = await request.json()
    const settings = await loadSettings()
    const system = brandSystem(settings)

    switch (action) {
      // ── 카피 대량 생산 (8-3) ──
      case 'copies': {
        const {
          segment = '',
          angles = [],
          hooks = [],
          offerType = '없음',
          offerValue = '',
          perCombo = 3,
          reference = '',
          avoid = [],
        } = params as {
          segment: string
          angles: string[]
          hooks: string[]
          offerType: string
          offerValue: string
          perCombo: number
          reference: string
          avoid: string[]
        }

        const headlineMax = Number(settings.headlineMaxChars ?? 18)
        const subheadMax = Number(settings.subheadMaxChars ?? 30)
        const bodyMax = Number(settings.bodyMaxChars ?? 125)

        const lines = [
          `세그먼트: ${segment || '전체'}`,
          `앵글: ${angles.join(', ') || '자유'}`,
          `훅: ${hooks.join(', ') || '자유'}`,
          `오퍼: ${offerType}${offerValue ? ` ${offerValue}` : ''}`,
          '',
          `앵글 × 훅 조합마다 ${perCombo}개씩 써라.`,
          '',
          '각 카피는 이 모양의 객체다:',
          '{',
          `  "headline": "이미지에 얹을 헤드라인 (${headlineMax}자 이내)",`,
          `  "subhead": "서브헤드 (${subheadMax}자 이내)",`,
          '  "badge": "배지 문구 (없으면 빈 문자열)",',
          `  "body": "메타 광고 본문 (${bodyMax}자 이내)",`,
          '  "linkTitle": "메타 headline (25자 이내)",',
          '  "angle": "쓴 앵글",',
          '  "hook": "쓴 훅"',
          '}',
          '',
          '배열로 출력해라.',
        ]

        if (reference) {
          lines.push('', '## 성과가 좋았던 카피 (참고만 하고 베끼지 마라)', reference)
        }
        if (avoid.length > 0) {
          lines.push(
            '',
            '## 지난번에 반려된 이유 (되풀이하지 마라)',
            avoid.map((item) => `- ${item}`).join('\n'),
          )
        }

        const result = await ask(system, lines.join('\n'))
        return json({ copies: Array.isArray(result) ? result : [] })
      }

      // ── 다음 실험 제안 (9-3) ──
      case 'nextExperiments': {
        const { history = '', tagPerformance = '' } = params as {
          history: string
          tagPerformance: string
        }

        const user = [
          '아래는 지금까지 한 실험과 태그별 성과다.',
          '',
          '## 끝난 실험',
          history || '(아직 없음)',
          '',
          '## 태그별 성과',
          tagPerformance || '(아직 없음)',
          '',
          '다음에 해볼 실험 2~3개를 제안해라.',
          '한 실험에 변수는 하나만 바꾼다. 권장 순서는 앵글 → 훅 → 비주얼 → 오퍼다.',
          '이미 해본 것을 그대로 되풀이하지 마라.',
          '',
          '각 제안은 이 모양의 객체다:',
          '{',
          '  "name": "실험 이름",',
          '  "hypothesis": "무엇을 기대하는가 — 한 문장",',
          '  "variable": "angle | hook | format | offer | segment 중 하나",',
          '  "variants": ["견줄 값", "견줄 값"],',
          '  "why": "왜 이걸 해봐야 하는지 — 위 자료를 근거로 한 문장"',
          '}',
          '',
          '배열로 출력해라.',
        ].join('\n')

        const result = await ask(system, user, 2000)
        return json({ ideas: Array.isArray(result) ? result : [] })
      }

      default:
        return json({ error: `알 수 없는 요청입니다: ${action}` }, 400)
    }
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : String(error) }, 500)
  }
})
