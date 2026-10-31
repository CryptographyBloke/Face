import { api } from "../app/resource";
export function setupQA() {
  // The stable public 0.3 API supplies real data during local visual QA.
  // Its space response contains the metadata used by the new 0.4 summary route.
  if (import.meta.env.VITE_FACE_API_URL)
    api.summary = async (id, options) => {
      const result = await api.space(id, options);
      return {
        space: result.space,
        provenance: {
          source: "snapshot",
          sourceUrl: result.provenance.sourceUrl,
          fetchedAt: result.provenance.fetchedAt,
        },
      };
    };
  if (new URLSearchParams(window.location.search).get("qaWallet") !== "fixture")
    return;
  const address = "0x1111111111111111111111111111111111111111";
  window.ethereum = {
    request: async ({ method }) => {
      if (method === "eth_accounts" || method === "eth_requestAccounts")
        return [address];
      if (method === "eth_chainId") return "0x1";
      throw new Error("QA wallet fixture: signing is disabled");
    },
  };
  const note = document.createElement("div");
  note.textContent = "QA wallet fixture · signing disabled";
  Object.assign(note.style, {
    position: "fixed",
    bottom: "70px",
    right: "12px",
    zIndex: "200",
    background: "#ffe9a8",
    color: "#302400",
    padding: "8px",
    fontSize: "12px",
    borderRadius: "6px",
  });
  document.body.append(note);
}
