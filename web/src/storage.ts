import { upload as pineappleUpload } from '@snapshot-labs/pineapple'

const maxFileSize = 1024 * 1024
const supportedTypes = new Set(['image/jpeg', 'image/jpg', 'image/png'])

export function validateAvatarFile(file: File) {
  if (!supportedTypes.has(file.type)) throw new Error('Please choose a JPG or PNG image.')
  if (file.size > maxFileSize) throw new Error('Image is too large. Keep it under 1 MB.')
}

export async function uploadAvatar(file: File) {
  validateAvatarFile(file)

  const formData = new FormData()
  formData.append('file', file)

  const endpoint = import.meta.env.VITE_PINEAPPLE_URL || undefined
  // Pineapple rejects with a plain `{ error: { message } }` object, not an Error.
  const receipt = await pineappleUpload(formData, endpoint).catch((cause: unknown) => {
    const message = (cause as { error?: { message?: string } })?.error?.message
    throw new Error(`Image upload failed${message ? `: ${message}` : '.'}`)
  })
  const cid = typeof receipt?.cid === 'string' ? receipt.cid : receipt?.cid?.toString?.()

  if (!cid) throw new Error(receipt?.error?.message || 'Image upload did not return an IPFS CID.')
  return assertContentAddressedUri(`ipfs://${cid}`)
}

export function assertContentAddressedUri(uri: string) {
  const normalized = uri.trim()
  if (!/^(ipfs|ar):\/\//i.test(normalized)) {
    throw new Error('Avatar storage must return an ipfs:// or ar:// URI.')
  }
  if (normalized.length > 256) throw new Error('Avatar URI is too long for a Snapshot profile.')
  return normalized
}

const defaultIpfsGateways = ['https://ipfs.io/ipfs/', 'https://dweb.link/ipfs/', 'https://w3s.link/ipfs/']

function ipfsGateways() {
  const configured = import.meta.env.VITE_IPFS_GATEWAY as string | undefined
  const list = configured ? [configured, ...defaultIpfsGateways] : defaultIpfsGateways
  return [...new Set(list.map((gateway) => (gateway.endsWith('/') ? gateway : `${gateway}/`)))]
}

/** Every HTTP URL that may serve this avatar, in preference order. */
export function resolveAvatarUris(uri: string | null | undefined): string[] {
  if (!uri) return []
  const value = uri.trim()
  if (value.startsWith('ipfs://')) {
    const path = value.slice('ipfs://'.length).replace(/^ipfs\//, '')
    return ipfsGateways().map((gateway) => `${gateway}${path}`)
  }
  if (value.startsWith('ar://')) {
    const gateway = (import.meta.env.VITE_ARWEAVE_GATEWAY || 'https://arweave.net').replace(/\/$/, '')
    return [`${gateway}/${value.slice('ar://'.length)}`]
  }
  if (/^https:\/\//i.test(value)) return [value]
  return []
}

export function resolveAvatarUri(uri: string | null | undefined) {
  return resolveAvatarUris(uri)[0] ?? null
}
