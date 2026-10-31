# Snapshot UI research and v0.4 adaptation

Reviewed on 2026-10-31 before implementation.

## Exact sources

- snapshot-labs/sx-monorepo: `4a45f95fc508ed7b53f5d48acc3928a70a06ad5a`
- snapshot-labs/snapshot-v1: `d4950022b47652f50efc3b69c8c8aa5c185180f9`
- Live browser interaction: https://snapshot.box/ (Explore, search, network/category filters).

The primary source reviewed was `apps/ui` in sx-monorepo. Studied files include
`Sidebar.vue`, `SidebarItem.vue`, `Topnav.vue`, `BottomNav.vue`, `Layout/App.vue`,
`Layout/Site.vue`, `Layout/Splash.vue`, `Landing.vue`, `Space.vue`, `User.vue`,
`Organization.vue`, `SpacesListItem.vue`, `SpaceCover.vue`, `Ui/Button.vue`,
`Ui/Modal.vue`, and route definitions `default.ts` / `common.ts`.
The older repository supplied `App.vue`, `ExploreView.vue`, `ExploreSpaces.vue` and
`router/index.ts` as a secondary comparison.

## Concrete adaptations

| Observed Snapshot pattern | Wallet Face implementation | Product-specific change |
|---|---|---|
| Fixed followed-space rail | AppShell Sidebar + SpacesProvider | Wallet Face wordmark; identity/developer routes; browser-local follows |
| Context-aware search | UnifiedSearch | Wallet address → profile; Space ID → community; active space → participant query |
| Persistent account control | WalletProvider + WalletButton | One EIP-1193 connection shared with the original publisher |
| Nested space sections | React Router SpacePage | Overview / Participants / Activity / About, using existing Face API |
| Cover with overlapping avatar | SpacePage and ProfilePage | Own CSS covers and original SVG mark; real source badges |
| Community discovery cards | SpaceCard + Explore | Small curated collection, local follows/recent, explicit Space ID import |
| Bounded lists and filters | DirectoryList + URL search/sort/page | Public vote participation and scan provenance retained |
| Mobile bottom navigation | Navigation mobile + dialog drawer | Four primary actions, accessible account/menu controls |
| Reusable modal, toast, buttons | ui/primitives.tsx | Native dialog, keyboard focus restore, clipboard fallback |
| Theme/account state across pages | PreferencesProvider and WalletProvider | Browser preference persistence and safe logout restoration |

The Vue application is not embedded or forked. Components, icons, brand mark, CSS and routing
are implemented for this React repository. Snapshot logos, illustrations, user directories
and service-only features were not copied. The upstream MIT notice is retained.

## Baseline inventory

Starting commit: `ebba64ca2d48cb590bdcb66b553a153c35cb4896`,
branch `feature/face-spaces-mvp`. Main was older; the upgrade builds on the working 0.3 feature branch.

Baseline included a React/Vite avatar publisher, public wallet profiles, bounded Snapshot
directory/activity API, TypeScript SDK, local SQLite authorization and a stateless read-only
Vercel adapter. v0.4 keeps those protocols and persistence boundaries and replaces fragmented
page/session UI with a shared application shell.

## Visual verification method

A QA-only build (`npm --prefix web run build:qa`) exposes `/__qa` with a same-origin iframe
at widths 1440, 1024, 768 and 375 CSS pixels. Each frame runs the real application.
The local preview's upstream Snapshot access timed out. For visual QA, the build uses
`VITE_FACE_API_URL=https://walletface.org` and the stable public API; the QA-only summary
adapter selects metadata from its 0.3 space response. Production uses the new summary endpoint
directly and contains no QA module.

The optional QA wallet fixture is visibly labeled, has no private key, and rejects every
signing method. Connected-state screenshots demonstrate layout; automated provider tests
verify the signing envelope. Real wallet signing requires a separate manual wallet check.
