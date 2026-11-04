import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Address } from 'viem'
import { connectWallet, disconnectWallet, restoreWallet, type AppWalletClient } from './wallet'

type Status = 'restoring' | 'idle' | 'connecting' | 'disconnecting'

interface WalletState {
  address?: Address
  walletClient?: AppWalletClient
  status: Status
  connect(): Promise<Address | undefined>
  disconnect(): Promise<void>
}

const WalletContext = createContext<WalletState | null>(null)

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<Address>()
  const [walletClient, setWalletClient] = useState<AppWalletClient>()
  const [status, setStatus] = useState<Status>('restoring')

  useEffect(() => {
    let active = true
    const provider = window.ethereum

    const apply = (wallet: Awaited<ReturnType<typeof restoreWallet>>) => {
      if (!active) return
      setAddress(wallet?.address)
      setWalletClient(wallet?.walletClient)
    }

    restoreWallet()
      .then(apply)
      .catch(() => apply(null))
      .finally(() => active && setStatus('idle'))

    const handleAccountsChanged = () => {
      restoreWallet().then(apply).catch(() => apply(null))
    }
    const handleDisconnect = () => apply(null)

    provider?.on?.('accountsChanged', handleAccountsChanged)
    provider?.on?.('disconnect', handleDisconnect)
    return () => {
      active = false
      provider?.removeListener?.('accountsChanged', handleAccountsChanged)
      provider?.removeListener?.('disconnect', handleDisconnect)
    }
  }, [])

  const connect = useCallback(async () => {
    setStatus('connecting')
    try {
      const wallet = await connectWallet()
      setAddress(wallet.address)
      setWalletClient(wallet.walletClient)
      return wallet.address
    } finally {
      setStatus('idle')
    }
  }, [])

  const disconnect = useCallback(async () => {
    setStatus('disconnecting')
    await disconnectWallet()
    setAddress(undefined)
    setWalletClient(undefined)
    setStatus('idle')
  }, [])

  const value = useMemo(
    () => ({ address, walletClient, status, connect, disconnect }),
    [address, walletClient, status, connect, disconnect],
  )
  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
}

export function useWallet() {
  const context = useContext(WalletContext)
  if (!context) throw new Error('useWallet must be used inside WalletProvider')
  return context
}
