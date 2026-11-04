export const API_URL = (import.meta.env.VITE_API_URL || 'https://api.dao.sarl').replace(/\/+$/, '')
export const GITHUB_URL = 'https://github.com/CryptographyBloke/Face'
export const CONTACT_URL = `${GITHUB_URL}/issues/new?title=${encodeURIComponent('Plan / partnership enquiry')}`

export function imageUrl(id: string, size = 256) {
  return `${API_URL}/v1/avatar/${encodeURIComponent(id)}/image?s=${size}`
}

export function shortAddress(address?: string | null) {
  if (!address) return ''
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}
