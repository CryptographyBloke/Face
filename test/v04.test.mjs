import test from "node:test";
import assert from "node:assert/strict";
import { createApi } from "../server/app.mjs";
const one = "0x1111111111111111111111111111111111111111",
  two = "0x2222222222222222222222222222222222222222";
test("Space summary reuses metadata without scanning participant history", async () => {
  let scans = 0;
  const snapshot = {
    space: async (id) => ({
      id,
      name: "Yam",
      avatar: null,
      network: "1",
      about: "Governance",
      admins: [],
    }),
    directory: async () => {
      scans++;
      throw new Error("Unexpected scan");
    },
  };
  const api = createApi({ snapshot });
  const res = await api(
    new Request("https://walletface.org/v1/spaces/yam.eth/summary"),
  );
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.space.id, "yam.eth");
  assert.equal(body.provenance.source, "snapshot");
  assert.equal(scans, 0);
});
test("Directory sorting is explicit and preserves search and pagination contract", async () => {
  const snapshot = {
    directory: async () => ({
      space: { id: "yam.eth", admins: [] },
      participants: [
        { address: one, publicVotes: 1, lastVotedAt: 20 },
        { address: two, publicVotes: 8, lastVotedAt: 10 },
      ],
      proposals: [],
      activity: [],
      provenance: { source: "snapshot" },
    }),
  };
  const api = createApi({ snapshot });
  const read = async (suffix) => {
    const r = await api(
      new Request("https://walletface.org/v1/spaces/yam.eth/members" + suffix),
    );
    return [r, await r.json()];
  };
  let [r, b] = await read("?sort=votes");
  assert.equal(r.status, 200);
  assert.equal(b.items[0].address, two);
  assert.equal(b.kind, "public_governance_participants");
  [, b] = await read("?sort=recent");
  assert.equal(b.items[0].address, one);
  [, b] = await read("?sort=address&search=" + two);
  assert.equal(b.items.length, 1);
  assert.equal(b.items[0].address, two);
  [r] = await read("?sort=untrusted");
  assert.equal(r.status, 422);
});
