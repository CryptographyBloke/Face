import { useEffect, useState } from 'react'
import { getAddress, isAddress } from 'viem'
import { ApiError, api, type AvatarRecord } from './api'
import { readSnapshotAvatar } from './snapshot'
import { resolveAvatarUris } from './storage'

export type RecordState =
  | { status: 'loading' }
  | { status: 'ready'; record: AvatarRecord; offline: boolean }
  | { status: 'error'; code: string; message: string }

/**
 * Resolve through the Wallet Face API. If the API itself is unreachable, read
 * the Snapshot profile directly so the site keeps working without it.
 */
export async function lookupAvatar(id: string): Promise<{ record: AvatarRecord; offline: boolean }> {
  try {
    return { record: await api.avatar(id), offline: false }
  } catch (error) {
    const apiDown = error instanceof ApiError && (error.status === 0 || error.status >= 500)
    if (!apiDown || !isAddress(id, { strict: false })) throw error
    const address = getAddress(id)
    const uri = await readSnapshotAvatar(address)
    const gateways = resolveAvatarUris(uri)
    return {
      offline: true,
      record: {
        address,
        ens: null,
        avatar: uri && gateways.length ? { uri, url: gateways[0], gateways, source: 'snapshot' } : null,
      },
    }
  }
}

export function useAvatarRecord(id: string | undefined, refreshKey = 0): RecordState {
  const [state, setState] = useState<RecordState>({ status: 'loading' })
  useEffect(() => {
    if (!id) return
    let active = true
    setState({ status: 'loading' })
    lookupAvatar(id)
      .then(({ record, offline }) => active && setState({ status: 'ready', record, offline }))
      .catch((error) => {
        if (!active) return
        const code = error instanceof ApiError ? error.code : 'error'
        setState({ status: 'error', code, message: error instanceof Error ? error.message : String(error) })
      })
    return () => {
      active = false
    }
  }, [id, refreshKey])
  return state
}
