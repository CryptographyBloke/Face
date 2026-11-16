export interface AgentService {
  id: string;
  agentId: string | null;
  name: string;
  description: string;
  category: string;
  protocol: "internal" | "mcp" | "a2a";
  capability: string;
  inputSchema: Record<string, unknown>;
  endpointUrl: string | null;
  revision: number;
  executionAvailable: boolean;
  availability: string;
  platformProvided: boolean;
  owner: string | null;
  price: {
    network: string;
    asset: string;
    amount: string;
    payTo: string;
  } | null;
}
export interface CreateAgentRun {
  id: string;
  serviceId: string;
  task: string;
  language: "zh" | "en";
  arguments: Record<string, unknown>;
  retainResult: true;
}
export interface AgentRun {
  id: string;
  serviceId: string;
  state:
    | "awaiting_approval"
    | "executing"
    | "waiting_remote"
    | "needs_input"
    | "completed"
    | "failed"
    | "cancelled"
    | "execution_unknown";
  plan: AgentService;
  planHash: string;
  input: CreateAgentRun;
  result: Record<string, unknown> | null;
  errorCode?: string;
  accessToken?: string;
  createdAt: string;
  expiresAt: string;
}
export interface RunCredentials {
  accessToken?: string;
  sessionToken?: string;
}
export interface AgentRunEvent {
  kind: string;
  text?: string;
  tool?: string;
  code?: string;
  message?: string;
  run?: AgentRun;
}
