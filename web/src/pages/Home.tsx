import { useState } from 'react'
import { isAddress } from 'viem'
import { Studio } from '../components/Studio'
import { useI18n } from '../i18n'
import { href, navigate } from '../router'

export function isLookupTarget(value: string) {
  const trimmed = value.trim()
  return isAddress(trimmed, { strict: false }) || /^[^\s/]+\.[a-z]{2,}$/i.test(trimmed)
}

export function Home() {
  const { t } = useI18n()
  const [lookup, setLookup] = useState('')
  const [lookupError, setLookupError] = useState(false)

  return (
    <>
      <section className="hero">
        <div className="heroText">
          <p className="eyebrow">{t.home.eyebrow}</p>
          <h1>{t.home.title}</h1>
          <p className="lead">{t.home.lead}</p>
          <div className="heroActions">
            <button
              className="primary"
              onClick={() => document.getElementById('studio')?.scrollIntoView({ behavior: 'smooth' })}
            >
              {t.home.ctaStudio}
            </button>
            <a className="ghost" href={href({ page: 'developers' })}>
              {t.home.ctaDevelopers}
            </a>
          </div>
          <form
            className="lookup"
            onSubmit={(event) => {
              event.preventDefault()
              if (!isLookupTarget(lookup)) return setLookupError(true)
              navigate({ page: 'profile', id: lookup.trim() })
            }}
          >
            <label htmlFor="lookup" className="small muted">
              {t.home.lookupTitle}
            </label>
            <div className="lookupRow">
              <input
                id="lookup"
                value={lookup}
                placeholder={t.home.lookupPlaceholder}
                spellCheck={false}
                autoComplete="off"
                onChange={(event) => {
                  setLookup(event.target.value)
                  setLookupError(false)
                }}
              />
              <button className="primary" type="submit">
                {t.home.lookupButton}
              </button>
            </div>
            {lookupError && <p className="fieldError">{t.home.lookupInvalid}</p>}
          </form>
        </div>
        <div id="studio" className="heroStudio">
          <Studio />
        </div>
      </section>

      <section className="section">
        <h2>{t.home.featuresTitle}</h2>
        <div className="grid4">
          {t.home.features.map((feature) => (
            <article key={feature.title} className="card feature">
              <h3>{feature.title}</h3>
              <p className="muted">{feature.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section">
        <h2>{t.home.howTitle}</h2>
        <ol className="steps">
          {t.home.how.map((step, index) => (
            <li key={step} className="card">
              <span className="stepNumber">{index + 1}</span>
              <p>{step}</p>
            </li>
          ))}
        </ol>
      </section>
    </>
  )
}
