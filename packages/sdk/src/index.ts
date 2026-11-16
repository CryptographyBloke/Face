import type {
  AgentService,
  AgentRun,
  CreateAgentRun,
  RunCredentials,
  AgentRunEvent,
} from "./execution";
export type {
  AgentService,
  AgentRun,
  CreateAgentRun,
  RunCredentials,
  AgentRunEvent,
} from "./execution";
export interface Profile {
  chainId: 1;
  address: string;
  avatar: {
    uri: string | null;
    resolvedUrl: string | null;
    urls: string[];
    source: "face" | "snapshot" | "ens" | "none";
  };
  profile: {
    name: string | null;
    bio: string | null;
    links: string[];
    revision: number;
  };
  provenance: {
    profileClaimVerified: boolean;
    sources: string[];
    warnings: string[];
    verification: unknown;
  };
  updatedAt: string | null;
  cache: { fetchedAt: string; ttlSeconds: number };
}
export interface Provenance {
  fetchedAt: string;
  votesComplete: boolean;
  proposalsComplete: boolean;
  votesScanned: number;
  proposalsScanned: number;
  sourceUrl: string;
  privacyPolicy: string;
}
export interface Space {
  space: {
    id: string;
    name: string;
    about: string;
    avatar: string | null;
    network: string;
    admins: string[];
  };
  official: boolean;
  branding: { name: string; about: string } | null;
  counts: {
    publicParticipantsObserved: number;
    claimedProfilesObserved: number;
    proposalsObserved: number;
  };
  proposals: {
    id: string;
    title: string;
    created: number;
    privacy: string | null;
    votes: number;
  }[];
  provenance: Provenance;
}
export interface SpaceSummary {
  space: Space["space"];
  provenance: { source: "snapshot"; sourceUrl: string; fetchedAt: string };
}
export interface Participant {
  address: string;
  publicVotes: number;
  lastVotedAt: number;
  profileClaimed: boolean;
  name: string | null;
  badges: {
    id: string;
    type: string;
    issuer: string;
    revokedAt: string | null;
    expiresAt: number | null;
  }[];
  roles: { role: string; issuer: string }[];
}
export interface Directory {
  kind: "public_governance_participants";
  items: Participant[];
  page: number;
  hasMore: boolean;
  totalObserved: number;
  provenance: Provenance;
}
export interface Activity {
  items: {
    id: string;
    voter: string;
    created: number;
    vp: number;
    proposal: { id: string; title: string };
  }[];
  provenance: Provenance;
}
export function validateAddress(value: string) {
  if (!/^0x[0-9a-fA-F]{40}$/.test(value))
    throw new Error("Invalid EVM address");
  return value;
}
export function validateSpace(value: string) {
  if (!/^[a-z0-9][a-z0-9._-]{0,99}$/.test(value))
    throw new Error("Invalid Snapshot Space ID");
  return value;
}
export class FaceClient {
  private runHeaders(credentials: RunCredentials = {}, write = false) {
    return {
      ...(write ? { "Content-Type": "application/json" } : {}),
      ...(write && this.baseUrl
        ? { Origin: new URL(this.baseUrl).origin }
        : {}),
      ...(credentials.accessToken
        ? { "X-Face-Run-Token": credentials.accessToken }
        : {}),
      ...(credentials.sessionToken
        ? { Authorization: "Bearer " + credentials.sessionToken }
        : {}),
    };
  }
  listAgentServices(
    query: {
      q?: string;
      category?: string;
      protocol?: string;
      price?: "free" | "paid";
    } = {},
    options: RequestInit = {},
  ) {
    const p = new URLSearchParams(
      Object.entries(query).filter(([, v]) => v !== undefined) as [
        string,
        string,
      ][],
    );
    return this.request<{ items: AgentService[] }>(
      "/v1/marketplace/services?" + p,
      options,
    );
  }
  getAgentService(id: string, options: RequestInit = {}) {
    return this.request<AgentService>(
      "/v1/marketplace/services/" + encodeURIComponent(id),
      options,
    );
  }
  createAgentRun(
    input: CreateAgentRun,
    credentials: RunCredentials = {},
    options: RequestInit = {},
  ) {
    return this.request<AgentRun>("/v1/agent-runs", {
      ...options,
      method: "POST",
      headers: { ...this.runHeaders(credentials, true), ...options.headers },
      body: JSON.stringify(input),
    });
  }
  getAgentRun(
    id: string,
    credentials: RunCredentials,
    options: RequestInit = {},
  ) {
    return this.request<AgentRun>("/v1/agent-runs/" + encodeURIComponent(id), {
      ...options,
      headers: { ...this.runHeaders(credentials), ...options.headers },
    });
  }
  cancelAgentRun(
    id: string,
    credentials: RunCredentials,
    options: RequestInit = {},
  ) {
    return this.request<AgentRun>(
      "/v1/agent-runs/" + encodeURIComponent(id) + "/cancel",
      {
        ...options,
        method: "POST",
        headers: { ...this.runHeaders(credentials, true), ...options.headers },
        body: "{}",
      },
    );
  }
  async *executeAgentRun(
    id: string,
    approval: { approved: true; planHash: string },
    credentials: RunCredentials,
    signal?: AbortSignal,
  ): AsyncGenerator<AgentRunEvent> {
    const response = await this.fetcher(
      this.baseUrl.replace(/\/$/, "") +
        "/v1/agent-runs/" +
        encodeURIComponent(id) +
        "/execute",
      {
        method: "POST",
        headers: this.runHeaders(credentials, true),
        body: JSON.stringify(approval),
        signal: AbortSignal.any([
          ...(signal ? [signal] : []),
          AbortSignal.timeout(50000),
        ]),
      },
    );
    if (!response.ok)
      throw Error(
        (await response.json()).error?.message || "Task execution failed",
      );
    const reader = response.body?.getReader();
    if (!reader) throw Error("Task stream missing");
    const decoder = new TextDecoder();
    let buffer = "";
    try {
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        buffer += decoder.decode(part.value, { stream: true });
        if (buffer.length > 250000) throw Error("Task stream exceeds limit");
        let end;
        while ((end = buffer.indexOf("\n")) >= 0) {
          const line = buffer.slice(0, end);
          buffer = buffer.slice(end + 1);
          if (line.trim()) yield JSON.parse(line) as AgentRunEvent;
        }
      }
      buffer += decoder.decode();
      if (buffer.trim()) yield JSON.parse(buffer) as AgentRunEvent;
    } finally {
      await reader.cancel().catch(() => {});
      reader.releaseLock();
    }
  }
  constructor(
    public baseUrl = "",
    private fetcher: typeof fetch = (input, init) => fetch(input, init),
  ) {}
  async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const r = await this.fetcher(this.baseUrl.replace(/\/$/, "") + path, {
      cache: "no-store",
      ...options,
      signal: options.signal
        ? AbortSignal.any([options.signal, AbortSignal.timeout(30000)])
        : AbortSignal.timeout(30000),
    });
    const body = await r.json();
    if (!r.ok)
      throw new Error(body.error?.message || `Face API HTTP ${r.status}`);
    return body as T;
  }
  async resolveProfile(
    {
      address,
      chainId = 1,
    }: {
      address: string;
      chainId?: number;
    },
    options: RequestInit = {},
  ): Promise<Profile> {
    const p = await this.request<Profile>(
      `/v1/profile/${chainId}/${validateAddress(address)}`,
      options,
    );
    if (
      p.chainId !== 1 ||
      !/^0x[0-9a-fA-F]{40}$/.test(p.address) ||
      !Array.isArray(p.avatar?.urls) ||
      typeof p.provenance?.profileClaimVerified !== "boolean"
    )
      throw new Error("Invalid Face profile response");
    const https = (value: unknown) => {
      if (typeof value !== "string") return false;
      try {
        const u = new URL(value);
        return u.protocol === "https:" && !u.username && !u.password;
      } catch {
        return false;
      }
    };
    if (
      !p.avatar.urls.every(https) ||
      !Array.isArray(p.profile?.links) ||
      !p.profile.links.every(https)
    )
      throw new Error("Unsafe Face profile URL");
    return p;
  }
  summary(id: string, options: RequestInit = {}) {
    return this.request<SpaceSummary>(
      `/v1/spaces/${encodeURIComponent(validateSpace(id))}/summary`,
      options,
    );
  }
  space(id: string, options: RequestInit = {}) {
    return this.request<Space>(
      `/v1/spaces/${encodeURIComponent(validateSpace(id))}`,
      options,
    );
  }
  directory(
    id: string,
    page = 0,
    search = "",
    options: RequestInit = {},
    sort = "recent",
  ) {
    return this.request<Directory>(
      `/v1/spaces/${encodeURIComponent(validateSpace(id))}/members?page=${page}&search=${encodeURIComponent(search)}&sort=${encodeURIComponent(sort)}`,
      options,
    );
  }
  activity(id: string, options: RequestInit = {}) {
    return this.request<Activity>(
      `/v1/spaces/${encodeURIComponent(validateSpace(id))}/activity`,
      options,
    );
  }
}

/** Personal Agent evidence v1. Capabilities and prices remain publisher declarations. */
export interface PersonalAgentIdentity {
  schemaVersion: 1;
  agentId: string;
  profileWallet: string;
  declaredController: string;
  localOnly: boolean;
  links: Array<{
    id: string;
    owner: string;
    controller: string;
    revision: number;
    effectiveStatus:
      | "pending"
      | "active"
      | "stale_profile"
      | "disconnected"
      | "revoked";
    availability:
      | "local_not_publicly_reachable"
      | "service_availability_unchecked";
    verification: {
      ownerSignature: boolean;
      controllerSignature: boolean;
      activeAssociation: boolean;
      endpointControl: boolean;
    };
    endpoint_evidence: Array<{
      url: string;
      proofUrl: string;
      checkedAt: string;
    }>;
  }>;
  paymentWallets: Array<{
    wallet: string;
    network: string;
    revision: number;
    controlVerified: boolean;
    revoked: boolean;
    settlementProcessed: false;
  }>;
  registration: {
    current: boolean;
    checked_at: string;
    evidence: Record<string, unknown>;
  } | null;
  capabilitiesStatus: "self_declared";
  serviceDelivery: "not_attested";
}
export function resolveAgentIdentity(
  client: FaceClient,
  id: string,
  options: RequestInit = {},
) {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      id,
    )
  )
    throw new Error("Invalid Agent ID");
  return client.request<PersonalAgentIdentity>(
    `/v1/platform/agents/${id}/identity`,
    options,
  );
}

/** Public service metadata, distinct from domain control and successful execution. */
export interface AgentDiscovery {
  schemaVersion: "walletface.agent-discovery/2";
  agentId: string;
  profileRevision: number;
  name: string;
  profileWallet: string;
  declaredController: string;
  localOnly: boolean;
  interfaces: Array<{
    protocol: "mcp" | "a2a" | "https";
    url: string;
    declaration: "publisher_signed";
    checks: Array<{
      agent_revision: number;
      currentProfile: boolean;
      checked_at: string;
      evidence: Record<string, unknown>;
    }>;
  }>;
  capabilities: { status: "self_declared"; items: string[] };
  sourceUrl: string;
  retrievedAt: string;
  taskExecution: false;
  externalToolExecution: false;
  ap2Compliant: false;
}
export function resolveAgentDiscovery(
  client: FaceClient,
  id: string,
  options: RequestInit = {},
) {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      id,
    )
  )
    throw new Error("Invalid Agent ID");
  return client.request<AgentDiscovery>(
    "/v1/platform/agents/" + id + "/discovery",
    options,
  );
}
