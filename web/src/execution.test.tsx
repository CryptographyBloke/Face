import { beforeEach, describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { PreferencesProvider } from "./app/Preferences";
import Marketplace, { Playground } from "./platform/Execution";
vi.mock("./app/WalletProvider", () => ({
  useWallet: () => ({ wallet: null, connect: vi.fn() }),
}));
const service = {
  id: "test-service",
  agentId: null,
  name: "Research Agent",
  description: "Real research capability",
  category: "governance",
  protocol: "internal",
  capability: "governance_report",
  inputSchema: { type: "object" },
  endpointUrl: null,
  price: null,
  executionAvailable: true,
  availability: "ready",
  platformProvided: true,
  owner: null,
  revision: 1,
};
const run = {
  id: "aabbccdd-aabb-4abb-8abb-aabbccddeeff",
  state: "awaiting_approval",
  plan: service,
  planHash: "0x" + "1".repeat(64),
  input: { task: "Analyze public records", arguments: { spaceId: "ens.eth" } },
  result: null,
};
function mount(playground = false) {
  return render(
    <MemoryRouter initialEntries={["/agents/test-service/playground"]}>
      <PreferencesProvider>
        {playground ? (
          <Routes>
            <Route path="/agents/:id/playground" element={<Playground />} />
          </Routes>
        ) : (
          <Marketplace />
        )}
      </PreferencesProvider>
    </MemoryRouter>,
  );
}
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  localStorage.setItem("wallet-face-language", "en");
});
describe("Agent execution product", () => {
  it("filters real API services without fabricating counts or verified income", async () => {
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(Response.json({ items: [service] }));
    mount();
    await screen.findByText("Research Agent");
    fireEvent.change(screen.getByLabelText("Category"), {
      target: { value: "security" },
    });
    await waitFor(() =>
      expect(
        fetch.mock.calls.some(([u]) => String(u).includes("category=security")),
      ).toBe(true),
    );
    expect(
      screen.getByRole("link", { name: "Try Agent" }).getAttribute("href"),
    ).toContain("/playground?service=test-service");
    expect(screen.queryByText("0.10 USDC")).toBeNull();
  });
  it("requires retention consent and a separate exact-plan approval before execution", async () => {
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (url) =>
        String(url).includes("/marketplace/services/")
          ? Response.json(service)
          : String(url).endsWith("/execute")
            ? new Response(
                JSON.stringify({
                  kind: "done",
                  run: {
                    ...run,
                    state: "completed",
                    result: { text: "<script>untrusted output</script>" },
                  },
                }) + "\n",
              )
            : Response.json(run),
      );
    const view = mount(true);
    await screen.findByText("Research Agent");
    fireEvent.change(screen.getByLabelText("Task description"), {
      target: { value: "Analyze public records" },
    });
    expect(
      (
        screen.getByRole("button", {
          name: "Prepare and review task",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(
      screen.getByRole("button", { name: "Prepare and review task" }),
    );
    await screen.findByRole("button", {
      name: "Approve displayed capability and inputs, then execute",
    });
    expect(fetch.mock.calls.some(([u]) => String(u).endsWith("/execute"))).toBe(
      false,
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "Approve displayed capability and inputs, then execute",
      }),
    );
    await screen.findByText("<script>untrusted output</script>");
    expect(view.container.querySelector("script")).toBeNull();
    expect(screen.getByRole("button", { name: "Export JSON" })).toBeTruthy();
  });
  it("renders Chinese marketplace and free service labels", async () => {
    localStorage.setItem("wallet-face-language", "zh");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({ items: [service] }),
    );
    mount();
    await screen.findByText("Agent 服务市场");
    await screen.findByText("免费使用");
    expect(screen.getByRole("link", { name: "试用 Agent" })).toBeTruthy();
  });
  it("shows disabled service accurately and never creates or executes a paid task", async () => {
    const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({
        ...service,
        executionAvailable: false,
        availability: "payment_activation_required",
        price: { amount: "1000", network: "eip155:84532" },
      }),
    );
    mount(true);
    await screen.findByText(/Payment acceptance pending/);
    fireEvent.change(screen.getByLabelText("Task description"), {
      target: { value: "Task" },
    });
    fireEvent.click(screen.getByRole("checkbox"));
    expect(
      (
        screen.getByRole("button", {
          name: "Prepare and review task",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(
      fetch.mock.calls.filter(([u]) => String(u).includes("/agent-runs")),
    ).toHaveLength(0);
  });
});
