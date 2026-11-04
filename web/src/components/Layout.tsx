import { useState, type ReactNode } from 'react'
import { API_URL, GITHUB_URL, imageUrl, shortAddress } from '../config'
import { friendlyError, useI18n, type Language } from '../i18n'
import { href, type Route } from '../router'
import { useWallet } from '../useWallet'
import { AvatarImage } from './ui'

function Logo() {
  return (
    <svg viewBox="0 0 32 32" width="28" height="28" aria-hidden="true">
      <rect width="32" height="32" rx="10" fill="var(--accent)" />
      <circle cx="16" cy="13" r="5" fill="#fff" />
      <path d="M7 26c1.6-4.4 5-6.6 9-6.6s7.4 2.2 9 6.6" fill="#fff" />
    </svg>
  )
}

export function WalletButton({ onError }: { onError?(message: string): void }) {
  const { t } = useI18n()
  const { address, status, connect, disconnect } = useWallet()

  if (!address) {
    return (
      <button
        className="primary small"
        disabled={status !== 'idle'}
        onClick={() => connect().catch((cause) => onError?.(friendlyError(cause, t)))}
      >
        {status === 'restoring' ? t.wallet.restoring : status === 'connecting' ? t.wallet.connecting : t.wallet.connect}
      </button>
    )
  }
  return (
    <div className="walletChip">
      <a href={href({ page: 'profile', id: address })} className="walletChipLink">
        <AvatarImage sources={[imageUrl(address, 64)]} alt="" size={24} />
        <span>{shortAddress(address)}</span>
      </a>
      <button className="ghost small" onClick={() => void disconnect()} disabled={status !== 'idle'}>
        {t.wallet.logout}
      </button>
    </div>
  )
}

export function Layout({ current, children }: { current: Route['page']; children: ReactNode }) {
  const { t, language, setLanguage } = useI18n()
  const [walletError, setWalletError] = useState<string | null>(null)
  const links: Array<[Route, string]> = [
    [{ page: 'home' }, t.nav.studio],
    [{ page: 'developers' }, t.nav.developers],
    [{ page: 'pricing' }, t.nav.pricing],
    [{ page: 'dashboard' }, t.nav.dashboard],
  ]

  return (
    <div className="page">
      <header className="topbar">
        <div className="topbarInner">
          <a className="brand" href="#/">
            <Logo />
            <span>Wallet Face</span>
          </a>
          <nav className="nav" aria-label="Main">
            {links.map(([route, label]) => (
              <a key={route.page} href={href(route)} aria-current={current === route.page ? 'page' : undefined}>
                {label}
              </a>
            ))}
          </nav>
          <div className="topbarActions">
            <select
              className="langSelect"
              aria-label={t.nav.language}
              value={language}
              onChange={(event) => setLanguage(event.target.value as Language)}
            >
              <option value="en">EN</option>
              <option value="zh">中文</option>
            </select>
            <WalletButton onError={setWalletError} />
          </div>
        </div>
        {walletError && (
          <div className="topbarError" role="alert">
            <span>{walletError}</span>
            <button className="ghost small" onClick={() => setWalletError(null)}>
              {t.common.close}
            </button>
          </div>
        )}
      </header>

      <main className="content">{children}</main>

      <footer className="footer">
        <div className="footerInner">
          <span>© Wallet Face · {t.footer.tagline}</span>
          <span className="footerLinks">
            <a href={GITHUB_URL} target="_blank" rel="noreferrer">
              {t.footer.source}
            </a>
            <a href={`${API_URL}/health`} target="_blank" rel="noreferrer">
              {t.footer.status}
            </a>
          </span>
        </div>
      </footer>
    </div>
  )
}
