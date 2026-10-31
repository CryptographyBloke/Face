import { useEffect, useReducer } from "react";
import { FaceClient } from "../../../packages/sdk/src/index";
export const api = new FaceClient(import.meta.env.VITE_FACE_API_URL || "");
type Entry = {
  data?: unknown;
  error: string;
  at: number;
  controller?: AbortController;
  promise?: Promise<void>;
  listeners: Set<() => void>;
};
const cache = new Map<string, Entry>();
function start<T>(
  key: string,
  load: (signal: AbortSignal) => Promise<T>,
  force = false,
) {
  let entry = cache.get(key);
  if (!entry) {
    entry = { error: "", at: 0, listeners: new Set() };
    cache.set(key, entry);
  }
  if (
    entry.promise ||
    (!force && entry.data !== undefined && Date.now() - entry.at < 60000)
  )
    return entry;
  entry.controller = new AbortController();
  entry.error = "";
  const current = entry;
  entry.promise = Promise.resolve()
    .then(() => load(current.controller!.signal))
    .then((data) => {
      if (!current.controller?.signal.aborted) {
        current.data = data;
        current.at = Date.now();
      }
    })
    .catch((cause) => {
      if (!current.controller?.signal.aborted)
        current.error = cause instanceof Error ? cause.message : String(cause);
    })
    .finally(() => {
      current.promise = undefined;
      current.listeners.forEach((fn) => fn());
    });
  if (cache.size > 60) {
    for (const [id, other] of cache)
      if (id !== key && !other.listeners.size && !other.promise) {
        cache.delete(id);
        break;
      }
  }
  return current;
}
export function useResource<T>(
  key: string,
  load: (signal: AbortSignal) => Promise<T>,
  enabled = true,
) {
  const [, update] = useReducer((n) => n + 1, 0);
  useEffect(() => {
    if (!enabled) return;
    const entry = start(key, load);
    const notify = () => update();
    entry.listeners.add(notify);
    update();
    return () => {
      entry.listeners.delete(notify);
      queueMicrotask(() => {
        if (!entry.listeners.size && entry.promise) {
          entry.controller?.abort();
          if (cache.get(key) === entry) cache.delete(key);
        }
      });
    };
  }, [key, enabled]);
  const entry = enabled ? cache.get(key) : undefined;
  return {
    data: entry?.data as T | undefined,
    error: entry?.error || "",
    loading: enabled && !entry?.data && !entry?.error,
    retry: () => {
      if (enabled) {
        const e = start(key, load, true);
        e.listeners.forEach((fn) => fn());
        update();
      }
    },
  };
}
export function invalidateResource(key: string) {
  const entry = cache.get(key);
  if (entry) entry.at = 0;
}
export function clearResourceCache() {
  for (const entry of cache.values()) entry.controller?.abort();
  cache.clear();
}
export function useCapabilities() {
  const state = useResource("health", (signal) =>
    api.request<{ mode: "read-only" | "persistent"; version: string }>(
      "/health",
      { signal },
    ),
  );
  return { ...state, canWrite: state.data?.mode === "persistent" };
}
