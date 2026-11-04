export const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-API-Key',
  'Access-Control-Expose-Headers':
    'X-RateLimit-Limit, X-RateLimit-Remaining, X-Avatar-Source, X-Wallet-Face-Plan',
  'Access-Control-Max-Age': '86400',
}

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message)
  }
}

export function json(body: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers)
  headers.set('Content-Type', 'application/json; charset=utf-8')
  for (const [key, value] of Object.entries(corsHeaders)) {
    if (!headers.has(key)) headers.set(key, value)
  }
  return new Response(JSON.stringify(body), { ...init, headers })
}

export function errorResponse(error: unknown) {
  if (error instanceof HttpError) {
    return json({ error: { code: error.code, message: error.message } }, { status: error.status })
  }
  console.error(error)
  return json(
    { error: { code: 'internal_error', message: 'Something went wrong. Please try again.' } },
    { status: 500 },
  )
}

export function withCors(response: Response) {
  const headers = new Headers(response.headers)
  for (const [key, value] of Object.entries(corsHeaders)) {
    if (!headers.has(key)) headers.set(key, value)
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

export async function readJson<T>(request: Request, maxBytes = 64 * 1024): Promise<T> {
  const text = await request.text()
  if (text.length > maxBytes) throw new HttpError(413, 'payload_too_large', 'Request body is too large.')
  try {
    return JSON.parse(text) as T
  } catch {
    throw new HttpError(400, 'invalid_json', 'Request body must be valid JSON.')
  }
}

export function bearerToken(request: Request) {
  const header = request.headers.get('Authorization') || ''
  const match = /^Bearer\s+(.+)$/i.exec(header.trim())
  return match?.[1]?.trim() || null
}
