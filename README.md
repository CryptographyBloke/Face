# Wallet Face / 钱包头像

## 0.3 upgrade branch / 0.3 升级分支

This branch adds public wallet profiles, bounded Snapshot public-participant directories,
a resolver API, a TypeScript/React SDK, and a locally persistent signed-claims/admin MVP.
The read-only release is now live at `dao.sarl` (2026-10-29). Vercel deployments are intentionally read-only;
native claims/admin writes require the persistent Node 24 + SQLite server.

本分支新增公开钱包资料、Snapshot 公开治理参与者目录、Resolver API、TypeScript/React
SDK，以及使用本地持久化数据库的签名认领和管理员 MVP。只读版本已于 2026-10-29 上线 dao.sarl。
Vercel 部署保持只读；认领、角色和徽章写入须使用持久化 Node 24 + SQLite 后端。

```bash
npm ci
npm --prefix web ci
npm run build
npm start
```

Open / 打开 `http://localhost:8787`. No paid API key is required. Optional configuration:
copy `.env.example` to `.env.local`, then use `npm run dev` to load it.

Documentation / 文档：
[Architecture](ARCHITECTURE.md) · [API](API.md) · [Security](SECURITY.md) ·
[Deployment / rollback](DEPLOYMENT.md) · [Commercial pilot](COMMERCIAL_PILOT.md).

Validation / 验证：`npm test`, `npm --prefix web test`,
`npm --prefix packages/sdk run build`, `npm run build`, `npm run test:protocol`,
and optional real read-only `npm run smoke`.

An open-source wallet-avatar publishing tool. Connect a wallet, upload an image, sign a profile update, and let compatible applications resolve the avatar by wallet address. ENS is optional.

一个开源的钱包头像发布工具：连接钱包、上传图片、签名发布资料，让兼容应用通过钱包地址解析头像。ENS 不是必需条件。

- Live site / 在线网站: <https://dao.sarl>
- Source / 源码: <https://github.com/CryptographyBloke/Face>
- Roadmap / 里程碑: [MILESTONES.md](./MILESTONES.md)

## How it works / 工作原理

1. The browser connects to a wallet through EIP-1193; the private key stays in the wallet.
2. The user selects a JPG or PNG image (up to 1 MB). Pineapple uploads it to IPFS and returns an `ipfs://CID` URI.
3. The wallet signs a Snapshot `Profile` message using EIP-712. It contains the wallet address, timestamp, and avatar URI.
4. The browser submits the signed message to the Snapshot Sequencer. Snapshot Hub provides profile reads through GraphQL.
5. Compatible services can resolve the profile and image. An optional ENS adapter can write the same URI to an existing ENS resolver; that step may require a mainnet transaction and Gas.

1. 浏览器通过 EIP-1193 连接钱包，私钥留在钱包中。
2. 用户选择 JPG 或 PNG 图片（最大 1 MB）；Pineapple 将图片上传到 IPFS 并返回 `ipfs://CID`。
3. 钱包用 EIP-712 签署 Snapshot `Profile` 消息，消息包含钱包地址、时间戳和头像 URI。
4. 浏览器把签名消息提交给 Snapshot Sequencer；读取资料时使用 Snapshot Hub 的 GraphQL 接口。
5. 兼容服务可以解析资料和图片。可选的 ENS 适配器可将同一 URI 写入已有 ENS Resolver；这一步可能需要在主网上确认交易并支付 Gas。

Snapshot 发布是链下签名流程，不需要链上交易或 Gas。图片与头像资料是公开的。IPFS CID 可以定位内容，但文件能否长期读取仍取决于 pinning 服务和网关。

Snapshot publication is an off-chain signature flow and does not require an on-chain transaction or Gas. Images and profiles are public. An IPFS CID identifies content, but long-term availability still depends on pinning and gateways.

## Code map / 代码结构

| Path | Responsibility |
|---|---|
| `web/src/App.tsx` | UI, wallet/session state, and the connect → upload → publish → preview flow |
| `web/src/wallet.ts` | EIP-1193 connection, silent session restoration, and logout |
| `web/src/storage.ts` | File validation, Pineapple upload, CID handling, and gateway fallback |
| `web/src/snapshot.ts` | Snapshot Profile EIP-712 signing, publication, and GraphQL reads |
| `web/src/ens.ts` | Optional ENS avatar-record compatibility |
| `web/src/styles.css` | Responsive interface styling |

## Compatibility and limits / 兼容性与边界

Compatible applications display avatars through their Snapshot, Stamp, ENS or IPFS integrations. Developers can also use the Face resolver API and React component.

兼容应用通过 Snapshot、Stamp、ENS 或 IPFS 接口显示头像。开发者也可接入 Face Resolver API 和 React 组件。

The avatar publisher runs in the browser. The API adds profile resolution and optional SQLite persistence. Wallets hold the private keys; Pineapple, Snapshot and public IPFS gateways handle publishing and retrieval.

浏览器协调头像发布，API 提供资料解析与可选 SQLite 持久化。钱包保管私钥，Pineapple、Snapshot 和公共 IPFS 网关负责发布与读取。

## Repository / 仓库结构

`web/` contains the current avatar application. `src/` contains the retained legacy Cloudflare/ENS DNS bootstrap CLI; it is not required to run the avatar website.

`web/` 是当前头像应用；`src/` 保留了早期的 Cloudflare/ENS DNS bootstrap 命令行工具，运行头像网站不需要它。

## Run locally / 本地运行

```bash
cd web
npm ci
npm run dev
```

Build and run the Snapshot signing-format check / 构建并检查 Snapshot 签名格式：

```bash
npm run build
npm run test:protocol
```

## Legacy CLI example / 旧版 CLI 示例

```bash
node src/cli.mjs setup --domain example.com --address 0x...
```

## Security / 安全

- The app never requests a seed phrase or private key.
- Wallet signatures and optional transactions require explicit wallet approval.
- Logging out clears local app state. IPFS and Snapshot retain their public records.

- 应用不会索要助记词或私钥。
- 钱包签名和可选链上交易都需要用户在钱包中明确确认。
- 退出登录清除本地应用状态，IPFS 和 Snapshot 保留对应公开记录。

## License / 许可证

MIT
