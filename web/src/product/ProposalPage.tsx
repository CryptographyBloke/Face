import { Link, useParams } from "react-router-dom";
import { usePreferences } from "../app/Preferences";
import { validSpaceId } from "../app/config";
import { api, useResource } from "../app/resource";
import type { Evidence } from "../../../packages/sdk/src/ai";
import { ErrorState, LoadingSkeleton } from "../ui/primitives";
import Copilot, { EvidenceCard } from "./Copilot";
export default function ProposalPage() {
  const { spaceId = "", proposalId = "" } = useParams();
  const { t } = usePreferences();
  if (!validSpaceId(spaceId) || !/^0x[0-9a-fA-F]{64}$/.test(proposalId))
    return <p>{t("提案地址无效", "Invalid proposal URL")}</p>;
  return (
    <Proposal
      key={spaceId + proposalId}
      spaceId={spaceId}
      proposalId={proposalId}
    />
  );
}
function Proposal({
  spaceId,
  proposalId,
}: {
  spaceId: string;
  proposalId: string;
}) {
  const { t } = usePreferences();
  const state = useResource(
    "proposal:" + spaceId + ":" + proposalId,
    (signal) =>
      api.request<Evidence>("/v1/ai/tools/getProposal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spaceId, proposalId }),
        signal,
      }),
  );
  return (
    <div className="page-stack">
      <Link to={"/spaces/" + encodeURIComponent(spaceId)}>{spaceId} ←</Link>
      <h1>{t("提案研究", "Proposal research")}</h1>
      {state.data ? (
        <EvidenceCard e={state.data} index={1} />
      ) : state.error ? (
        <ErrorState message={state.error} retry={state.retry} />
      ) : (
        <LoadingSkeleton rows={4} />
      )}
      <Copilot spaceId={spaceId} proposalId={proposalId} />
    </div>
  );
}
