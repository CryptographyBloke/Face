# v0.5 validation / 验证记录

Date: 2026-11-15. Baseline: `3f505dc3b5092d77c5f3797b5dfe5393d973b09d`.
Feature branch: `feature/face-ai-agent-v05`. Production remains the green v0.4 deployment.

## Automated checks / 自动化检查

| Check | Result |
|---|---|
| `npm test` | 42 passed (20 retained backend checks + 22 Agent/provider/security checks) |
| `npm --prefix web test` | 33 passed (26 retained + 7 Copilot UI checks) |
| `npm --prefix packages/sdk run build` | Passed; AI contracts exported |
| `npm run build` | TypeScript + production Vite build passed; existing large shell chunk warning remains |
| `npm run test:protocol` | Passed; Snapshot EIP-712 domain/envelope and upload contract checks |
| `npm audit` / `npm --prefix web audit` | Zero vulnerabilities in both trees |
| `git diff --check` | Passed |

Coverage includes strict schemas, arbitrary URL/GraphQL rejection, read-only allowlist, wrong origin,
beta auth, oversized bodies/history/context/output, tool budget, deterministic arithmetic/ranges,
source attribution, scan incompleteness, missing/malformed proposal content, Space binding,
private score suppression, provider failure/cancellation, malformed streams and quota-store failure.
The serverless adapter preserves POST bodies/signals and keeps native write origins separate.
Existing signature/replay/SQLite transaction and avatar publication regressions remain covered.
The prior UI assertion calling all 500 scanned votes public was corrected to “votes scanned”.

AI SDK MockLanguageModelV4 tests exercise the real SDK multi-step stream with actual structured tools,
including Chinese and English. A separate controlled HTTP test runs the **actual NewAPI provider adapter**
through two OpenAI-compatible SSE responses: model tool call → code-computed result → final text and usage.
It verifies endpoint, bearer header, max_tokens, stream_options.include_usage, six tool definitions and aggregated usage.
Model error internals are excluded from client streams. Prompt-injection tests establish data isolation,
fixed capability sets and escaped rendering; they do not claim semantic immunity of free-form model prose.

## Real data / 真实数据

`npm run smoke:ai` runs all six tools against the official Snapshot Hub for **ens.eth and yam.eth**.
Reproducible output: [AI_LIVE_EVIDENCE.json](AI_LIVE_EVIDENCE.json).
Retrieved at 2026-11-15 16:05 Singapore time (08:05 UTC); current data can change.

| Space | Proposals scanned | Votes scanned | Private omitted | Public votes included | Unique public wallets |
|---|---:|---:|---:|---:|---:|
| ENS | 50 | 500 | 110 | 390 | 128 |
| Yam | 50 | 500 | 0 | 500 | 102 |

Both scans reached configured bounds. These figures describe the observed scan, not all historical DAO activity.
Real proposal readers returned ENS “[7.3] [Social] Governor Nexus Update” and Yam “YIP-210 Finalizing YIP-114 and implementing a rebalancing framework.”
The live Hub returned a numeric proposal snapshot block; schema support was corrected and regression-tested.
Profile resolution used actual wallets from each observed participant set.

## Browser / 浏览器

Real Chromium rendering through the existing QA-only iframe viewport harness:
1440, 1024, 768 and 375 CSS-pixel viewports. Document clientWidth equals scrollWidth at each size;
15 pixels are occupied by the vertical scrollbar. Screenshots: [v05 folder](screenshots/v05/).
The responsive harness and signing-disabled wallet fixture are excluded from production builds.

Verified public-data journeys: Space AI Insights context/navigation → actual ENS governance statistics and source card;
Space overview → real proposal link → title, choices, scores, timing, privacy state and source;
global Copilot → public wallet → claim state/source/time → wallet profile link.
Chinese interface and dark theme render with the existing app shell. Mobile keeps Copilot in bottom navigation.
Source cards point to server-built official Snapshot URLs. Copy/export controls are present.
Missing AI credentials visibly show data-only status with model submission disabled.
Timeout/error/retry/cancellation/rate-limit behaviors are covered by controlled backend and React tests;
no live provider fault injection was performed without credentials.

## Activation gates / 待激活验证

**Live model calls: not run. Observed AI spend: $0.** NewAPI endpoint/model were supplied as configuration examples;
the API key is absent. No full AI prose answer or production model quality claim is made.
NewAPI costs depend on that instance’s channel/model pricing. Optional Gateway catalog estimates are separate, in the architecture document.

Shared Redis quota integration is implemented and controlled-transport tested; no live Redis service or billing resource was provisioned.
Before enabling model execution: set the server-only NewAPI key, configure a shared quota store and owner beta key,
then run one real multi-tool request, verify usage/charges, cancellation and shared-instance quota enforcement.
Actual wallet extension signing, mobile wallets and ENS mainnet writes still require owner-controlled wallets, as in v0.4.
Native writable production persistence remains disabled. Agent Profile v1 is a schema/resolver contract, with no live ownership verification.

Preview deployment state and exact release commit/PR are recorded in RELEASE_REPORT.md and the delivery message.
