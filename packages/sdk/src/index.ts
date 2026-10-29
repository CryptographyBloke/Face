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
  constructor(
    public baseUrl = "",
    private fetcher: typeof fetch = (input, init) => fetch(input, init),
  ) {}
  async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const r = await this.fetcher(this.baseUrl.replace(/\/$/, "") + path, {
      cache: "no-store",
      ...options,
      signal: options.signal || AbortSignal.timeout(30000),
    });
    const body = await r.json();
    if (!r.ok)
      throw new Error(body.error?.message || `Face API HTTP ${r.status}`);
    return body as T;
  }
  async resolveProfile({
    address,
    chainId = 1,
  }: {
    address: string;
    chainId?: number;
  }): Promise<Profile> {
    const p = await this.request<Profile>(
      `/v1/profile/${chainId}/${validateAddress(address)}`,
    );
    if (
      p.chainId !== 1 ||
      !/^0x[0-9a-fA-F]{40}$/.test(p.address) ||
      !Array.isArray(p.avatar?.urls) ||
      typeof p.provenance?.profileClaimVerified !== "boolean"
    )
      throw new Error("Invalid Face profile response");
    return p;
  }
  space(id: string) {
    return this.request<Space>(
      `/v1/spaces/${encodeURIComponent(validateSpace(id))}`,
    );
  }
  directory(id: string, page = 0, search = "") {
    return this.request<Directory>(
      `/v1/spaces/${encodeURIComponent(validateSpace(id))}/members?page=${page}&search=${encodeURIComponent(search)}`,
    );
  }
  activity(id: string) {
    return this.request<Activity>(
      `/v1/spaces/${encodeURIComponent(validateSpace(id))}/activity`,
    );
  }
}
