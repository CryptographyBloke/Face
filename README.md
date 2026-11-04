# Wallet Face / 钱包头像

**One avatar for every wallet.** People publish a profile picture to their Ethereum address with one gasless signature. Apps show any wallet's avatar with a single image URL, and use the paid API for JSON, batch lookups and higher limits.

**一个头像，所有应用通用。** 用户通过一次免 Gas 签名把头像绑定到以太坊地址；应用只需一个图片链接即可显示任意钱包的头像，需要 JSON、批量查询和更高额度时可使用付费 API。

- Live site / 在线网站: <https://dao.sarl>
- API: `https://api.dao.sarl` (see [api/README.md](./api/README.md))
- Roadmap / 里程碑: [MILESTONES.md](./MILESTONES.md)

## Business model / 商业模式

| | Who | Price |
|---|---|---|
| Publishing an avatar | Wallet owners | Always free |
| Image URLs (`/image`) | Any app | Free, edge-cached |
| JSON + batch API | Apps and services | Free 10K/month · Pro $19 (1M) · Business $99 (10M) |
| White-label / custom deployments | DAOs, wallets, communities | Contact |

发布头像永久免费；图片链接免费；JSON 与批量 API 按月计费；白标部署按需洽谈。

## Repository / 仓库结构

| Path | What it is |
|---|---|
| [`web/`](./web) | React app: avatar studio, public profiles, developer docs, pricing, dashboard (EN / 中文) |
| [`api/`](./api) | Cloudflare Worker + D1: resolver, image proxy, wallet sign-in, API keys, quotas, Stripe billing |
| [`sdk/`](./sdk) | Dependency-free JavaScript client (`avatarImageUrl`, `getAvatar`, `getAvatars`) |
| `src/`, `test/` | Legacy Cloudflare/ENS DNS bootstrap CLI (not needed for the product) |

## How it works / 工作原理

1. The browser connects to a wallet through EIP-1193; the private key stays in the wallet.
2. The image is cropped to a square and compressed in the browser (512×512, under 1 MB), then uploaded to IPFS via Pineapple.
3. The wallet signs a Snapshot `Profile` message (EIP-712) containing the avatar URI. It is gasless, and the signed message goes to the Snapshot sequencer.
4. The Wallet Face API resolves any address or ENS name from Snapshot, falling back to ENS. It serves the image through several IPFS gateways with edge caching, or an identicon when there is no avatar.
5. Optionally, the user also writes the URI to their ENS `avatar` record (a mainnet transaction that costs gas).

1. 浏览器通过 EIP-1193 连接钱包，私钥留在钱包中。
2. 图片在浏览器中裁剪为正方形并压缩（512×512，小于 1 MB），通过 Pineapple 上传至 IPFS。
3. 钱包用 EIP-712 签署包含头像 URI 的 Snapshot `Profile` 消息（免 Gas），并提交到 Snapshot Sequencer。
4. Wallet Face API 从 Snapshot（回退到 ENS）解析任意地址或 ENS 名称，经多个 IPFS 网关回退和边缘缓存提供图片；没有头像时返回生成图案。
5. 可选：把同一 URI 写入 ENS `avatar` 记录（主网交易，需要 Gas）。

## Run locally / 本地运行

```bash
cd api && npm install && cp .dev.vars.example .dev.vars && npm run db:migrate:local && npm run dev
```

```bash
cd web && npm ci && VITE_API_URL=http://127.0.0.1:8787 npm run dev
```

Checks / 检查:

```bash
cd api && npm run typecheck && npm test
```

```bash
cd web && npm run test:protocol && npm run build
```

```bash
cd sdk && npm test
```

## Deploy / 部署

- **Web**: build `web/` and host `web/dist` on any static host (Cloudflare Pages, GitHub Pages, …). Set `VITE_API_URL` at build time if the API isn't at `https://api.dao.sarl`.
- **API**: follow [api/README.md](./api/README.md). The **Deploy API** GitHub workflow (manual) deploys it once the `CLOUDFLARE_API_TOKEN` secret is set.

## Compatibility and limits / 兼容性与边界

There is no universal avatar registry. Snapshot, Stamp and ENS-aware apps read these avatars natively; any other app has to integrate the API or the image URL. 不存在能强制所有网站统一读取头像的注册表；其他应用需要接入 API 或图片链接。

## Security / 安全

- The app never asks for a seed phrase or private key; sign-in is a message signature.
- API keys are stored hashed and are shown only once. Payments go through Stripe; no funds are held.
- Images and profiles are public. Logging out clears local state but does not delete IPFS or Snapshot data.

- 应用不会索要助记词或私钥；登录只是消息签名。
- API 密钥只保存哈希值，仅显示一次；付款由 Stripe 处理，不托管资金。
- 头像和资料是公开的；退出登录不会删除 IPFS 或 Snapshot 上的数据。

## License / 许可证

MIT
