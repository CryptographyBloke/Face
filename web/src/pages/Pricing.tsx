import { useEffect, useState } from 'react'
import { api, fallbackPlans, loadSession, type Plan, type PlanId } from '../api'
import { CONTACT_URL } from '../config'
import { friendlyError, useI18n } from '../i18n'
import { href, navigate } from '../router'
import { useWallet } from '../useWallet'
import { Notice } from '../components/ui'

export const pendingPlanKey = 'wallet-face-pending-plan'

export function Pricing({ query }: { query: URLSearchParams }) {
  const { t, language } = useI18n()
  const { address } = useWallet()
  const [plans, setPlans] = useState<Plan[]>(fallbackPlans)
  const [billing, setBilling] = useState<boolean | null>(null)
  const [currentPlan, setCurrentPlan] = useState<PlanId | null>(null)
  const [working, setWorking] = useState<PlanId | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api
      .plans()
      .then((result) => {
        setPlans(result.plans)
        setBilling(result.billing)
      })
      .catch(() => setBilling(false))
  }, [])

  useEffect(() => {
    const session = loadSession(address)
    if (!session) return setCurrentPlan(null)
    api
      .account(session.token)
      .then((account) => setCurrentPlan(account.plan))
      .catch(() => setCurrentPlan(null))
  }, [address])

  const number = new Intl.NumberFormat(language === 'zh' ? 'zh-CN' : 'en-US', { notation: 'compact' })

  const choose = async (plan: PlanId) => {
    setError(null)
    if (plan === 'free') return navigate({ page: 'dashboard' })
    const session = loadSession(address)
    if (!session) {
      // Sign in first; the dashboard resumes the checkout afterwards.
      try {
        window.sessionStorage.setItem(pendingPlanKey, plan)
      } catch {
        // The user can pick the plan again after signing in.
      }
      return navigate({ page: 'dashboard' })
    }
    setWorking(plan)
    try {
      const { url } = await api.checkout(session.token, plan)
      window.location.assign(url)
    } catch (cause) {
      setError(friendlyError(cause, t))
      setWorking(null)
    }
  }

  return (
    <section className="pricing">
      <header className="docsHeader center">
        <h1>{t.pricing.title}</h1>
        <p className="lead">{t.pricing.lead}</p>
      </header>

      {query.get('checkout') === 'cancelled' && <Notice>{t.pricing.cancelled}</Notice>}
      {billing === false && <Notice>{t.pricing.billingOff}</Notice>}
      {error && <Notice tone="error">{error}</Notice>}

      <div className="grid3">
        {plans.map((plan) => {
          const isCurrent = currentPlan === plan.id
          const featured = plan.id === 'pro'
          return (
            <article key={plan.id} className={`card planCard ${featured ? 'featured' : ''}`}>
              <h2>{plan.name}</h2>
              <p className="price">
                <strong>${plan.priceUsd}</strong> <span className="muted">{t.pricing.perMonth}</span>
              </p>
              <ul className="bullets">
                <li>{t.pricing.requests(number.format(plan.monthlyRequests))}</li>
                <li>{t.pricing.batch(plan.batchSize)}</li>
                {(t.pricing.extras[plan.id] || []).map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>
              {isCurrent ? (
                <button className="ghost block" disabled>
                  {t.pricing.current}
                </button>
              ) : plan.id !== 'free' && billing === false ? (
                <a className="ghost block" href={CONTACT_URL} target="_blank" rel="noreferrer">
                  {t.pricing.contact}
                </a>
              ) : (
                <button
                  className={`${featured ? 'primary' : 'ghost'} block`}
                  disabled={working !== null}
                  onClick={() => void choose(plan.id)}
                >
                  {working === plan.id ? t.common.working : plan.id === 'free' ? t.pricing.free : t.pricing.upgrade}
                </button>
              )}
            </article>
          )
        })}
      </div>

      <section className="section">
        <h2>{t.pricing.faqTitle}</h2>
        <div className="grid2">
          {t.pricing.faq.map(([question, answer]) => (
            <article key={question} className="card">
              <h3>{question}</h3>
              <p className="muted">{answer}</p>
            </article>
          ))}
        </div>
        <p className="center small">
          <a href={href({ page: 'developers' })}>{t.nav.developers} →</a>
        </p>
      </section>
    </section>
  )
}
