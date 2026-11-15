import { writeFile } from "node:fs/promises";
import { createAgentApi } from "../server/ai/chat.mjs";
import { Snapshot } from "../server/snapshot.mjs";
if (process.env.FACE_AI_VERIFY_ON_BUILD !== "true") process.exit(0);
if (process.env.VERCEL_ENV !== "preview")
  throw new Error("Live checks require Preview");
const env = { ...process.env, FACE_AI_ENABLED: "true" };
const handler = createAgentApi({
  snapshot: new Snapshot(),
  env,
  origin: "https://activation-test.invalid",
});
const checks = [];
const cases =
  process.env.FACE_AI_VERIFY_CASE === "proposal"
    ? [
        [
          "en",
          "ens.eth",
          "Use getProposal to explain this proposal briefly, including the voting window in UTC, choices and current public result. Cite evidence.",
          "0x5bc7802637848e22f47e23615d3dcb2649e10b5feed5033a974eb556cdf3627a",
        ],
      ]
    : [
        [
          "zh",
          "ens.eth",
          "请调用工具，简要说明这个社区在本次扫描中观察到多少条公开投票和多少个参与钱包，并标注证据。",
        ],
        [
          "en",
          "yam.eth",
          "Use the tools to report the observed public vote count and unique wallet count in this scan, citing evidence.",
        ],
      ];
for (const [language, spaceId, prompt, proposalId] of cases) {
  const response = await handler(
    new Request("https://activation-test.invalid/v1/ai/chat", {
      method: "POST",
      headers: {
        origin: "https://activation-test.invalid",
        "content-type": "application/json",
        authorization: "Bearer " + env.FACE_AI_BETA_TOKEN,
      },
      body: JSON.stringify({
        messages: [{ role: "user", content: prompt }],
        context: { spaceId, ...(proposalId ? { proposalId } : {}) },
        language,
      }),
    }),
    "owner-live-check",
  );
  if (!response.ok) {
    const error = await response.json();
    checks.push({
      language,
      spaceId,
      success: false,
      status: response.status,
      code: error.error?.code,
    });
    continue;
  }
  const events = (await response.text())
    .trim()
    .split("\n")
    .filter(Boolean)
    .map(JSON.parse);
  const evidence = events.filter((e) => e.type === "evidence");
  const text = events
    .filter((e) => e.type === "text")
    .map((e) => e.text)
    .join("");
  const done = events.find((e) => e.type === "done");
  const error = events.find((e) => e.type === "error");
  const proposal = evidence.find((e) => e.result.tool === "getProposal")?.result
    .data;
  const proposalDatesCorrect =
    !proposalId ||
    (!!proposal &&
      text.includes(proposal.startUtc.slice(0, 10)) &&
      text.includes(proposal.endUtc.slice(0, 10)));
  checks.push({
    language,
    spaceId,
    proposalDatesCorrect,
    success:
      !!done && evidence.length > 0 && !!text && !error && proposalDatesCorrect,
    usage: done?.usage,
    toolCalls: done?.toolCalls,
    metered: done?.metered,
    error: error ? { code: error.code, message: error.message } : null,
    answer: text,
    evidence: evidence.map((e) => ({
      id: e.id,
      tool: e.result.tool,
      data: e.result.data,
      provenance: e.result.provenance,
    })),
  });
}
const report = {
  checkedAt: new Date().toISOString(),
  provider: env.FACE_AI_PROVIDER,
  model: env.NEWAPI_MODEL,
  syntheticTestPrompts: true,
  checks,
};
await writeFile(
  "web/dist/ai-verification.json",
  JSON.stringify(report, null, 2),
);
console.log(
  "FACE_AI_LIVE_CHECK " +
    JSON.stringify({
      checkedAt: report.checkedAt,
      model: report.model,
      checks: checks.map(
        ({ language, spaceId, success, usage, toolCalls, error }) => ({
          language,
          spaceId,
          success,
          usage,
          toolCalls,
          error,
        }),
      ),
    }),
);
if (checks.some((c) => !c.success))
  throw new Error("Live AI acceptance failed; execution must remain disabled");
