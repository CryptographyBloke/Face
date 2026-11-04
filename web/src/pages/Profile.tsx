import { API_URL, imageUrl, shortAddress } from '../config'
import { useI18n } from '../i18n'
import { href } from '../router'
import { useAvatarRecord } from '../useAvatarRecord'
import { useWallet } from '../useWallet'
import { AvatarImage, CopyField, Notice } from '../components/ui'

export function Profile({ id }: { id: string }) {
  const { t } = useI18n()
  const { address: connected } = useWallet()
  const state = useAvatarRecord(id)

  if (state.status === 'loading') {
    return (
      <section className="narrow card center">
        <AvatarImage sources={[]} alt="" size={160} className="pulse" />
        <p className="muted">{t.profile.loading}</p>
      </section>
    )
  }

  if (state.status === 'error') {
    const invalid = state.code === 'invalid_identifier' || state.code === 'invalid_address' || state.code === 'name_not_found'
    return (
      <section className="narrow card center">
        <AvatarImage sources={[]} alt="" size={160} />
        <Notice tone="error">{invalid ? t.profile.invalid : state.message}</Notice>
        <a className="ghost" href={href({ page: 'home' })}>
          ← {t.nav.studio}
        </a>
      </section>
    )
  }

  const { record, offline } = state
  const avatar = record.avatar
  const isMine = connected?.toLowerCase() === record.address.toLowerCase()
  const imgUrl = imageUrl(record.address, 256)
  const jsonUrl = `${API_URL}/v1/avatar/${record.address}`
  const embed = `<img src="${imgUrl}" width="64" height="64" alt="${shortAddress(record.address)}" style="border-radius:50%" />`

  return (
    <section className="narrow">
      <div className="card profileCard">
        <AvatarImage
          sources={avatar ? [...avatar.gateways, imgUrl] : offline ? [] : [imgUrl]}
          alt={record.ens || record.address}
          size={180}
        />
        <div className="profileText">
          <p className="eyebrow">{t.profile.title}</p>
          <h1 className="profileName">{record.ens || shortAddress(record.address)}</h1>
          <code className="address">{record.address}</code>
          {avatar ? (
            <dl className="facts">
              <div>
                <dt>{t.profile.source}</dt>
                <dd>{avatar.source === 'ens' ? t.profile.sourceEns : t.profile.sourceSnapshot}</dd>
              </div>
              <div>
                <dt>{t.profile.uri}</dt>
                <dd>
                  <code className="uri" title={avatar.uri}>
                    {avatar.uri}
                  </code>
                </dd>
              </div>
            </dl>
          ) : (
            <p className="muted">{t.profile.notFound}</p>
          )}
          {isMine && (
            <p className="small">
              {t.profile.yours}{' '}
              <a href={href({ page: 'home' })}>{t.profile.edit} →</a>
            </p>
          )}
        </div>
      </div>

      {offline && <Notice>{t.profile.offline}</Notice>}

      <div className="card">
        <h2>{t.profile.embedTitle}</h2>
        <CopyField label={t.profile.imageLink} value={imgUrl} />
        <CopyField label={t.profile.jsonLink} value={jsonUrl} />
        <CopyField label={t.profile.htmlEmbed} value={embed} />
      </div>
    </section>
  )
}
