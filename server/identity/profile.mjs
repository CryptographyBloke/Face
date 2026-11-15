import { z } from "zod";
const https = z
  .string()
  .max(2048)
  .url()
  .refine((v) => {
    const u = new URL(v);
    return u.protocol === "https:" && !u.username && !u.password;
  });
const claim = z
  .object({
    value: z.string().max(500),
    status: z.enum(["self_declared", "verified", "revoked"]),
    evidenceId: z.string().max(100).nullable(),
    verifiedAt: z.string().datetime().nullable(),
  })
  .strict()
  .superRefine((c, ctx) => {
    if (c.status === "verified" && (!c.evidenceId || !c.verifiedAt))
      ctx.addIssue({
        code: "custom",
        message: "Verified claims require checked evidence and time",
      });
  });
export const agentProfileV1 = z
  .object({
    schemaVersion: z.literal("face.agent-profile/1"),
    agentId: z.string().min(1).max(200),
    name: z.string().min(1).max(100),
    description: z.string().max(2000),
    avatar: https.nullable(),
    controller: z
      .object({
        chainId: z.number().int().positive(),
        address: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
        claim,
      })
      .strict()
      .nullable(),
    capabilities: z.array(z.string().max(100)).max(30),
    endpoints: z
      .array(
        z
          .object({
            protocol: z.enum(["https", "mcp", "a2a"]),
            url: https,
            verifiedAt: z.string().datetime().nullable(),
          })
          .strict(),
      )
      .max(10),
    registry: z
      .object({
        standard: z.literal("ERC-8004"),
        specificationVersion: z.string().max(100),
        chainId: z.number().int().positive(),
        registryAddress: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
        tokenId: z.string().regex(/^\d+$/),
        checkedBlock: z.number().int().nonnegative().nullable(),
      })
      .strict()
      .nullable(),
    organizations: z.array(claim).max(20),
    provenance: z
      .array(
        z
          .object({
            source: https,
            retrievedAt: z.string().datetime(),
            evidenceId: z.string().max(100),
          })
          .strict(),
      )
      .max(30),
  })
  .strict();
/** Read-only future resolver contract. No network fetching or claim verification is performed by schema validation. */
export async function resolveAgentProfile(id, { repository }) {
  const record = await repository.get(id);
  return record ? agentProfileV1.parse(record) : null;
}
