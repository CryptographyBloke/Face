// Generates an ephemeral, unfunded test account in memory. No user key is read or saved.
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
const base = process.env.SMOKE_BASE || "http://127.0.0.1:8787";
const origin = process.env.SMOKE_ORIGIN || "http://localhost:8787";
const account = privateKeyToAccount(generatePrivateKey());
async function post(path, body) {
  const r = await fetch(base + path, {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const b = await r.json();
  if (!r.ok) throw new Error(JSON.stringify(b));
  return b;
}
async function operation(action, payload) {
  const c = await post("/v1/challenge", {
    address: account.address,
    action,
    payload,
  });
  const signature = await account.signTypedData({
    ...c.typedData,
    message: {
      ...c.typedData.message,
      expiresAt: BigInt(c.typedData.message.expiresAt),
    },
  });
  return post("/v1/execute", {
    nonce: c.typedData.message.nonce,
    signature,
    payload: c.payload,
  });
}
const result = await operation("profile.upsert", {
  name: "Automated test fixture — not a real person",
  bio: "Temporary unfunded test wallet",
  avatarURI: "",
  links: [],
  revision: 0,
});
try {
  const r = await fetch(base + "/v1/profile/1/" + account.address);
  const p = await r.json();
  if (!r.ok || !p.provenance.profileClaimVerified)
    throw Error("HTTP signed profile readback failed");
  console.log(
    JSON.stringify({
      flow: "HTTP challenge → EIP-712 sign → execute → resolve",
      status: "passed",
      testWallet: account.address,
      revision: p.profile.revision,
    }),
  );
} finally {
  await operation("profile.hide", { revision: result.revision });
  console.log("Temporary test profile hidden; production data untouched.");
}
