import { API_URL } from '../config'
import { useI18n } from '../i18n'
import { href } from '../router'
import { CodeBlock } from '../components/ui'

const sample = '0x52908400098527886E0F7030069857D2E4169EE7'

export function Developers() {
  const { t } = useI18n()

  const imgSnippet = `<img
  src="${API_URL}/v1/avatar/${sample}/image?s=64"
  width="32" height="32" alt="" style="border-radius:50%" />`

  const jsonSnippet = `curl ${API_URL}/v1/avatar/vitalik.eth

{
  "address": "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
  "ens": "vitalik.eth",
  "avatar": {
    "uri": "ipfs://bafy…",
    "url": "https://ipfs.io/ipfs/bafy…",
    "gateways": ["https://ipfs.io/ipfs/bafy…", "https://dweb.link/ipfs/bafy…"],
    "source": "snapshot"
  }
}`

  const batchSnippet = `curl -X POST ${API_URL}/v1/avatars \\
  -H "X-API-Key: $WALLET_FACE_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"ids": ["0xd8dA…6045", "${sample}"]}'

{ "results": [ { "address": "…", "ens": null, "avatar": { … } }, … ] }`

  const sdkSnippet = `import { avatarImageUrl, createClient } from '@wallet-face/sdk'

img.src = avatarImageUrl(address, { size: 64 })

const wf = createClient({ apiKey: process.env.WALLET_FACE_KEY })
const records = await wf.getAvatars(voters)`

  return (
    <section className="docs">
      <header className="docsHeader">
        <h1>{t.developers.title}</h1>
        <p className="lead">{t.developers.lead}</p>
        <a className="primary" href={href({ page: 'dashboard' })}>
          {t.developers.getKey}
        </a>
      </header>

      <article className="card">
        <h2>{t.developers.quickTitle}</h2>
        <p className="muted">{t.developers.quickBody}</p>
        <CodeBlock label="HTML" code={imgSnippet} />
      </article>

      <article className="card">
        <h2>{t.developers.jsonTitle}</h2>
        <p className="muted">{t.developers.jsonBody}</p>
        <CodeBlock label="GET /v1/avatar/{address|ens}" code={jsonSnippet} />
      </article>

      <article className="card">
        <h2>{t.developers.batchTitle}</h2>
        <p className="muted">{t.developers.batchBody}</p>
        <CodeBlock label="POST /v1/avatars" code={batchSnippet} />
        <p className="small muted">🔒 {t.developers.keepSecret}</p>
      </article>

      <article className="card">
        <h2>{t.developers.sdkTitle}</h2>
        <p className="muted">{t.developers.sdkBody}</p>
        <CodeBlock label="JavaScript" code={sdkSnippet} />
      </article>

      <div className="grid2">
        <article className="card">
          <h2>{t.developers.refTitle}</h2>
          <table className="refTable">
            <tbody>
              {t.developers.params.map(([name, description]) => (
                <tr key={name}>
                  <th>
                    <code>{name}</code>
                  </th>
                  <td>{description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>
        <article className="card">
          <h2>{t.developers.limitsTitle}</h2>
          <ul className="bullets">
            {t.developers.limits.map((limit) => (
              <li key={limit}>{limit}</li>
            ))}
          </ul>
          <h3>{t.developers.errorsTitle}</h3>
          <p className="muted small">{t.developers.errorsBody}</p>
        </article>
      </div>
    </section>
  )
}
