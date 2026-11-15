import { z } from "zod";
export const uuid = z.string().uuid();
export const wallet = z.string().regex(/^0x[0-9a-fA-F]{40}$/);
export const https = z
  .string()
  .max(2048)
  .url()
  .refine((v) => {
    const u = new URL(v);
    return (
      u.protocol === "https:" &&
      !u.username &&
      !u.password &&
      !u.hash &&
      (!u.port || u.port === "443")
    );
  });
export const registryRef = z
  .object({
    chainId: z.union([z.literal(1), z.literal(84532)]),
    registryAddress: wallet,
    tokenId: z
      .string()
      .regex(/^\d{1,78}$/)
      .refine((v) => BigInt(v) < 2n ** 256n),
  })
  .strict();
export const serviceDeclaration = z
  .object({
    id: z.string().regex(/^[a-z0-9_-]{1,60}$/),
    name: z.string().trim().min(1).max(100),
    description: z.string().max(1000),
    endpoint: https,
    price: z
      .object({
        network: z.enum(["eip155:84532", "eip155:8453", "eip155:1"]),
        asset: wallet,
        amount: z
          .string()
          .regex(/^[1-9]\d{0,77}$/)
          .refine((v) => BigInt(v) < 2n ** 256n),
        payTo: wallet,
      })
      .strict()
      .nullable(),
  })
  .strict();
export const personalAgentFields = {
  agentController: wallet.optional(),
  services: z.array(serviceDeclaration).max(10).optional(),
  registration: registryRef.nullable().optional(),
  localOnly: z.boolean().optional(),
};
const linkBase = { id: uuid, revision: z.number().int().positive() };
export const identitySchemas = {
  "identity.link": z
    .object({
      id: uuid,
      agentId: uuid,
      agentRevision: z.number().int().positive(),
      controller: wallet,
    })
    .strict(),
  "identity.link.confirm": z.object(linkBase).strict(),
  "identity.link.refresh": z
    .object({ ...linkBase, agentRevision: z.number().int().positive() })
    .strict(),
  "identity.link.disconnect": z.object(linkBase).strict(),
  "identity.link.revoke": z.object(linkBase).strict(),
  "identity.verify.endpoint": z
    .object({ ...linkBase, endpointUrl: https })
    .strict(),
  "identity.verify.wallet": z
    .object({
      agentId: uuid,
      agentRevision: z.number().int().positive(),
      wallet,
      network: z.enum(["eip155:84532", "eip155:8453", "eip155:1"]),
    })
    .strict(),
  "identity.wallet.revoke": z
    .object({
      agentId: uuid,
      wallet,
      network: z.enum(["eip155:84532", "eip155:8453", "eip155:1"]),
      revision: z.number().int().positive(),
    })
    .strict(),
  "identity.verify.registration": z
    .object({ agentId: uuid, agentRevision: z.number().int().positive() })
    .strict(),
};
