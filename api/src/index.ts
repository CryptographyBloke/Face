import { accountSummary, activeKeyPrefix, addUsage, ensureAccount, findApiKey, getUsage, rotateApiKey, usageHistory, type ApiKeyOwner } from './accounts'
import { createChallenge, requireDb, requireSession, verifyChallenge } from './auth'
import { billingEnabled, createCheckout, createPortal, handleStripeWebhook } from './billing'
import type { Env, ExecutionContext, RateLimiter } from './env'
import { HttpError, bearerToken, corsHeaders, errorResponse, json, readJson } from './http'
import { identiconSvg } from './identicon'
import { isPlanId, plans } from './plans'
import { fetchAvatarImage, resolveAvatar, resolveAvatars, type AvatarRecord, type EnsLookup } from './resolve'

export interface WorkerEnv extends Env {
  IMAGE_RATE_LIMITER?: RateLimiter
}

/** Test seam: lets tests replace ENS lookups without mocking JSON-RPC. */
export interface Overrides {
  ens?: EnsLookup | null
}

const recordTtlSeconds = 300

function edgeCache(): Cache | null {
  const storage = (globalThis as { caches?: CacheStorage & { default?: Cache } }).caches
  return storage?.default ?? null
}

function clientIp(request: Request) {
  return request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() || 'unknown'
}

function apiKeyFrom(request: Request) {
  const header = request.headers.get('X-API-Key')?.trim()
  if (header) return header
  const bearer = bearerToken(request)
  return bearer?.startsWith('wf_') ? bearer : null
}

interface Metered {
  owner: ApiKeyOwner | null
  headers: Record<string, string>
}

/**
 * Keyed callers are counted against their monthly plan quota. Anonymous callers
 * are limited per IP by the Workers rate-limiting binding when configured.
 */
async function meter(env: WorkerEnv, request: Request, ctx: ExecutionContext, cost: number): Promise<Metered> {
  const key = apiKeyFrom(request)
  if (!key) {
    if (env.RATE_LIMITER) {
      const { success } = await env.RATE_LIMITER.limit({ key: `anon:${clientIp(request)}` })
      if (!success) {
        throw new HttpError(429, 'rate_limited', 'Too many requests. Get a free API key for higher limits.')
      }
    }
    return { owner: null, headers: {} }
  }

  const db = requireDb(env)
  const owner = await findApiKey(db, key)
  if (!owner) throw new HttpError(401, 'invalid_api_key', 'This API key is invalid or has been revoked.')

  const limit = plans[owner.plan].monthlyRequests
  const used = await getUsage(db, owner.address)
  if (used + cost > limit) {
    throw new HttpError(429, 'quota_exceeded', `Monthly quota of ${limit} requests reached. Upgrade your plan to continue.`)
  }
  ctx.waitUntil(addUsage(db, owner.address, cost).catch((error) => console.error('usage write failed', error)))
  return {
    owner,
    headers: {
      'X-RateLimit-Limit': String(limit),
      'X-RateLimit-Remaining': String(Math.max(0, limit - used - cost)),
      'X-Wallet-Face-Plan': owner.plan,
    },
  }
}

async function cachedRecord(env: Env, identifier: string, ctx: ExecutionContext, overrides: Overrides) {
  const cache = edgeCache()
  const cacheKey = new Request(`https://cache.wallet-face.internal/v1/record/${encodeURIComponent(identifier.toLowerCase())}`)
  const hit = await cache?.match(cacheKey)
  if (hit) return (await hit.json()) as AvatarRecord

  const record = await resolveAvatar(env, identifier, overrides.ens === undefined ? undefined : overrides.ens)
  if (cache) {
    const response = new Response(JSON.stringify(record), {
      headers: { 'Cache-Control': `public, max-age=${recordTtlSeconds}` },
    })
    ctx.waitUntil(cache.put(cacheKey, response))
  }
  return record
}

const imageSecurityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox",
}

async function avatarImage(env: WorkerEnv, request: Request, identifier: string, ctx: ExecutionContext, overrides: Overrides) {
  const url = new URL(request.url)
  const size = Math.max(16, Math.min(1024, Number(url.searchParams.get('s')) || 256))
  const fallback = url.searchParams.get('fallback') === '404' ? '404' : 'identicon'

  const cache = edgeCache()
  const cacheKey = new Request(
    `https://cache.wallet-face.internal/v1/image/${encodeURIComponent(identifier.toLowerCase())}?s=${size}&fallback=${fallback}`,
  )
  const hit = await cache?.match(cacheKey)
  if (hit) return hit

  // Only cache misses do upstream work, so only they count toward the per-IP limit.
  if (env.IMAGE_RATE_LIMITER) {
    const { success } = await env.IMAGE_RATE_LIMITER.limit({ key: `img:${clientIp(request)}` })
    if (!success) throw new HttpError(429, 'rate_limited', 'Too many image requests.')
  }

  let record: AvatarRecord | null = null
  try {
    record = await cachedRecord(env, identifier, ctx, overrides)
  } catch (error) {
    if (error instanceof HttpError && error.status === 400) throw error
  }

  const image = record?.avatar ? await fetchAvatarImage(record.avatar.gateways) : null
  let response: Response
  if (image) {
    response = new Response(image.body, {
      headers: {
        ...corsHeaders,
        ...imageSecurityHeaders,
        'Content-Type': image.contentType,
        'Cache-Control': 'public, max-age=3600, s-maxage=86400',
        'X-Avatar-Source': record!.avatar!.source,
      },
    })
  } else if (fallback === '404') {
    response = json(
      { error: { code: 'avatar_not_found', message: 'No avatar is published for this wallet.' } },
      { status: 404, headers: { 'Cache-Control': 'public, max-age=300' } },
    )
  } else {
    response = new Response(identiconSvg(record?.address || identifier, size), {
      headers: {
        ...corsHeaders,
        ...imageSecurityHeaders,
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, max-age=300',
        'X-Avatar-Source': 'identicon',
      },
    })
  }

  if (cache) ctx.waitUntil(cache.put(cacheKey, response.clone()))
  return response
}

function serviceInfo(env: Env) {
  return {
    name: 'Wallet Face API',
    version: '1',
    docs: `${(env.APP_URL || 'https://dao.sarl').replace(/\/$/, '')}/#/developers`,
    endpoints: {
      avatar: 'GET /v1/avatar/{address|ens}',
      image: 'GET /v1/avatar/{address|ens}/image?s=256&fallback=identicon|404',
      batch: 'POST /v1/avatars { "ids": ["0x…"] }  (API key required)',
      plans: 'GET /v1/plans',
    },
  }
}

export async function handleRequest(
  request: Request,
  env: WorkerEnv,
  ctx: ExecutionContext,
  overrides: Overrides = {},
): Promise<Response> {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders })

  const url = new URL(request.url)
  const path = url.pathname.replace(/\/+$/, '') || '/'
  const { method } = request

  try {
    if (method === 'GET' && path === '/') return json(serviceInfo(env))
    if (method === 'GET' && path === '/health') return json({ ok: true })

    if (method === 'GET' && path === '/v1/plans') {
      return json(
        { plans: Object.values(plans), billing: billingEnabled(env) },
        { headers: { 'Cache-Control': 'public, max-age=300' } },
      )
    }

    const imageMatch = /^\/v1\/avatar\/([^/]+)\/image$/.exec(path)
    if (method === 'GET' && imageMatch) return await avatarImage(env, request, imageMatch[1], ctx, overrides)

    const avatarMatch = /^\/v1\/avatar\/([^/]+)$/.exec(path)
    if (method === 'GET' && avatarMatch) {
      const metered = await meter(env, request, ctx, 1)
      const record = await cachedRecord(env, avatarMatch[1], ctx, overrides)
      return json(record, {
        headers: { ...metered.headers, 'Cache-Control': metered.owner ? 'private, no-store' : 'public, max-age=60' },
      })
    }

    if (method === 'POST' && path === '/v1/avatars') {
      if (!apiKeyFrom(request)) {
        throw new HttpError(401, 'api_key_required', 'Batch lookups need an API key. Create one for free in the dashboard.')
      }
      const body = await readJson<{ ids?: unknown }>(request)
      if (!Array.isArray(body.ids) || !body.ids.length || !body.ids.every((id) => typeof id === 'string')) {
        throw new HttpError(400, 'invalid_request', 'Send { "ids": ["0x…", …] }.')
      }
      const db = requireDb(env)
      const owner = await findApiKey(db, apiKeyFrom(request)!)
      if (!owner) throw new HttpError(401, 'invalid_api_key', 'This API key is invalid or has been revoked.')
      const maxBatch = plans[owner.plan].batchSize
      if (body.ids.length > maxBatch) {
        throw new HttpError(400, 'batch_too_large', `Your plan allows up to ${maxBatch} addresses per batch.`)
      }
      const metered = await meter(env, request, ctx, body.ids.length)
      const results = await resolveAvatars(env, body.ids as string[])
      return json({ results }, { headers: { ...metered.headers, 'Cache-Control': 'private, no-store' } })
    }

    if (method === 'GET' && path === '/v1/auth/nonce') {
      return json(await createChallenge(env, url.searchParams.get('address')), {
        headers: { 'Cache-Control': 'no-store' },
      })
    }

    if (method === 'POST' && path === '/v1/auth/verify') {
      const body = await readJson<{ address?: unknown; nonce?: unknown; signature?: unknown }>(request)
      const session = await verifyChallenge(env, body)
      await ensureAccount(requireDb(env), session.address)
      return json(session, { headers: { 'Cache-Control': 'no-store' } })
    }

    if (method === 'GET' && path === '/v1/account') {
      const address = await requireSession(env, request)
      const db = requireDb(env)
      const account = await ensureAccount(db, address)
      const [usage, key, history] = await Promise.all([
        getUsage(db, address),
        activeKeyPrefix(db, address),
        usageHistory(db, address),
      ])
      return json(
        { ...accountSummary(account, usage, key), history, billing: billingEnabled(env) },
        { headers: { 'Cache-Control': 'no-store' } },
      )
    }

    if (method === 'POST' && path === '/v1/account/keys') {
      const address = await requireSession(env, request)
      const db = requireDb(env)
      await ensureAccount(db, address)
      return json(await rotateApiKey(db, address), { status: 201, headers: { 'Cache-Control': 'no-store' } })
    }

    if (method === 'POST' && path === '/v1/billing/checkout') {
      const address = await requireSession(env, request)
      const body = await readJson<{ plan?: unknown }>(request)
      if (!isPlanId(body.plan)) throw new HttpError(400, 'invalid_plan', 'Unknown plan.')
      return json(await createCheckout(env, address, body.plan))
    }

    if (method === 'POST' && path === '/v1/billing/portal') {
      const address = await requireSession(env, request)
      return json(await createPortal(env, address))
    }

    if (method === 'POST' && path === '/v1/billing/webhook') {
      return json(await handleStripeWebhook(env, request))
    }

    throw new HttpError(404, 'not_found', 'Route not found. See GET / for the endpoint list.')
  } catch (error) {
    return errorResponse(error)
  }
}

export default {
  fetch(request: Request, env: WorkerEnv, ctx: ExecutionContext) {
    return handleRequest(request, env, ctx)
  },
}
