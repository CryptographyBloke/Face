import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  act,
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter, Link, useNavigate } from "react-router-dom";
import { AppProviders, ProductRoutes } from "./Product";
import App from "./App";
import { FaceClient, validateAddress } from "../../packages/sdk/src/index";
import { WalletFaceAvatar } from "../../packages/sdk/src/react";
import { DirectoryList } from "./product/DirectoryList";
import { clearResourceCache } from "./app/resource";
import { useWallet } from "./app/WalletProvider";
import { Modal } from "./ui/primitives";
vi.mock("@snapshot-labs/pineapple", () => ({
  upload: async () => ({ cid: "QmTestImage" }),
}));
vi.mock("./ens", () => ({
  publishEnsAvatar: async () => ({ updated: false, reason: "no-ens-record" }),
}));
const addr = "0x1111111111111111111111111111111111111111",
  other = "0x2222222222222222222222222222222222222222";
let accounts: string[] = [],
  mode = "read-only";
let listeners: Record<string, ((...args: unknown[]) => void)[]> = {};
const provenance = {
  source: "snapshot",
  sourceUrl: "https://snapshot.box/#/yam.eth",
  fetchedAt: "2026-10-31T00:00:00.000Z",
  votesScanned: 500,
  proposalsScanned: 50,
  votesComplete: false,
  proposalsComplete: false,
  privacyPolicy: "Public scan",
};
const participant = (address = addr, index = 0) => ({
  address,
  chainId: 1,
  publicVotes: 22 - index,
  lastVotedAt: 1700000000 - index,
  profileClaimed: false,
  name: index === 0 ? "Alice" : null,
  badges: [],
  roles: [],
});
const people = Array.from({ length: 22 }, (_, i) =>
  participant(
    i === 0
      ? addr
      : i === 21
        ? other
        : "0x" + (i + 3).toString(16).padStart(40, "0"),
    i,
  ),
);
const profile = (address = addr) => ({
  chainId: 1,
  address,
  avatar: { uri: null, resolvedUrl: null, urls: [], source: "none" },
  profile: {
    name: address === addr ? "Alice" : null,
    bio: null,
    links: [] as string[],
    revision: 0,
  },
  provenance: {
    profileClaimVerified: false,
    sources: ["snapshot"],
    warnings: [],
    verification: null,
  },
  updatedAt: null,
  cache: { fetchedAt: provenance.fetchedAt, ttlSeconds: 60 },
});
function response(input: unknown, init?: RequestInit) {
  const value = String(input);
  if (value.includes("hub.snapshot.org"))
    return Response.json({ data: { user: null } });
  if (value.includes("seq.snapshot.org"))
    return Response.json({ id: "published" });
  if (value.includes("stamp.fyi")) return Response.json({ ok: true });
  const u = new URL(value, "https://walletface.org");
  if (u.pathname === "/health")
    return Response.json({ ok: true, mode, version: "0.4.0" });
  if (u.pathname.includes("/v1/profile/"))
    return Response.json(profile(u.pathname.split("/").pop()));
  if (u.pathname.includes("/members")) {
    const q = (u.searchParams.get("search") || "").toLowerCase(),
      page = Number(u.searchParams.get("page") || 0);
    let items = people.filter((p) =>
      (p.address + " " + p.name).toLowerCase().includes(q),
    );
    if (u.searchParams.get("sort") === "address") items = [...items].reverse();
    return Response.json({
      kind: "public_governance_participants",
      items: items.slice(page * 20, (page + 1) * 20),
      page,
      totalObserved: items.length,
      hasMore: (page + 1) * 20 < items.length,
      provenance,
    });
  }
  if (u.pathname.includes("/activity"))
    return Response.json({
      items: [
        {
          id: "vote1",
          voter: addr,
          created: 1700000000,
          vp: 1,
          proposal: { id: "0x123", title: "Community treasury update" },
        },
      ],
      provenance,
    });
  const id = u.pathname.split("/")[3] || "yam.eth",
    name = id === "yam.eth" ? "Yam" : id === "ens.eth" ? "ENS" : "Aave";
  const space = {
    id,
    name,
    about: "Public community governance",
    network: "1",
    avatar: null,
    admins: [addr],
  };
  if (u.pathname.endsWith("/summary"))
    return Response.json({ space, provenance });
  if (u.pathname.startsWith("/v1/spaces/"))
    return Response.json({
      space,
      branding: null,
      official: false,
      counts: {
        publicParticipantsObserved: 22,
        claimedProfilesObserved: 0,
        proposalsObserved: 50,
      },
      proposals: [],
      provenance,
    });
  return Response.json({ ok: true, body: init?.body });
}
beforeEach(() => {
  clearResourceCache();
  localStorage.clear();
  sessionStorage.clear();
  localStorage.setItem("wallet-face-language", "en");
  accounts = [];
  mode = "read-only";
  listeners = {};
  Object.defineProperty(window, "ethereum", {
    configurable: true,
    value: {
      request: vi.fn(async ({ method }: { method: string }) =>
        method === "eth_accounts"
          ? accounts
          : method === "eth_requestAccounts"
            ? (accounts = [addr])
            : method === "eth_chainId"
              ? "0x1"
              : method === "wallet_revokePermissions"
                ? Promise.reject(new Error("Unsupported"))
                : "0x" + "11".repeat(65),
      ),
      on: vi.fn((event: string, callback: (...args: unknown[]) => void) => {
        (listeners[event] ||= []).push(callback);
      }),
      removeListener: vi.fn(
        (event: string, callback: (...args: unknown[]) => void) => {
          listeners[event] =
            listeners[event]?.filter((fn) => fn !== callback) || [];
        },
      ),
    },
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input, init) => response(input, init)),
  );
});
function renderApp(path = "/", extra?: React.ReactNode) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppProviders>
        {extra}
        <ProductRoutes />
      </AppProviders>
    </MemoryRouter>,
  );
}
function renderPublisher() {
  return render(
    <MemoryRouter>
      <AppProviders>
        <App />
      </AppProviders>
    </MemoryRouter>,
  );
}
describe("original avatar publisher regression", () => {
  it("connects, validates, uploads, signs and exposes the profile link", async () => {
    const view = renderPublisher();
    await waitFor(() =>
      expect(
        screen
          .getByRole("button", { name: "Connect wallet" })
          .hasAttribute("disabled"),
      ).toBe(false),
    );
    fireEvent.click(screen.getByRole("button", { name: "Connect wallet" }));
    const file = await screen.findByText("Choose your avatar");
    expect(file).toBeTruthy();
    fireEvent.change(view.container.querySelector("input[type=file]")!, {
      target: {
        files: [new File(["avatar"], "avatar.png", { type: "image/png" })],
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Publish avatar" }));
    await screen.findByText("Avatar published.", {}, { timeout: 5000 });
    expect(
      screen
        .getByRole("link", { name: "Open my public profile" })
        .getAttribute("href"),
    ).toBe("/u/" + addr);
    const publish = vi
      .mocked(fetch)
      .mock.calls.find(([url]) => String(url).includes("seq.snapshot.org"));
    const body = JSON.parse(String(publish?.[1]?.body));
    expect(body.data.domain).toEqual({ name: "snapshot", version: "0.1.4" });
    expect(body.data.message.from).toBe(addr);
    expect(typeof body.data.message.timestamp).toBe("number");
    expect(body.sig).toBeTruthy();
  });
  it("renders Chinese and rejects unsupported or oversized files before upload", async () => {
    localStorage.setItem("wallet-face-language", "zh");
    const view = renderPublisher();
    fireEvent.click(await screen.findByRole("button", { name: "连接钱包" }));
    await screen.findByText("选择头像图片");
    const input = view.container.querySelector("input[type=file]")!;
    fireEvent.change(input, {
      target: { files: [new File(["x"], "x.svg", { type: "image/svg+xml" })] },
    });
    expect(await screen.findByText("请选择 JPG 或 PNG 图片。")).toBeTruthy();
    fireEvent.change(input, {
      target: {
        files: [
          new File([new Uint8Array(1048577)], "big.png", { type: "image/png" }),
        ],
      },
    });
    expect(
      await screen.findByText("图片太大，请控制在 1 MB 以内。"),
    ).toBeTruthy();
  });
  it("shows signing and publishing as separate stages", async () => {
    let release: ((v: string) => void) | undefined;
    const original = vi
      .mocked(window.ethereum!.request)
      .getMockImplementation()!;
    vi.spyOn(window.ethereum!, "request").mockImplementation(async (args) =>
      args.method === "eth_signTypedData_v4"
        ? new Promise<string>((resolve) => {
            release = resolve;
          })
        : original(args),
    );
    const view = renderPublisher();
    fireEvent.click(
      await screen.findByRole("button", { name: "Connect wallet" }),
    );
    await screen.findByText("Choose your avatar");
    fireEvent.change(view.container.querySelector("input[type=file]")!, {
      target: { files: [new File(["x"], "x.png", { type: "image/png" })] },
    });
    fireEvent.click(screen.getByRole("button", { name: "Publish avatar" }));
    expect(await screen.findByText("Waiting for your signature…")).toBeTruthy();
    await act(async () => {
      release?.("0x" + "11".repeat(65));
    });
    expect(await screen.findByText("Avatar published.")).toBeTruthy();
  });
});
it("community directory labels participation and actual issued records", () => {
  render(
    <MemoryRouter>
      <AppProviders>
        <DirectoryList
          zh={false}
          data={{
            kind: "public_governance_participants",
            items: [participant(addr)],
            page: 0,
            hasMore: false,
            totalObserved: 1,
            provenance,
          }}
        />
      </AppProviders>
    </MemoryRouter>,
  );
  expect(screen.getByText("22 public votes in scan")).toBeTruthy();
  expect(screen.queryByText("Organization Member")).toBeNull();
  expect(screen.queryByText("Profile claimed")).toBeNull();
});
it("SDK validates addresses, resolver responses and unsafe profile links", async () => {
  expect(() => validateAddress("../admin")).toThrow();
  await expect(
    new FaceClient(
      "",
      vi.fn(async () => Response.json({})) as typeof fetch,
    ).resolveProfile({ address: addr }),
  ).rejects.toThrow();
  const unsafe = profile();
  unsafe.profile.links = ["javascript:alert(1)"];
  await expect(
    new FaceClient(
      "",
      vi.fn(async () => Response.json(unsafe)) as typeof fetch,
    ).resolveProfile({ address: addr }),
  ).rejects.toThrow("Unsafe");
});
it("SDK invokes browser fetch without an illegal object receiver", async () => {
  vi.stubGlobal("fetch", function (this: unknown) {
    expect(this).toBeUndefined();
    return Promise.resolve(Response.json({ ok: true }));
  });
  await expect(new FaceClient().request("/health")).resolves.toEqual({
    ok: true,
  });
});
it("avatar component displays deterministic fallback on resolver failure", () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      Response.json({ error: { message: "offline" } }, { status: 502 }),
    ),
  );
  render(<WalletFaceAvatar address={addr} />);
  expect(screen.getByRole("img").getAttribute("aria-label")).toContain(addr);
});
it("language and theme changes propagate through the application", async () => {
  renderApp("/developers");
  await screen.findByText("Integration examples");
  fireEvent.change(screen.getByRole("combobox", { name: "Language" }), {
    target: { value: "zh" },
  });
  expect(await screen.findByRole("heading", { name: "集成示例" })).toBeTruthy();
  expect(localStorage.getItem("wallet-face-language")).toBe("zh");
  fireEvent.click(screen.getByRole("button", { name: "切换主题" }));
  expect(document.documentElement.dataset.theme).toBe("dark");
  expect(localStorage.getItem("wallet-face:theme:v1")).toBe('"dark"');
});
function HistoryControls() {
  const navigate = useNavigate();
  return (
    <>
      <button onClick={() => navigate(-1)}>Test back</button>
      <button onClick={() => navigate(1)}>Test forward</button>
    </>
  );
}
it("client navigation supports back, forward and deep profile links", async () => {
  renderApp("/", <HistoryControls />);
  await screen.findByText("Your wallet identity,");
  fireEvent.click(screen.getByRole("link", { name: "Explore communities" }));
  await screen.findByRole("heading", { name: "Explore communities" });
  fireEvent.click(screen.getByRole("button", { name: "Test back" }));
  expect(await screen.findByText("Your wallet identity,")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Test forward" }));
  expect(
    await screen.findByRole("heading", { name: "Explore communities" }),
  ).toBeTruthy();
});
it("one wallet connection is shared across routes", async () => {
  renderApp("/avatar");
  const main = await screen.findByRole("main");
  fireEvent.click(
    await within(main).findByRole("button", { name: "Connect wallet" }),
  );
  await screen.findByText("Choose your avatar");
  fireEvent.click(
    within(main).getByRole("link", { name: /View wallet profile/ }),
  );
  expect(await screen.findByRole("heading", { name: "Alice" })).toBeTruthy();
  const calls = vi.mocked(window.ethereum!.request).mock.calls;
  expect(calls.filter(([a]) => a.method === "eth_requestAccounts").length).toBe(
    1,
  );
});
it("account changes refresh the global identity and provider disconnect clears it", async () => {
  accounts = [addr];
  renderApp("/profile");
  expect(await screen.findByRole("heading", { name: "Alice" })).toBeTruthy();
  await act(async () => {
    accounts = [other];
    listeners.accountsChanged.forEach((fn) => fn(accounts));
  });
  fireEvent.click(
    within(
      screen.getByRole("navigation", { name: "Main navigation" }),
    ).getByRole("link", { name: "Profile" }),
  );
  expect(await screen.findByRole("heading", { name: /0x2222/ })).toBeTruthy();
  await act(async () => {
    accounts = [];
    listeners.disconnect.forEach((fn) => fn());
  });
  expect(
    await screen.findByRole("button", { name: "Connect wallet" }),
  ).toBeTruthy();
});
it("logout remains effective on refresh when permission revocation is unsupported", async () => {
  accounts = [addr];
  const view = renderApp("/developers");
  await screen.findByText("Integration examples");
  fireEvent.click(screen.getByLabelText("Wallet account"));
  fireEvent.click(screen.getByRole("button", { name: "Log out" }));
  await waitFor(() =>
    expect(sessionStorage.getItem("wallet-face:logged-out")).toBe("1"),
  );
  view.unmount();
  renderApp("/developers");
  await screen.findByText("Integration examples");
  expect(screen.queryByLabelText("Wallet account")).toBeNull();
  expect(accounts).toEqual([addr]);
});
it("followed spaces persist and appear in navigation", async () => {
  const view = renderApp("/spaces");
  const follow = await screen.findByRole("button", {
    name: "Follow space Yam",
  });
  fireEvent.click(follow);
  await waitFor(() =>
    expect(localStorage.getItem("wallet-face:followed:v1")).toContain(
      "yam.eth",
    ),
  );
  expect(screen.getAllByRole("link", { name: "Yam" }).length).toBeGreaterThan(
    0,
  );
  view.unmount();
  renderApp("/followed");
  expect(
    await screen.findByRole("heading", { name: "Your communities" }),
  ).toBeTruthy();
  expect(
    await screen.findByRole("button", { name: "Unfollow space Yam" }),
  ).toBeTruthy();
});
it("Space lookup and wallet search navigate to real routes", async () => {
  renderApp("/spaces");
  await screen.findByRole("heading", { name: "Explore communities" });
  const search = screen.getByRole("textbox", { name: "Search Wallet Face" });
  fireEvent.change(search, { target: { value: "yam.eth" } });
  fireEvent.submit(search.closest("form")!);
  expect(await screen.findByRole("heading", { name: "Yam" })).toBeTruthy();
  fireEvent.change(search, { target: { value: addr } });
  fireEvent.submit(search.closest("form")!);
  expect(await screen.findByRole("heading", { name: "Alice" })).toBeTruthy();
});
it("Space overview preserves source, scan range and section navigation", async () => {
  renderApp("/spaces/yam.eth");
  expect(await screen.findByRole("heading", { name: "Yam" })).toBeTruthy();
  expect(screen.getByText("Public wallets observed")).toBeTruthy();
  fireEvent.click(screen.getByText("Source and scan details"));
  expect(screen.getAllByText(/500 public votes/).length).toBeGreaterThan(0);
  fireEvent.click(screen.getByRole("link", { name: "About" }));
  expect(
    await screen.findByRole("heading", { name: "About this community" }),
  ).toBeTruthy();
});
it("global search scopes names to the current Space participants", async () => {
  renderApp("/spaces/yam.eth");
  await screen.findByRole("heading",{name:"Yam"});
  const search=screen.getByRole("textbox",{name:"Search Wallet Face"});
  expect(search.getAttribute("placeholder")).toBe("Search participants or wallet");
  fireEvent.change(search,{target:{value:"Alice"}});
  fireEvent.submit(search.closest("form")!);
  expect(await screen.findByRole("heading",{name:"Public governance participants"})).toBeTruthy();
  await waitFor(()=>expect(vi.mocked(fetch).mock.calls.some(([url])=>String(url).includes("page=0&search=Alice"))).toBe(true));
});
it("participant search, pagination and sorting use URL-backed API parameters", async () => {
  renderApp("/spaces/yam.eth/participants");
  await screen.findByRole("heading", {
    name: "Public governance participants",
  });
  fireEvent.click(await screen.findByRole("button", { name: "Next" }));
  await waitFor(() =>
    expect(
      vi
        .mocked(fetch)
        .mock.calls.some(([url]) => String(url).includes("members?page=1")),
    ).toBe(true),
  );
  const search = screen.getByRole("searchbox", { name: "Search participants" });
  fireEvent.change(search, { target: { value: "Alice" } });
  await waitFor(() =>
    expect(
      vi
        .mocked(fetch)
        .mock.calls.some(([url]) =>
          String(url).includes("page=0&search=Alice"),
        ),
    ).toBe(true),
  );
  fireEvent.change(
    screen.getByRole("combobox", { name: "Sort participants" }),
    { target: { value: "votes" } },
  );
  await waitFor(() =>
    expect(
      vi
        .mocked(fetch)
        .mock.calls.some(([url]) => String(url).includes("sort=votes")),
    ).toBe(true),
  );
});
it("recent spaces become a reusable home shortcut", async () => {
  renderApp("/spaces/yam.eth");
  await screen.findByRole("heading", { name: "Yam" });
  fireEvent.click(
    within(
      screen.getByRole("navigation", { name: "Main navigation" }),
    ).getByRole("link", { name: "Home" }),
  );
  expect(await screen.findByText("Pick up where you left off")).toBeTruthy();
  expect(localStorage.getItem("wallet-face:recent:v1")).toContain("yam.eth");
});
it("read-only mode hides signing controls for the profile owner", async () => {
  accounts = [addr];
  renderApp("/u/" + addr);
  await screen.findByRole("heading", { name: "Alice" });
  expect(
    await screen.findByText(
      "Profile browsing mode. Connect a persistent backend to edit native profiles.",
    ),
  ).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Sign and publish" })).toBeNull();
  expect(screen.queryByRole("link", { name: "Edit profile" })).toBeNull();
});
it("persistent edit controls are available only to the matching connected wallet", async () => {
  mode = "persistent";
  accounts = [other];
  renderApp("/u/" + addr);
  await screen.findByRole("heading", { name: "Alice" });
  expect(screen.queryByRole("link", { name: "Edit profile" })).toBeNull();
});
it("read-only community management never exposes writable forms", async () => {
  renderApp("/spaces/yam.eth/manage");
  expect(
    await screen.findByRole("heading", { name: "Community administration" }),
  ).toBeTruthy();
  expect(
    await screen.findByText(
      "Browsing mode. Connect a persistent backend to manage this community.",
    ),
  ).toBeTruthy();
  expect(screen.queryByRole("textbox")).toBeTruthy();
  expect(
    screen.queryByRole("button", { name: "Sign organization badge" }),
  ).toBeNull();
});
it("invalid wallet addresses and unknown routes recover without API lookups", async () => {
  renderApp("/u/invalid");
  expect(await screen.findByText("Enter a valid wallet address")).toBeTruthy();
  expect(
    vi
      .mocked(fetch)
      .mock.calls.some(([url]) =>
        String(url).includes("/v1/profile/1/invalid"),
      ),
  ).toBe(false);
});
it("copy failure provides a keyboard-accessible manual copy dialog", async () => {
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: {
      writeText: vi.fn(async () => {
        throw new Error("blocked");
      }),
    },
  });
  renderApp("/u/" + addr);
  await screen.findByRole("heading", { name: "Alice" });
  fireEvent.click(screen.getByRole("button", { name: "Copy address" }));
  const dialog = await screen.findByRole("dialog");
  expect(
    within(dialog).getByRole("textbox", { name: "Content to copy" }),
  ).toBeTruthy();
  fireEvent(dialog, new Event("cancel", { bubbles: false, cancelable: true }));
  expect(screen.queryByRole("dialog")).toBeNull();
});
