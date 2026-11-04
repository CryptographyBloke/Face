export const DEFAULT_BASE_URL = 'https://api.dao.sarl'

export class WalletFaceError extends Error {
  constructor(status, code, message) {
    super(message)
    this.name = 'WalletFaceError'
    this.status = status
    this.code = code
  }
}

function trimBase(baseUrl) {
  return (baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, '')
}

/**
 * URL for an <img> tag. No API key is needed (or sent) for images.
 */
export function avatarImageUrl(id, { size, fallback, baseUrl } = {}) {
  const params = new URLSearchParams()
  if (size) params.set('s', String(size))
  if (fallback) params.set('fallback', fallback)
  const query = params.toString()
  return `${trimBase(baseUrl)}/v1/avatar/${encodeURIComponent(id)}/image${query ? `?${query}` : ''}`
}

export function createClient({ apiKey, baseUrl, fetch: fetchImpl } = {}) {
  const base = trimBase(baseUrl)
  const doFetch = fetchImpl || globalThis.fetch.bind(globalThis)

  async function request(path, init = {}) {
    const headers = { Accept: 'application/json', ...(init.headers || {}) }
    if (apiKey) headers['X-API-Key'] = apiKey
    const response = await doFetch(`${base}${path}`, { ...init, headers })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new WalletFaceError(
        response.status,
        body?.error?.code || 'http_error',
        body?.error?.message || `Request failed with HTTP ${response.status}`,
      )
    }
    return body
  }

  return {
    /** Resolve one address or ENS name. */
    getAvatar(id) {
      return request(`/v1/avatar/${encodeURIComponent(id)}`)
    },
    /** Resolve many addresses in one request (API key required). */
    async getAvatars(ids) {
      const { results } = await request('/v1/avatars', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      })
      return results
    },
    imageUrl(id, options = {}) {
      return avatarImageUrl(id, { ...options, baseUrl: base })
    },
  }
}
