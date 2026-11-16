import { createAgentApi } from "../ai/chat.mjs";
import { researchWindow } from "./window.mjs";
import { ApiError } from "../validation.mjs";
export async function internalCopilot(
  snapshot,
  input,
  { signal, onProgress = async () => {}, origin, env, ip },
) {
  const window = researchWindow(snapshot, input.arguments);
  const api = createAgentApi({ snapshot: window.snapshot, origin, env }),
    request = new Request(origin + "/v1/ai/chat", {
      method: "POST",
      headers: {
        Origin: origin,
        "Content-Type": "application/json",
        ...(env.FACE_AI_ACCESS === "public"
          ? {}
          : { Authorization: "Bearer " + env.FACE_AI_BETA_TOKEN }),
      },
      body: JSON.stringify({
        context: { spaceId: input.arguments.spaceId },
        language: input.language,
        messages: [{ role: "user", content: input.task }],
      }),
      signal,
    });
  const response = await api(request, ip);
  if (!response.ok) {
    const d = await response.json();
    throw new ApiError(
      response.status,
      d.error?.code || "MODEL_UNAVAILABLE",
      d.error?.message || "Model unavailable",
    );
  }
  const reader = response.body.getReader(),
    decoder = new TextDecoder();
  let buffer = "",
    text = "",
    done = null;
  const evidence = [];
  const consume = async (line) => {
    if (!line.trim()) return;
    const e = JSON.parse(line);
    if (e.type === "error")
      throw new ApiError(
        502,
        e.code,
        "Copilot failed; inspect task and retry explicitly",
      );
    if (e.type === "text") {
      text += e.text;
      await onProgress({ kind: "text", text: e.text });
    }
    if (e.type === "evidence") {
      evidence.push(e.result);
      await onProgress({ kind: "evidence", result: e.result });
    }
    if (e.type === "tool")
      await onProgress({
        kind: "tool_started",
        tool: e.name,
        status: e.status,
      });
    if (e.type === "done") done = e;
  };
  try {
    while (true) {
      const { value, done: finished } = await reader.read();
      if (finished) break;
      buffer += decoder.decode(value, { stream: true });
      if (buffer.length > 100000)
        throw new ApiError(413, "MODEL_STREAM", "Malformed model stream");
      let end;
      while ((end = buffer.indexOf("\n")) >= 0) {
        await consume(buffer.slice(0, end));
        buffer = buffer.slice(end + 1);
      }
    }
    buffer += decoder.decode();
    await consume(buffer);
    if (!done)
      throw new ApiError(
        502,
        "MODEL_INTERRUPTED",
        "Model stream ended without completion",
      );
    return {
      text,
      evidence,
      queryRange: window.queryRange,
      usage: done.usage,
      metered: done.metered,
      toolCalls: done.toolCalls,
      untrustedContent: true,
      modelGenerated: true,
    };
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
