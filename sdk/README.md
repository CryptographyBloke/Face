# @wallet-face/sdk

A small client for the Wallet Face resolver API, with no dependencies.

```js
import { avatarImageUrl, createClient } from '@wallet-face/sdk'

// Show any wallet's avatar. No key is needed for images.
img.src = avatarImageUrl('0x5290…9ee7', { size: 64 })

// JSON lookups (anonymous use is rate-limited per IP)
const wf = createClient({ apiKey: process.env.WALLET_FACE_KEY })
const { avatar, ens } = await wf.getAvatar('vitalik.eth')

// Batch lookups need an API key
const records = await wf.getAvatars(['0x…', '0x…'])
```

Keep API keys on your server. Don't put them in browser code.
