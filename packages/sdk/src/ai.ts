/** v0.5 read-only Agent contract. Server schemas remain the validation authority. */
export type ToolName =
  | "getWalletProfile"
  | "getSpace"
  | "listParticipants"
  | "getGovernanceActivity"
  | "getProposal"
  | "analyzeParticipation";
export interface AgentContext {
  spaceId?: string;
  address?: string;
  proposalId?: string;
}
export interface AgentProvenance {
  source: string;
  sourceUrl: string;
  fetchedAt: string;
  scope?: string;
  completeness?: string;
  votesScanned?: number;
  proposalsScanned?: number;
  votesComplete?: boolean;
  proposalsComplete?: boolean;
  publicVotesIncluded?: number;
  privateVotesOmitted?: number;
  claimVerified?: boolean;
  scanLimits?: { votes: number; proposals: number };
}
export interface Evidence {
  tool: ToolName;
  data: Record<string, unknown>;
  provenance: AgentProvenance;
  untrustedContent: true;
}
export interface AgentStatus {
  available: boolean;
  mode: "data-only" | "restricted-beta" | "public";
  model: string | null;
  readOnly: true;
  tools: ToolName[];
  missing: string[];
}
export type AgentEvent =
  | { type: "text"; text: string }
  | { type: "evidence"; id: number; result: Evidence }
  | { type: "tool"; name: ToolName; status: "running" | "failed" }
  | { type: "error"; code: string; message: string }
  | {
      type: "done";
      usage: { inputTokens: number; outputTokens: number; totalTokens: number };
      toolCalls: number;
      metered: boolean;
    };
