# v0.5 baseline / 开发基线

Verified 2026-11-15 through GitHub and Vercel connectors.

| Source | Verified commit | Treatment |
|---|---|---|
| Production `walletface.org`, deployment `dpl_GjPfmyukWFpKuzk5AYHS83YxF9vD` | `3f505dc3b5092d77c5f3797b5dfe5393d973b09d` | Green v0.4 baseline; feature branch starts here |
| `feature/snapshot-inspired-ui-v04` (default branch) | `3f505dc3b5092d77c5f3797b5dfe5393d973b09d` | Unified wallet provider, branded picker, communities, SDK |
| `feature/face-spaces-mvp` | `fd1de9d3413f88326bdbc08842d2bd8e56817bac` | Earlier community source; retained ancestry and capabilities |
| `main` | `62a48ebf86ff9bd72440f3c076d397dc97849a28` | Alternative Worker/D1, API keys, image proxy, Stripe and SDK remain on main |

Vercel project: `prj_5756QzU8E5xtwSZxobEf460CHeKR`, team `team_z5CyXH1a0Xdl2JTUxIzLoIpy`.
The latest deployment record points at main; the actual domain resolves to the rolled-back green deployment above.
Project environment inventory was empty. No existing AI credentials or shared quota database was configured.
A later account inventory found an existing Neon Marketplace Free integration (`icfg_ZGbGNRXpLF09ynksxOMDrifX`), with no connected Vercel projects in its returned configuration. No database was created or connected. No existing paid resource was provisioned or modified. Preview protection remains enabled.

Read README, AGENTS, ARCHITECTURE, API, SECURITY, DEPLOYMENT, RELEASE_REPORT, MILESTONES,
Product, SpacePage, app providers, Snapshot adapter, API adapters, existing tests and SDK before implementation.
The source preserves the working avatar/EIP-712/ENS publisher, wallet standards, themes and language support.

扫描上限确认：50 个提案、500 条投票，活动接口仅显示其中最近 50 条；私密投票排除。
v0.5 统计复用完整的有界公开扫描，不把活动接口的 50 条显示上限当成全部数据。
未合并 main 的 Workers/D1/计费实现；其代码与原分支完整保留。后续迁移逐个接口评估。
