import { useEffect, useState, type ReactNode } from 'react'
import { useI18n } from '../i18n'

export function AvatarImage({
  sources,
  alt,
  size = 160,
  className = '',
}: {
  sources: string[]
  alt: string
  size?: number
  className?: string
}) {
  const key = sources.join('|')
  const [index, setIndex] = useState(0)
  useEffect(() => setIndex(0), [key])

  const source = sources[index]
  const style = { width: size, height: size }
  if (!source) {
    return (
      <div className={`avatar avatarEmpty ${className}`} style={style} role="img" aria-label={alt}>
        <svg viewBox="0 0 24 24" width={size / 3} height={size / 3} aria-hidden="true">
          <circle cx="12" cy="8" r="4" fill="currentColor" />
          <path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" fill="currentColor" />
        </svg>
      </div>
    )
  }
  return (
    <img
      key={source}
      className={`avatar ${className}`}
      style={style}
      src={source}
      alt={alt}
      onError={() => setIndex((current) => current + 1)}
    />
  )
}

export function CopyButton({ value, label }: { value: string; label?: string }) {
  const { t } = useI18n()
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (!copied) return
    const timer = window.setTimeout(() => setCopied(false), 1600)
    return () => window.clearTimeout(timer)
  }, [copied])
  return (
    <button
      type="button"
      className="ghost small"
      onClick={() => {
        void navigator.clipboard?.writeText(value).then(() => setCopied(true))
      }}
    >
      {copied ? t.profile.copied : label || t.profile.copy}
    </button>
  )
}

export function CodeBlock({ code, label }: { code: string; label?: string }) {
  return (
    <div className="code">
      <div className="codeBar">
        <span>{label}</span>
        <CopyButton value={code} />
      </div>
      <pre>
        <code>{code}</code>
      </pre>
    </div>
  )
}

export function CopyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="copyField">
      <span className="copyLabel">{label}</span>
      <code title={value}>{value}</code>
      <CopyButton value={value} />
    </div>
  )
}

export function Notice({ tone = 'info', children }: { tone?: 'info' | 'error' | 'success'; children: ReactNode }) {
  return (
    <p className={`notice ${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      {children}
    </p>
  )
}
