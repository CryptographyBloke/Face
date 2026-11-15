import { beforeEach, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { PreferencesProvider } from "./app/Preferences";
import { PlatformSession } from "./platform/client";
import Payments from "./platform/Payments";
import { encodePaymentRequiredHeader } from "@x402/core/http";
const wallet = vi.hoisted(() => ({
  address: "0x1111111111111111111111111111111111111111",
  walletClient: { getChainId: vi.fn(async () => 1), signTypedData: vi.fn() },
}));
vi.mock("./app/WalletProvider", () => ({
  useWallet: () => ({ wallet, connect: async () => wallet }),
}));
const status = {
  enabled: true,
  network: "eip155:84532" as const,
  asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
  amount: "1000",
  receiver: "0x2222222222222222222222222222222222222222",
  missing: [],
  mainnetEnabled: false,
};
function mount() {
  return render(
    <MemoryRouter>
      <PreferencesProvider>
        <PlatformSession>
          <Payments />
        </PlatformSession>
      </PreferencesProvider>
    </MemoryRouter>,
  );
}
beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("wallet-face-language", "en");
  wallet.walletClient.signTypedData.mockClear();
});
it("disabled payment status is accurate and does not ask for signatures", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    Response.json({
      ...status,
      enabled: false,
      receiver: null,
      missing: ["FACE_X402_RECEIVER"],
    }),
  );
  mount();
  await screen.findByText("Testnet execution awaits configuration");
  expect(
    (
      screen.getByRole("button", {
        name: "Get testnet offer",
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
  expect(wallet.walletClient.signTypedData).not.toHaveBeenCalled();
});
it("requires explicit price review then rejects the wrong wallet chain without signing", async () => {
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    if (String(input).endsWith("/status")) return Response.json(status);
    const offer = {
      x402Version: 2,
      resource: {
        url: "http://localhost:3000" + String(input),
        description: "Governance report",
        mimeType: "application/json",
      },
      accepts: [
        {
          scheme: "exact",
          network: status.network,
          asset: status.asset,
          amount: status.amount,
          payTo: status.receiver,
          maxTimeoutSeconds: 120,
          extra: { name: "USDC", version: "2", assetTransferMethod: "eip3009" },
        },
      ],
    };
    return Response.json(offer, {
      status: 402,
      headers: { "PAYMENT-REQUIRED": encodePaymentRequiredHeader(offer) },
    });
  });
  mount();
  await screen.findByText("Testnet receiving enabled");
  fireEvent.click(screen.getByRole("button", { name: "Get testnet offer" }));
  await screen.findByRole("button", { name: "Review payment" });
  expect(wallet.walletClient.signTypedData).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Review payment" }));
  await screen.findByRole("dialog");
  fireEvent.click(
    screen.getByRole("button", { name: "Confirm testnet payment in wallet" }),
  );
  await screen.findByText("Switch your wallet to Base Sepolia testnet.");
  expect(wallet.walletClient.signTypedData).not.toHaveBeenCalled();
});
it("malformed status produces a recovery error instead of a render crash", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    Response.json({ unexpected: true }),
  );
  mount();
  await screen.findByRole("alert");
  expect(
    screen.getByRole("heading", { name: "Agent payments testnet" }),
  ).toBeTruthy();
});
