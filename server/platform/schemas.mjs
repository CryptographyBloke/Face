import { personalAgentFields } from "../personal/schemas.mjs";
import { z } from "zod";
const id = z.string().uuid(),
  addr = z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  space = z.string().regex(/^[a-z0-9][a-z0-9._-]{0,99}$/),
  hash = z.string().regex(/^0x[0-9a-f]{64}$/);
const text = (n) => z.string().trim().max(n);
const https = z
  .string()
  .max(2048)
  .url()
  .refine((v) => {
    const u = new URL(v);
    return u.protocol === "https:" && !u.username && !u.password && !u.hash;
  });
const endpoint = z
  .object({ protocol: z.enum(["https", "mcp", "a2a"]), url: https })
  .strict();
const agentFields = {
  ...personalAgentFields,
  id,
  name: text(100).min(1),
  description: text(2000),
  avatar: https.nullable().default(null),
  capabilities: z.array(text(100).min(1)).max(30),
  endpoints: z.array(endpoint).max(10),
  registry: z
    .object({
      chainId: z.literal(1),
      registryAddress: addr,
      tokenId: z.string().regex(/^\d{1,78}$/),
    })
    .strict()
    .nullable()
    .default(null),
  organizations: z
    .array(z.object({ spaceId: space, description: text(200) }).strict())
    .max(10)
    .default([]),
  published: z.boolean().default(true),
};
export const actionKinds = [
  "report.publish",
  "announcement.publish",
  "proposal.draft.save",
  "badge.issue",
  "badge.revoke",
  "role.set",
];
export const actionContent = {
  "report.publish": z.object({ reportId: id }).strict(),
  "announcement.publish": z
    .object({ title: text(160).min(1), body: text(12000).min(1) })
    .strict(),
  "proposal.draft.save": z
    .object({
      title: text(160).min(1),
      body: text(12000).min(1),
      choices: z.array(text(200).min(1)).min(2).max(20),
    })
    .strict(),
  "badge.issue": z
    .object({
      recipient: addr,
      type: z.enum(["Organization Member", "Event Participant", "Contributor"]),
      evidence: text(1000),
      expiresAt: z.number().int().positive().nullable(),
    })
    .strict(),
  "badge.revoke": z.object({ badgeId: id }).strict(),
  "role.set": z.object({ recipient: addr, role: text(60) }).strict(),
};
export const platformSchemas = {
  "session.create": z.object({ purpose: z.literal("workspace.read") }).strict(),
  "agent.register": z
    .object(agentFields)
    .strict()
    .refine(
      (p) =>
        !p.localOnly || (!p.endpoints.length && !(p.services || []).length),
      {
        message:
          "Local-only profiles cannot declare public endpoints or services",
      },
    ),
  "agent.update": z
    .object({ ...agentFields, revision: z.number().int().positive() })
    .strict()
    .refine(
      (p) =>
        !p.localOnly || (!p.endpoints.length && !(p.services || []).length),
      {
        message:
          "Local-only profiles cannot declare public endpoints or services",
      },
    ),
  "report.save": z
    .object({
      id,
      spaceId: space,
      title: text(160).min(1),
      summary: text(12000),
      public: z.boolean().default(false),
      tools: z
        .array(
          z
            .object({
              name: z.enum([
                "getSpace",
                "listParticipants",
                "getGovernanceActivity",
                "getProposal",
                "analyzeParticipation",
              ]),
              input: z.record(z.string(), z.unknown()),
            })
            .strict(),
        )
        .min(1)
        .max(3),
    })
    .strict(),
  "organization.configure": z
    .object({
      spaceId: space,
      name: text(100).min(1),
      description: text(2000),
      refreshEnabled: z.boolean(),
      revision: z.number().int().nonnegative(),
    })
    .strict(),
  "action.prepare": z
    .object({
      id,
      spaceId: space,
      kind: z.enum(actionKinds),
      content: z.record(z.string(), z.unknown()),
    })
    .strict()
    .superRefine((p, c) => {
      const r = actionContent[p.kind].safeParse(p.content);
      if (!r.success)
        c.addIssue({ code: "custom", message: "Invalid action content" });
    }),
  "action.approve": z
    .object({ id, revision: z.number().int().positive(), contentHash: hash })
    .strict(),
  "action.execute": z
    .object({ id, revision: z.number().int().positive(), contentHash: hash })
    .strict(),
  "action.cancel": z
    .object({ id, revision: z.number().int().positive(), contentHash: hash })
    .strict(),
  "agent.verify.endpoint": z
    .object({ id, revision: z.number().int().positive(), endpointUrl: https })
    .strict(),
  "agent.verify.registry": z
    .object({ id, revision: z.number().int().positive() })
    .strict(),
};
export function parsePlatformPayload(action, payload) {
  const schema = platformSchemas[action];
  if (!schema) throw new Error("Unsupported platform action");
  return schema.parse(payload);
}
