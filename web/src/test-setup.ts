import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
Object.defineProperty(URL, "createObjectURL", {
  value: () => "blob:preview",
  writable: true,
});
Object.defineProperty(URL, "revokeObjectURL", {
  value: () => {},
  writable: true,
});
