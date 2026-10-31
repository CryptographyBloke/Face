# Wallet Face / 钱包头像

[Open Wallet Face / 打开网站](https://walletface.org) · [Source / 源码](https://github.com/CryptographyBloke/Face) · [Roadmap / 路线图](MILESTONES.md)

## v0.4 — wallet identity and communities / 钱包身份与社区

Connect a wallet, publish an avatar, discover public Snapshot communities and explore wallet
profiles. The new application shell brings a single account session, community following,
recent spaces, bilingual navigation and light/dark themes to every page.

连接钱包、发布头像、探索 Snapshot 公开社区、查看钱包资料。新版提供统一钱包状态、
社区收藏、最近访问、中英文切换与深浅色主题。

| Route / 路由 | Feature / 功能 |
|---|---|
| `/` | Home, wallet identity, followed/recent shortcuts / 首页、钱包身份和社区快捷入口 |
| `/avatar` | JPG/PNG → IPFS → gasless Snapshot signature / 头像上传与签名发布 |
| `/spaces`, `/followed` | Discovery, search, local following / 探索、搜索与本地收藏 |
| `/spaces/:id` | Overview, participants, activity, about / 社区概览、参与者、活动、介绍 |
| `/u/:address`, `/profile` | Public or connected wallet profile / 公开资料与我的资料 |
| `/developers`, `/examples/:kind` | API, SDK and integrations / 开发文档与集成示例 |
| `/communities` | Community pilot entry / 社区试点入口 |

The frontend adapts navigation and community patterns studied in Snapshot's MIT-licensed
source into independent React components. See [UI research](docs/UI_RESEARCH.md) and
[third-party notices](THIRD_PARTY_NOTICES.md).

界面参考 Snapshot 开源项目的导航、社区结构与交互模式，以独立 React 组件实现。
来源、具体改造与许可证保存在以上文档中。

## Run / 运行

Node.js 24+:

```bash
git clone https://github.com/CryptographyBloke/Face.git
cd Face
git checkout feature/snapshot-inspired-ui-v04
npm ci
npm --prefix web ci
npm run build
npm start
# http://localhost:8787
```

The single Node process serves the SPA and API. Local native profile/admin writes use SQLite.
For read-only operation, set `FACE_READ_ONLY=true`. Optional settings are in `.env.example`;
`npm run dev` loads `.env.local`.

一个 Node 进程同时提供页面和 API。本地原生资料与管理写入使用 SQLite；
只读运行设置 `FACE_READ_ONLY=true`。环境变量示例见 `.env.example`。

For frontend hot reload / 前端热更新：run `npm run dev:api` plus `npm --prefix web run dev`,
with API `APP_ORIGIN=http://localhost:5173`.

## Publishing and resolution / 发布与解析

1. EIP-1193 connects the browser to an authorized wallet; keys stay in the wallet.
2. Pineapple uploads a JPG/PNG image (up to 1 MB) to IPFS.
3. The wallet signs the original Snapshot Profile EIP-712 message.
4. Snapshot Sequencer accepts the signed envelope; Hub and compatible services resolve it.
5. Existing ENS names can optionally synchronize the same avatar URI through a separate
   mainnet transaction.

1. 浏览器通过 EIP-1193 连接钱包，私钥由钱包保管。
2. Pineapple 将最大 1 MB 的 JPG/PNG 上传到 IPFS。
3. 钱包签署 Snapshot Profile 结构化消息。
4. Snapshot Sequencer 接收签名资料，Hub 和兼容服务提供解析。
5. 已有 ENS 名称可额外同步头像记录，该步骤可能需要主网 Gas。

The API resolves native → Snapshot → optional ENS sources and returns source metadata.
Applications display avatars when they support those sources or integrate the Face SDK.
Snapshot publication remains available on the read-only Vercel deployment; native
claims, branding, roles and badges require a durable backend.

API 按原生资料 → Snapshot → 可选 ENS 解析，并返回来源。网站通过兼容资料源或接入 SDK
显示头像。Vercel 提供只读 API，浏览器仍可发布 Snapshot 头像；原生认领、品牌、角色与徽章
需要持久化后端。

## Code / 代码

| Path | Responsibility / 职责 |
|---|---|
| `web/src/app/` | Shell, global wallet/preferences/collections, request cache / 应用框架与全局状态 |
| `web/src/product/`, `web/src/ui/` | Routes and reusable UI / 页面与公共组件 |
| `web/src/App.tsx` | Avatar publishing flow / 头像发布 |
| `web/src/wallet.ts`, `storage.ts`, `snapshot.ts`, `ens.ts` | Wallet and publishing adapters / 钱包与发布适配器 |
| `web/src/product.css` | Design tokens and responsive layout / 设计变量与响应式样式 |
| `server/`, `api/` | Persistent Node backend and read-only Vercel adapter / 两种后端 |
| `packages/sdk/`, `examples/` | Typed client, React avatar and integration examples / SDK 与集成示例 |
| `src/` | Retained legacy ENS/DNS CLI / 早期命令行工具 |

Wallet restoration calls `eth_accounts`; a cookie is unnecessary. Logout clears application
state and records the choice in session storage, including wallets that cannot revoke permissions.
Following/recent spaces, language and theme stay in browser storage.

刷新通过 `eth_accounts` 恢复连接，无需 Cookie。退出后记录本标签页的退出状态。
收藏、最近访问、语言与主题保存在浏览器。

## Checks / 检查

```bash
npm test
npm --prefix web test
npm --prefix packages/sdk run build
npm run build
npm run test:protocol
npm audit
npm --prefix web audit
# Optional live read-only integration:
npm run smoke
```

[Architecture / 架构](ARCHITECTURE.md) · [API](API.md) ·
[Security / 安全](SECURITY.md) · [Deployment / 部署与回滚](DEPLOYMENT.md) ·
[Release evidence / 验证记录](RELEASE_REPORT.md) · [Commercial pilots / 商业试点](COMMERCIAL_PILOT.md)

## License / 许可证

MIT. Snapshot research attribution and the upstream MIT notice are in
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
