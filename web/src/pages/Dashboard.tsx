import { useCallback, useEffect, useState } from 'react'
import { ApiError, api, clearSession, loadSession, signIn, type AccountSummary, type PlanId, type Session } from '../api'
import { CONTACT_URL } from '../config'
import { friendlyError, useI18n } from '../i18n'
import { href } from '../router'
import { useWallet } from '../useWallet'
import { WalletButton } from '../components/Layout'
import { CopyField, Notice } from '../components/ui'
import { pendingPlanKey } from './Pricing'

function takePendingPlan(): PlanId | null {
  try {
    const plan = window.sessionStorage.getItem(pendingPlanKey)
    window.sessionStorage.removeItem(pendingPlanKey)
    return plan === 'pro' || plan === 'business' ? plan : null
  } catch {
    return null
  }
}

export function Dashboard({ query }: { query: URLSearchParams }) {
  const { t, language } = useI18n()
  const { address, walletClient } = useWallet()
  const [session, setSession] = useState<Session | null>(() => loadSession(address))
  const [account, setAccount] = useState<AccountSummary | null>(null)
  const [newKey, setNewKey] = useState<string | null>(null)
  const [busy, setBusy] = useState<'signin' | 'key' | 'billing' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const locale = language === 'zh' ? 'zh-CN' : 'en-US'
  const formatDate = (seconds: number) => new Date(seconds * 1000).toLocaleDateString(locale, { dateStyle: 'medium' })
  const formatNumber = (value: number) => value.toLocaleString(locale)

  const handleApiError = useCallback(
    (cause: unknown) => {
      if (cause instanceof ApiError && cause.status === 401) {
        clearSession()
        setSession(null)
        setAccount(null)
        setError(t.dashboard.sessionExpired)
      } else if (cause instanceof ApiError && cause.status === 0) {
        setError(t.dashboard.apiDown)
      } else {
        setError(friendlyError(cause, t))
      }
    },
    [t],
  )

  // Switching wallets switches sessions.
  useEffect(() => {
    setSession(loadSession(address))
    setAccount(null)
    setNewKey(null)
  }, [address])

  const refresh = useCallback(
    (token: string) =>
      api
        .account(token)
        .then(setAccount)
        .catch(handleApiError),
    [handleApiError],
  )

  useEffect(() => {
    if (!session) return
    void refresh(session.token)
    if (query.get('checkout') === 'success') {
      // Stripe webhooks can land a moment after the redirect.
      const timer = window.setTimeout(() => void refresh(session.token), 3500)
      return () => window.clearTimeout(timer)
    }
  }, [session, refresh, query])

  const startCheckout = async (token: string, plan: PlanId) => {
    setBusy('billing')
    try {
      window.location.assign((await api.checkout(token, plan)).url)
    } catch (cause) {
      handleApiError(cause)
      setBusy(null)
    }
  }

  const doSignIn = async () => {
    if (!address || !walletClient) return
    setError(null)
    setBusy('signin')
    try {
      const next = await signIn(walletClient, address)
      setSession(next)
      const plan = takePendingPlan()
      if (plan) return void (await startCheckout(next.token, plan))
    } catch (cause) {
      handleApiError(cause)
    }
    setBusy(null)
  }

  const createKey = async () => {
    if (!session) return
    if (account?.apiKey && !window.confirm(t.dashboard.rotateConfirm)) return
    setBusy('key')
    setError(null)
    try {
      const created = await api.createKey(session.token)
      setNewKey(created.key)
      await refresh(session.token)
    } catch (cause) {
      handleApiError(cause)
    }
    setBusy(null)
  }

  const openPortal = async () => {
    if (!session) return
    setBusy('billing')
    try {
      window.location.assign((await api.portal(session.token)).url)
    } catch (cause) {
      handleApiError(cause)
      setBusy(null)
    }
  }

  if (!address) {
    return (
      <section className="narrow card center">
        <h1>{t.dashboard.title}</h1>
        <p className="muted">{t.dashboard.connectFirst}</p>
        <WalletButton onError={setError} />
        {error && <Notice tone="error">{error}</Notice>}
      </section>
    )
  }

  if (!session) {
    return (
      <section className="narrow card center">
        <h1>{t.dashboard.signInTitle}</h1>
        <p className="muted">{t.dashboard.signInBody}</p>
        <button className="primary" disabled={busy !== null} onClick={() => void doSignIn()}>
          {busy === 'signin' ? t.dashboard.signingIn : t.dashboard.signIn}
        </button>
        {error && <Notice tone="error">{error}</Notice>}
      </section>
    )
  }

  const usagePercent = account
    ? Math.min(100, Math.round((account.usage.requests / account.limits.monthlyRequests) * 1000) / 10)
    : 0

  return (
    <section className="dashboard">
      <header className="dashHeader">
        <h1>{t.dashboard.title}</h1>
        <button
          className="ghost small"
          onClick={() => {
            clearSession()
            setSession(null)
            setAccount(null)
          }}
        >
          {t.dashboard.signOut}
        </button>
      </header>

      {query.get('checkout') === 'success' && <Notice tone="success">{t.dashboard.checkoutSuccess}</Notice>}
      {error && <Notice tone="error">{error}</Notice>}

      {!account ? (
        <div className="card center">
          <p className="muted">{t.common.working}</p>
        </div>
      ) : (
        <>
          <div className="grid2">
            <article className="card">
              <p className="eyebrow">{t.dashboard.plan}</p>
              <h2 className="planName">{account.plan.toUpperCase()}</h2>
              <p className="muted small">
                {t.pricing.requests(formatNumber(account.limits.monthlyRequests))} · {t.pricing.batch(account.limits.batchSize)}
              </p>
            </article>

            <article className="card">
              <p className="eyebrow">{t.dashboard.usage}</p>
              <h2>
                {formatNumber(account.usage.requests)}{' '}
                <span className="muted small">
                  {t.dashboard.of} {formatNumber(account.limits.monthlyRequests)}
                </span>
              </h2>
              <div className="meter" role="progressbar" aria-valuenow={usagePercent} aria-valuemin={0} aria-valuemax={100}>
                <span style={{ width: `${usagePercent}%` }} className={usagePercent > 90 ? 'hot' : ''} />
              </div>
              {account.history.length > 1 && (
                <ul className="history">
                  {account.history.map((row) => (
                    <li key={row.period}>
                      <span>{row.period}</span>
                      <span>{formatNumber(row.count)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </article>
          </div>

          <article className="card">
            <h2>{t.dashboard.apiKey}</h2>
            {newKey ? (
              <>
                <Notice tone="success">{t.dashboard.newKey}</Notice>
                <CopyField label="Key" value={newKey} />
              </>
            ) : account.apiKey ? (
              <p>
                <code>{account.apiKey.prefix}</code>{' '}
                <span className="muted small">{t.dashboard.keyCreated(formatDate(account.apiKey.createdAt))}</span>
              </p>
            ) : (
              <p className="muted">{t.dashboard.noKey}</p>
            )}
            <div className="row">
              <button className={account.apiKey ? 'ghost' : 'primary'} disabled={busy !== null} onClick={() => void createKey()}>
                {busy === 'key' ? t.common.working : account.apiKey ? t.dashboard.rotateKey : t.dashboard.createKey}
              </button>
              <a className="ghost" href={href({ page: 'developers' })}>
                {t.nav.developers} →
              </a>
            </div>
          </article>

          <article className="card">
            <h2>{t.dashboard.billing}</h2>
            {account.subscription && (
              <p className="muted small">
                {t.dashboard.status}: <strong>{account.subscription.status}</strong>
                {account.subscription.currentPeriodEnd
                  ? ` · ${t.dashboard.renews(formatDate(account.subscription.currentPeriodEnd))}`
                  : ''}
              </p>
            )}
            <div className="row">
              {account.subscription && account.billing ? (
                <button className="ghost" disabled={busy !== null} onClick={() => void openPortal()}>
                  {busy === 'billing' ? t.common.working : t.dashboard.manage}
                </button>
              ) : (
                <a className="primary" href={href({ page: 'pricing' })}>
                  {t.dashboard.upgrade}
                </a>
              )}
              {!account.billing && (
                <a className="ghost" href={CONTACT_URL} target="_blank" rel="noreferrer">
                  {t.pricing.contact}
                </a>
              )}
            </div>
          </article>
        </>
      )}
    </section>
  )
}
