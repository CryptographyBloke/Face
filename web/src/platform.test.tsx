import { beforeEach, describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { PreferencesProvider } from "./app/Preferences";
import { SignedAction, PlatformSession } from "./platform/client";
import Agents from "./platform/Agents";
import Analytics from "./platform/Analytics";
const wallet = vi.hoisted(() => ({
  address: "0x1111111111111111111111111111111111111111",
  walletClient: {
    getChainId: vi.fn(async () => 1),
    signTypedData: vi.fn(async () => "0x" + "1".repeat(130)),
  },
}));
vi.mock("./app/WalletProvider", () => ({
  useWallet: () => ({ wallet, connect: async () => wallet }),
}));
const typedData = {
  domain: {
    name: "Wallet Face Agent Platform",
    version: "1",
    chainId: 1,
    salt: "0x" + "a".repeat(64),
  },
  types: { Authorization: [{ name: "actor", type: "address" }] },
  primaryType: "Authorization",
  message: {
    actor: wallet.address,
    nonce: "0x" + "a".repeat(64),
    origin: "http://localhost:3000",
  },
};
function mount(ui: React.ReactNode) {
  return render(
    <MemoryRouter>
      <PreferencesProvider>
        <PlatformSession>{ui}</PlatformSession>
      </PreferencesProvider>
    </MemoryRouter>,
  );
}
beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("wallet-face-language", "en");
  wallet.walletClient.signTypedData.mockClear();
  wallet.walletClient.getChainId.mockResolvedValue(1);
});
describe("Wallet authorized Agent platform", () => {
  it("requires visible review and a separate user click before wallet signing or execution", async () => {
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (input) =>
        String(input).endsWith("/challenge")
          ? Response.json({ typedData, payload: { name: "Reviewed agent" } })
          : Response.json({ id: "saved" }),
      );
    const done = vi.fn();
    mount(
      <SignedAction
        action="agent.register"
        payload={{ name: "Reviewed agent" }}
        onDone={done}
      >
        Review profile
      </SignedAction>,
    );
    expect(fetch).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Review profile" }));
    await screen.findByRole("dialog");
    expect(wallet.walletClient.signTypedData).not.toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(
      screen.getByText("Application origin:", { exact: false }),
    ).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: "Confirm and sign in wallet" }),
    );
    await waitFor(() => expect(done).toHaveBeenCalledWith({ id: "saved" }));
    expect(wallet.walletClient.signTypedData).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenLastCalledWith(
      "/v1/platform/execute",
      expect.objectContaining({ method: "POST" }),
    );
  });
  it("wrong chain blocks signature and preserves review for recovery", async () => {
    wallet.walletClient.getChainId.mockResolvedValue(10);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({ typedData, payload: { purpose: "workspace.read" } }),
    );
    mount(
      <SignedAction
        action="session.create"
        payload={{ purpose: "workspace.read" }}
      >
        Open workspace
      </SignedAction>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Open workspace" }));
    await screen.findByRole("dialog");
    fireEvent.click(
      screen.getByRole("button", { name: "Confirm and sign in wallet" }),
    );
    await screen.findByText("Switch your wallet to Ethereum mainnet.");
    expect(wallet.walletClient.signTypedData).not.toHaveBeenCalled();
  });
  it("directory distinguishes empty public records and real upstream errors", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({ items: [] }),
    );
    mount(<Agents />);
    await screen.findByText("No published agents yet");
    expect(
      screen.getByRole("link", { name: "Register Agent" }).getAttribute("href"),
    ).toBe("/agents/new");
  });
  it("Chinese profile review labels and authorization errors remain readable", async () => {
    localStorage.setItem("wallet-face-language", "zh");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json(
        { error: { message: "Administrator permission required" } },
        { status: 403 },
      ),
    );
    mount(
      <SignedAction action="organization.configure" payload={{}}>
        审核设置
      </SignedAction>,
    );
    fireEvent.click(screen.getByRole("button", { name: "审核设置" }));
    await screen.findByRole("alert");
    expect(wallet.walletClient.signTypedData).not.toHaveBeenCalled();
  });
  it("analytics labels observed coverage and uses explicit UTC dates", async () => {
    const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({
        spaceId: "ens.eth",
        votes: 390,
        wallets: 128,
        ranking: [],
        distribution: [],
        trends: [],
        comparison: null,
        provenance: {
          sourceUrl: "https://snapshot.box/#/ens.eth",
          retrievedAt: "2026-11-15T00:00:00Z",
          completeness: "partial",
          scan: { proposals_scanned: 100, votes_scanned: 100 },
        },
      }),
    );
    mount(<Analytics />);
    fireEvent.click(screen.getByRole("button", { name: "Load analytics" }));
    await screen.findByText("390");
    expect(
      screen.getByText("Coverage:", { exact: false }).textContent,
    ).toContain("partial");
    expect(fetch).toHaveBeenCalledWith(
      "/v1/platform/analytics/ens.eth?",
      expect.anything(),
    );
    expect(
      (
        screen.getByRole("button", {
          name: "Admin: refresh next page",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });
});
