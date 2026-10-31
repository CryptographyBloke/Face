import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
Object.defineProperty(window, "scrollTo", { value: () => {}, writable: true });
Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
  value: function (this: HTMLDialogElement) {
    this.setAttribute("open", "");
  },
  writable: true,
});
Object.defineProperty(HTMLDialogElement.prototype, "close", {
  value: function (this: HTMLDialogElement) {
    this.removeAttribute("open");
  },
  writable: true,
});
Object.defineProperty(URL, "createObjectURL", {
  value: () => "blob:preview",
  writable: true,
});
Object.defineProperty(URL, "revokeObjectURL", {
  value: () => {},
  writable: true,
});
