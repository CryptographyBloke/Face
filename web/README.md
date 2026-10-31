# Wallet Face web app / 钱包头像网页应用

This directory contains the React + TypeScript client for wallet connection, image upload, Snapshot publication, public profiles and community directories. The resolver API lives in `../server` and the Vercel adapter in `../api`.

本目录包含 React + TypeScript 客户端，提供钱包连接、图片上传、Snapshot 发布、公开资料与社区目录。Resolver API 位于 `../server`，Vercel 适配器位于 `../api`。

## User flow / 使用流程

1. Connect an EIP-1193 wallet. On refresh, `eth_accounts` silently restores an already-authorized account without storing wallet credentials in a cookie.
2. Choose a JPG/PNG image under 1 MB. The UI creates a local object-URL preview immediately.
3. Upload the image through Pineapple and receive an `ipfs://CID` URI.
4. Sign the Snapshot `Profile` typed message with EIP-712 and submit the signed envelope to the Snapshot Sequencer.
5. Read the profile from Snapshot Hub GraphQL and resolve the CID through public IPFS gateways. ENS synchronization is a separate optional path.

1. 连接 EIP-1193 钱包。刷新时通过 `eth_accounts` 静默恢复已有授权，不把钱包凭证保存到 Cookie。
2. 选择不超过 1 MB 的 JPG/PNG 图片；界面立即生成本地临时预览。
3. 通过 Pineapple 上传图片并获得 `ipfs://CID`。
4. 使用 EIP-712 签署 Snapshot `Profile` 结构化消息，并将签名消息提交给 Snapshot Sequencer。
5. 通过 Snapshot Hub GraphQL 读取资料，再经公共 IPFS 网关解析图片。ENS 同步是独立的可选路径。

## Source map / 源码导航

- `src/App.tsx`: avatar publishing journey.
- `src/app/`: shared shell, account session, preferences, collections and request cache.
- `src/product/`, `src/ui/`: routed pages and reusable components.
- `src/wallet.ts`: wallet connect/restore/logout and provider events.
- `src/storage.ts`: file validation, upload receipt parsing, and URI resolution.
- `src/snapshot.ts`: EIP-712 typed-data signing and Snapshot API calls.
- `src/ens.ts`: optional resolver lookup and `avatar` text-record transaction.
- `src/product.css`: design tokens, layout and responsive styling.

## Configuration / 配置

Public defaults are configured in the source. To override them, define these Vite variables in `.env.local`:

源码中提供了公开服务默认值。如需覆盖，可在 `.env.local` 中配置：

```text
VITE_PINEAPPLE_URL
VITE_SNAPSHOT_SEQUENCER_URL
VITE_SNAPSHOT_API_URL
VITE_ENS_RPC_URL
VITE_IPFS_GATEWAY
VITE_ARWEAVE_GATEWAY
VITE_FACE_API_URL
```

## Verification / 检查

```bash
npm ci
npm run test:protocol
npm run build
```

The protocol check compares the EIP-712 digest against Snapshot's expected typed-data format. Published avatar images and profile URIs are public.

协议检查会将 EIP-712 摘要与 Snapshot 预期的结构化签名格式进行比对。头像图片和资料 URI 是公开数据。
