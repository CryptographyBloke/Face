import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import App from "./App";
import { FaceClient, validateAddress } from "../../packages/sdk/src/index";
import { WalletFaceAvatar } from "../../packages/sdk/src/react";
import { DirectoryList } from "./product/DirectoryList";
import Explore from "./product/Explore";
import Developers from "./product/Developers";
import SpacePage from "./product/SpacePage";
import ClaimForm from "./product/ClaimForm";
vi.mock("@snapshot-labs/pineapple", () => ({
  upload: async () => ({ cid: "QmTestImage" }),
}));
vi.mock("./ens", () => ({
  publishEnsAvatar: async () => ({ updated: false, reason: "no-ens-record" }),
}));
const addr = "0x1111111111111111111111111111111111111111";
beforeEach(() => {
  localStorage.clear();
  Object.defineProperty(window, "ethereum", {
    configurable: true,
    value: {
      request: vi.fn(async ({ method }: { method: string }) =>
        method === "eth_accounts"
          ? []
          : method === "eth_requestAccounts"
            ? [addr]
            : "0x" + "11".repeat(65),
      ),
      on: vi.fn(),
      removeListener: vi.fn(),
    },
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(JSON.stringify({ data: { user: null } }), { status: 200 }),
    ),
  );
});
describe("original avatar publisher regression", () => {
  it("connects, validates, uploads, signs and exposes the profile link", async () => {
    const { container } = render(<App locale="en" />);
    await waitFor(() =>
      expect(
        (
          screen.getByRole("button", {
            name: "Connect wallet",
          }) as HTMLButtonElement
        ).disabled,
      ).toBe(false),
    );
    fireEvent.click(screen.getByRole("button", { name: "Connect wallet" }));
    await screen.findByText("Wallet connected.");
    fireEvent.change(container.querySelector("input[type=file]")!, {
      target: {
        files: [new File(["avatar"], "avatar.png", { type: "image/png" })],
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Publish avatar" }));
    await screen.findByText(/Avatar published/);
    expect(
      screen
        .getByRole("link", { name: "Open my public profile" })
        .getAttribute("href"),
    ).toBe("/u/" + addr);
    const calls = vi.mocked(fetch).mock.calls;
    expect(calls.some(([, opts]) => String(opts?.body).includes('"sig"'))).toBe(
      true,
    );
  });
  it("renders Chinese and rejects unsupported files before upload", async () => {
    const { container } = render(<App locale="zh" />);
    await waitFor(() =>
      expect(
        (screen.getByRole("button", { name: "连接钱包" }) as HTMLButtonElement)
          .disabled,
      ).toBe(false),
    );
    fireEvent.click(screen.getByRole("button", { name: "连接钱包" }));
    await screen.findByText("钱包已连接。");
    fireEvent.change(container.querySelector("input[type=file]")!, {
      target: { files: [new File(["x"], "x.svg", { type: "image/svg+xml" })] },
    });
    expect(await screen.findByText("请选择 JPG 或 PNG 图片。")).toBeTruthy();
  });
});
it("community directory labels profiles without turning voters into members", () => {
  render(
    <DirectoryList
      zh={false}
      data={{
        kind: "public_governance_participants",
        items: [
          {
            address: addr,
            publicVotes: 2,
            lastVotedAt: 1,
            profileClaimed: false,
            name: null,
            badges: [],
            roles: [],
          },
        ],
        page: 0,
        hasMore: false,
        totalObserved: 1,
        provenance: {} as never,
      }}
    />,
  );
  expect(screen.getByText("2 public votes in scan")).toBeTruthy();
  expect(screen.queryByText("Organization Member")).toBeNull();
  expect(screen.queryByText("Profile claimed")).toBeNull();
});
it("SDK validates addresses and rejects malformed resolver responses", async () => {
  expect(() => validateAddress("../admin")).toThrow();
  const client = new FaceClient(
    "",
    vi.fn(async () => Response.json({})) as typeof fetch,
  );
  await expect(client.resolveProfile({ address: addr })).rejects.toThrow();
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
it("avatar component displays deterministic fallback on resolver failure", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      Response.json({ error: { message: "offline" } }, { status: 502 }),
    ),
  );
  render(<WalletFaceAvatar address={addr} />);
  expect(screen.getByRole("img").getAttribute("aria-label")).toContain(addr);
});

it("exploration and developer copy introduce actions in both languages", () => {
  const view = render(<Explore zh />);
  expect(
    screen.getByText(
      "输入 Snapshot Space ID，查看社区资料、参与者和治理活动。",
    ),
  ).toBeTruthy();
  view.rerender(<Explore zh={false} />);
  expect(
    screen.getByText(
      "Enter a Snapshot Space ID to explore its profile, participants and governance activity.",
    ),
  ).toBeTruthy();
  view.rerender(<Developers zh />);
  expect(screen.getByText("集成示例：")).toBeTruthy();
  view.rerender(<Developers zh={false} />);
  expect(screen.getByText("Integration examples:")).toBeTruthy();
});

it("space copy preserves source and scan status alongside concise labels", async () => {
  const provenance = {
    fetchedAt: "2026-10-30T00:00:00.000Z",
    sourceUrl: "https://snapshot.box/#/yam.eth",
    votesScanned: 500,
    votesComplete: false,
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input) => {
      const url = String(input);
      if (url.includes("/members"))
        return Response.json({ items: [], page: 0, hasMore: false });
      if (url.includes("/activity")) return Response.json({ items: [] });
      return Response.json({
        space: { id: "yam.eth", name: "Yam", about: "Community governance" },
        official: false,
        branding: null,
        counts: {
          publicParticipantsObserved: 102,
          claimedProfilesObserved: 0,
          proposalsObserved: 50,
        },
        provenance,
      });
    }),
  );
  const view = render(<SpacePage id="yam.eth" zh />);
  expect(await screen.findByText("Snapshot 社区")).toBeTruthy();
  expect(screen.getByText(/已扫描投票：500/)).toBeTruthy();
  expect(screen.getByText(/达到扫描上限/)).toBeTruthy();
  expect(screen.getByText(/来源：Snapshot/)).toBeTruthy();
  view.rerender(<SpacePage id="yam.eth" zh={false} />);
  expect(screen.getByText("SNAPSHOT SPACE")).toBeTruthy();
  expect(screen.getByText(/Scan limited/)).toBeTruthy();
});

it("read-only profile states explain how editing becomes available", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json({ mode: "read-only" })),
  );
  const profile = {
    address: addr,
    profile: { links: [] },
    avatar: {},
  } as never;
  const view = render(<ClaimForm profile={profile} zh onSaved={() => {}} />);
  expect(
    await screen.findByText("资料浏览模式。连接持久化后端后可编辑原生资料。"),
  ).toBeTruthy();
  expect(screen.queryByRole("button")).toBeNull();
  view.rerender(<ClaimForm profile={profile} zh={false} onSaved={() => {}} />);
  expect(
    screen.getByText(
      "Profile browsing mode. Connect a persistent backend to edit native profiles.",
    ),
  ).toBeTruthy();
});
