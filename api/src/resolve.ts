import { createPublicClient, getAddress, http, isAddress, type Address } from 'viem'
import { mainnet } from 'viem/chains'
import { normalize } from 'viem/ens'
import type { Env } from './env'
import { HttpError } from './http'

export type AvatarSource = 'snapshot' | 'ens'

export interface AvatarRecord {
  address: Address
  ens: string | null
  avatar: {
    /** Original URI as published (ipfs://, ar://, https://). */
    uri: string
    /** Best HTTP URL to load the image directly. */
    url: string
    /** All candidate HTTP URLs, in preference order. */
    gateways: string[]
    source: AvatarSource
  } | null
}

export interface EnsLookup {
  addressForName(name: string): Promise<Address | null>
  nameForAddress(address: Address): Promise<string | null>
  avatarForName(name: string): Promise<string | null>
}

const defaultHub = 'https://hub.snapshot.org/graphql'
const defaultIpfsGateways = ['https://ipfs.io/ipfs/', 'https://dweb.link/ipfs/', 'https://w3s.link/ipfs/']
const defaultArweave = 'https://arweave.net/'

export const maxImageBytes = 5 * 1024 * 1024

export function parseIdentifier(raw: string): { address: Address } | { name: string } {
  const value = decodeURIComponent(raw).trim()
  if (/^0x[0-9a-fA-F]{40}$/.test(value)) {
    if (!isAddress(value, { strict: false })) {
      throw new HttpError(400, 'invalid_address', 'Not a valid Ethereum address.')
    }
    return { address: getAddress(value) }
  }
  if (value.includes('.') && value.length <= 255) {
    try {
      return { name: normalize(value) }
    } catch {
      // fall through to the error below
    }
  }
  throw new HttpError(400, 'invalid_identifier', 'Use a 0x address or an ENS name such as vitalik.eth.')
}

export function ipfsGateways(env: Env) {
  const list = (env.IPFS_GATEWAYS || '')
    .split(',')
    .map((value) => value.trim())
    .filter((value) => /^https:\/\//i.test(value))
  return (list.length ? list : defaultIpfsGateways).map((value) => (value.endsWith('/') ? value : `${value}/`))
}

/** Expand a content URI into HTTP URLs, in preference order. */
export function gatewayUrls(uri: string, env: Env): string[] {
  const value = uri.trim()
  if (/^ipfs:\/\//i.test(value)) {
    const path = value.replace(/^ipfs:\/\/(ipfs\/)?/i, '')
    if (!/^[a-z0-9]+(\/[^\s]*)?$/i.test(path)) return []
    return ipfsGateways(env).map((gateway) => `${gateway}${path}`)
  }
  if (/^ar:\/\//i.test(value)) {
    const id = value.slice('ar://'.length)
    if (!/^[a-z0-9_-]+$/i.test(id)) return []
    const gateway = env.ARWEAVE_GATEWAY || defaultArweave
    return [`${gateway.endsWith('/') ? gateway : `${gateway}/`}${id}`]
  }
  if (/^https:\/\//i.test(value)) return [value]
  return []
}

async function snapshotQuery<T>(env: Env, query: string, variables: Record<string, unknown>) {
  const response = await fetch(env.SNAPSHOT_HUB_URL || defaultHub, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(6000),
  })
  const body = (await response.json().catch(() => ({}))) as { data?: T; errors?: Array<{ message?: string }> }
  if (!response.ok || body.errors?.length) {
    throw new HttpError(
      502,
      'upstream_error',
      body.errors?.[0]?.message || `Snapshot hub responded with HTTP ${response.status}.`,
    )
  }
  return body.data as T
}

export async function snapshotAvatar(env: Env, address: Address) {
  const data = await snapshotQuery<{ user?: { avatar?: unknown } | null }>(
    env,
    'query Avatar($id: String!) { user(id: $id) { avatar } }',
    { id: address },
  )
  const avatar = data?.user?.avatar
  return typeof avatar === 'string' && avatar.trim() ? avatar.trim() : null
}

export async function snapshotAvatars(env: Env, addresses: Address[]) {
  const result = new Map<string, string>()
  if (!addresses.length) return result
  const data = await snapshotQuery<{ users?: Array<{ id?: string; avatar?: unknown }> | null }>(
    env,
    'query Avatars($ids: [String]!, $first: Int!) { users(first: $first, where: { id_in: $ids }) { id avatar } }',
    { ids: addresses, first: addresses.length },
  )
  for (const user of data?.users || []) {
    if (typeof user.id === 'string' && typeof user.avatar === 'string' && user.avatar.trim()) {
      result.set(user.id.toLowerCase(), user.avatar.trim())
    }
  }
  return result
}

export function viemEnsLookup(env: Env): EnsLookup | null {
  if (!env.ETH_RPC_URL) return null
  const client = createPublicClient({
    chain: mainnet,
    transport: http(env.ETH_RPC_URL, { timeout: 6000, retryCount: 1 }),
  })
  return {
    addressForName: (name) => client.getEnsAddress({ name }),
    nameForAddress: (address) => client.getEnsName({ address }),
    avatarForName: (name) =>
      client.getEnsAvatar({ name, assetGatewayUrls: { ipfs: ipfsGateways(env)[0].replace(/\/ipfs\/$/, '') } }),
  }
}

function toRecord(address: Address, ens: string | null, uri: string | null, source: AvatarSource, env: Env): AvatarRecord {
  if (!uri) return { address, ens, avatar: null }
  const gateways = gatewayUrls(uri, env)
  if (!gateways.length) return { address, ens, avatar: null }
  return { address, ens, avatar: { uri, url: gateways[0], gateways, source } }
}

export async function resolveAvatar(
  env: Env,
  identifier: string,
  ens: EnsLookup | null = viemEnsLookup(env),
): Promise<AvatarRecord> {
  const parsed = parseIdentifier(identifier)
  let address: Address
  let name: string | null = null

  if ('name' in parsed) {
    if (!ens) throw new HttpError(400, 'ens_unavailable', 'ENS lookups are not enabled on this server.')
    const resolved = await ens.addressForName(parsed.name).catch(() => null)
    if (!resolved) throw new HttpError(404, 'name_not_found', `${parsed.name} does not resolve to an address.`)
    address = getAddress(resolved)
    name = parsed.name
  } else {
    address = parsed.address
  }

  const fromSnapshot = await snapshotAvatar(env, address).catch((error) => {
    // An ENS fallback is still useful when Snapshot is down.
    if (!ens) throw error
    return null
  })
  const snapshotRecord = toRecord(address, name, fromSnapshot, 'snapshot', env)
  if (snapshotRecord.avatar || !ens) return snapshotRecord

  try {
    name ||= await ens.nameForAddress(address)
    if (!name) return { address, ens: null, avatar: null }
    const url = await ens.avatarForName(name)
    return toRecord(address, name, url, 'ens', env)
  } catch {
    return { address, ens: name, avatar: null }
  }
}

export async function resolveAvatars(env: Env, identifiers: string[]): Promise<AvatarRecord[]> {
  const addresses = identifiers.map((identifier) => {
    const parsed = parseIdentifier(identifier)
    if (!('address' in parsed)) {
      throw new HttpError(400, 'batch_addresses_only', 'Batch lookups accept 0x addresses only.')
    }
    return parsed.address
  })
  const unique = [...new Map(addresses.map((address) => [address.toLowerCase(), address])).values()]
  const found = await snapshotAvatars(env, unique)
  return addresses.map((address) =>
    toRecord(address, null, found.get(address.toLowerCase()) || null, 'snapshot', env),
  )
}

function sniffImageType(bytes: Uint8Array) {
  const hex = [...bytes.slice(0, 12)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
  if (hex.startsWith('89504e47')) return 'image/png'
  if (hex.startsWith('ffd8ff')) return 'image/jpeg'
  if (hex.startsWith('47494638')) return 'image/gif'
  if (hex.startsWith('52494646') && hex.slice(16, 24) === '57454250') return 'image/webp'
  return null
}

/** Fetch the first gateway that returns a real image within the size limit. */
export async function fetchAvatarImage(urls: string[], timeoutMs = 5000) {
  for (const url of urls) {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(timeoutMs),
        headers: { Accept: 'image/*' },
      })
      if (!response.ok) continue
      const declared = Number(response.headers.get('Content-Length') || 0)
      if (declared > maxImageBytes) continue
      const buffer = new Uint8Array(await response.arrayBuffer())
      if (!buffer.byteLength || buffer.byteLength > maxImageBytes) continue
      const headerType = (response.headers.get('Content-Type') || '').split(';')[0].trim().toLowerCase()
      const type = headerType.startsWith('image/') ? headerType : sniffImageType(buffer)
      if (!type) continue
      return { body: buffer, contentType: type, url }
    } catch {
      // Try the next gateway.
    }
  }
  return null
}
