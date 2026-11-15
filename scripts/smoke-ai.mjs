import { writeFile } from "node:fs/promises";
import { Snapshot } from "../server/snapshot.mjs";
import { createToolRegistry } from "../server/ai/tools.mjs";
const registry = createToolRegistry({ snapshot: new Snapshot(), maxCalls: 20 });
const results = [];
for (const spaceId of ["ens.eth", "yam.eth"]) {
  const space = await registry.run("getSpace", { spaceId });
  const participation = await registry.run("analyzeParticipation", {
    spaceId,
    ranges: [
      { start: 1792195200, end: 1793404800 },
      { start: 1793404800, end: 1794700800 },
    ],
  });
  const participants = await registry.run("listParticipants", {
    spaceId,
    limit: 3,
  });
  const activity = await registry.run("getGovernanceActivity", {
    spaceId,
    limit: 3,
  });
  const proposalId = space.data.proposals[0]?.id;
  const proposal = proposalId
    ? await registry.run("getProposal", { spaceId, proposalId })
    : null;
  const address = participants.data.items[0]?.address;
  const wallet = address
    ? await registry.run("getWalletProfile", { chainId: 1, address })
    : null;
  results.push({
    spaceId,
    space,
    participation,
    participants,
    activity,
    proposal,
    wallet,
  });
  console.log(
    JSON.stringify({
      spaceId,
      name: space.data.space.name,
      publicVotes: participation.data.publicVotes,
      wallets: participation.data.uniqueWallets,
      scope: space.provenance,
      proposal: proposal?.data.title,
      contentStatus: proposal?.data.contentStatus,
      wallet: wallet?.data.address,
    }),
  );
}
if (process.env.FACE_SMOKE_OUTPUT)
  await writeFile(
    process.env.FACE_SMOKE_OUTPUT,
    JSON.stringify(
      { retrievedAt: new Date().toISOString(), modelUsed: false, results },
      null,
      2,
    ),
  );
