import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { PreferencesProvider } from "./app/Preferences";
import Copilot from "./product/Copilot";
const evidence = {
  tool: "analyzeParticipation",
  data: {
    publicVotes: 3,
    uniqueWallets: 2,
    ranking: [],
    topFiveShare: 1,
    distribution: { one: 1, twoToFive: 1, sixPlus: 0 },
    dailyCounts: [],
    ranges: [],
  },
  provenance: {
    source: "snapshot",
    sourceUrl: "https://snapshot.box/#/ens.eth",
    fetchedAt: "2026-11-15T00:00:00Z",
    votesScanned: 500,
    proposalsScanned: 50,
    votesComplete: false,
    proposalsComplete: false,
    privateVotesOmitted: 5,
    scanLimits: { votes: 500, proposals: 50 },
  },
  untrustedContent: true,
};
function mount() {
  return render(
    <MemoryRouter>
      <PreferencesProvider>
        <Copilot spaceId="ens.eth" />
      </PreferencesProvider>
    </MemoryRouter>,
  );
}
beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("wallet-face-language", "en");
});
function dataFetch(status = { available: false, mode: "data-only" }) {
  return vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(async (input) =>
      String(input).includes("/status")
        ? Response.json(status)
        : Response.json(evidence),
    );
}
describe("Face Copilot", () => {
  it("opens public conversation without access-code input and links to reviewed operations", async () => {
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (input) =>
        String(input).includes("/status")
          ? Response.json({ available: true, mode: "public" })
          : new Response(
              [
                { type: "text", text: "Public analysis [1]." },
                {
                  type: "done",
                  usage: { totalTokens: 5 },
                  toolCalls: 1,
                  metered: true,
                },
              ]
                .map((x) => JSON.stringify(x) + "\n")
                .join(""),
            ),
      );
    mount();
    await screen.findByText("AI open to everyone · public data tools");
    expect(screen.queryByLabelText("Beta access key")).toBeNull();
    expect(
      screen
        .getByRole("link", { name: "Connect my Agent" })
        .getAttribute("href"),
    ).toBe("/my-agents");
    expect(
      screen
        .getByRole("link", { name: "Spending approvals" })
        .getAttribute("href"),
    ).toBe("/spending");
    fireEvent.change(screen.getByLabelText("Governance question"), {
      target: { value: "Analyze ENS" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await screen.findByText("Public analysis [1].");
    const call = fetch.mock.calls.find(([url]) => url === "/v1/ai/chat");
    expect(call?.[1]?.headers).toEqual({ "Content-Type": "application/json" });
  });
  it("shows honest disabled AI and returns real tool response cards with scan scope and trusted source", async () => {
    const fetch = dataFetch();
    mount();
    await screen.findByText("Public data available · AI awaiting activation");
    fireEvent.click(
      screen.getByRole("button", { name: "Participation analysis" }),
    );
    await screen.findByText("Scan limited (50/500)", { exact: false });
    expect(
      screen.getByText("500 votes scanned", { exact: false }),
    ).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "snapshot ↗" }).getAttribute("href"),
    ).toBe(evidence.provenance.sourceUrl);
    expect(fetch).toHaveBeenCalledWith(
      "/v1/ai/tools/analyzeParticipation",
      expect.objectContaining({
        method: "POST",
        body: '{"spaceId":"ens.eth"}',
      }),
    );
    expect(
      (screen.getByRole("button", { name: "Send" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });
  it("renders Chinese interface and incomplete dataset labels", async () => {
    localStorage.setItem("wallet-face-language", "zh");
    dataFetch();
    mount();
    await screen.findByText("公开数据可用 · AI 待激活");
    fireEvent.click(screen.getByRole("button", { name: "参与统计" }));
    await screen.findByText("扫描范围有限 (50/500)", { exact: false });
    expect(screen.getByText("隐私投票已排除: 5")).toBeTruthy();
  });
  it("handles upstream failure and exposes retry without fabricated metrics", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) =>
      String(input).includes("/status")
        ? Response.json({ available: false })
        : Response.json(
            {
              error: {
                code: "SNAPSHOT_UNAVAILABLE",
                message: "Snapshot timed out",
              },
            },
            { status: 502 },
          ),
    );
    mount();
    await screen.findByText("Public data available · AI awaiting activation");
    fireEvent.click(
      screen.getByRole("button", { name: "Participation analysis" }),
    );
    await screen.findByRole("alert");
    expect(screen.getByText("Snapshot timed out")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
  });
  it("streams model text and tool evidence safely, with copy/export actions", async () => {
    const text = "<script>alert(1)</script> Observed 3 votes [1].";
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) =>
      String(input).includes("/status")
        ? Response.json({ available: true, mode: "restricted-beta" })
        : new Response(
            [
              { type: "tool", name: "analyzeParticipation", status: "running" },
              { type: "evidence", id: 1, result: evidence },
              { type: "text", text },
              {
                type: "done",
                usage: { inputTokens: 100, outputTokens: 10, totalTokens: 110 },
                toolCalls: 1,
                metered: true,
              },
            ]
              .map((e) => JSON.stringify(e) + "\n")
              .join(""),
          ),
    );
    const view = mount();
    await screen.findByText("AI beta · read-only tools");
    fireEvent.change(screen.getByLabelText("Governance question"), {
      target: { value: "Analyze this Space" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await screen.findByText(text);
    expect(view.container.querySelector("script")).toBeNull();
    expect(screen.getByRole("button", { name: "Export" })).toBeTruthy();
    expect(screen.getByText("110 tokens · 1 tools")).toBeTruthy();
  });
  it("rejects malformed stream with recovery controls", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) =>
      String(input).includes("/status")
        ? Response.json({ available: true })
        : new Response("bad-json\n"),
    );
    mount();
    await screen.findByText("AI beta · read-only tools");
    fireEvent.change(screen.getByLabelText("Governance question"), {
      target: { value: "Analyze" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await screen.findByRole("alert");
    expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
  });
  it("cancels pending public data retrieval", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      if (String(input).includes("/status"))
        return Response.json({ available: false });
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () =>
          reject(new DOMException("aborted", "AbortError")),
        );
      });
    });
    mount();
    await screen.findByText("Public data available · AI awaiting activation");
    fireEvent.click(
      screen.getByRole("button", { name: "Participation analysis" }),
    );
    await screen.findByRole("button", { name: "Stop" });
    fireEvent.click(screen.getByRole("button", { name: "Stop" }));
    await screen.findByText("Stopped");
    expect(
      (
        screen.getByRole("button", {
          name: "Participation analysis",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false);
  });
  it("keeps model supplied URLs as plain text and refuses unsafe source cards", async () => {
    dataFetch();
    const e = {
      ...evidence,
      provenance: { ...evidence.provenance, sourceUrl: "javascript:alert(1)" },
    };
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) =>
      String(input).includes("/status")
        ? Response.json({ available: false })
        : Response.json(e),
    );
    mount();
    await screen.findByText("Public data available · AI awaiting activation");
    fireEvent.click(
      screen.getByRole("button", { name: "Participation analysis" }),
    );
    await screen.findByText("Top five share");
    expect(screen.queryByRole("link", { name: "snapshot ↗" })).toBeNull();
  });
});
