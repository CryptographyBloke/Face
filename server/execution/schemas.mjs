import { z } from "zod";
import { ApiError } from "../validation.mjs";
export const categories = [
  "governance",
  "security",
  "onchain",
  "developer",
  "data",
  "content",
  "identity",
];
export const runInput = z
  .object({
    id: z.string().uuid(),
    serviceId: z.string().min(1).max(80),
    task: z.string().min(1).max(3000),
    language: z.enum(["zh", "en"]).default("en"),
    arguments: z.record(z.string(), z.unknown()).default({}),
    retainResult: z.literal(true),
  })
  .strict();
export const approvalInput = z
  .object({
    approved: z.literal(true),
    planHash: z.string().regex(/^0x[0-9a-f]{64}$/),
  })
  .strict();
export const serviceInput = z
  .object({
    id: z.string().uuid(),
    agentId: z.string().uuid(),
    agentRevision: z.number().int().positive(),
    revision: z.number().int().nonnegative(),
    name: z.string().min(1).max(100),
    description: z.string().max(2000),
    category: z.enum(categories),
    protocol: z.enum(["mcp", "a2a"]),
    endpointUrl: z.string().url().max(2048),
    capability: z.string().min(1).max(100),
    inputSchema: z.record(z.string(), z.unknown()),
    published: z.boolean(),
    paused: z.boolean(),
    price: z
      .object({
        network: z.literal("eip155:84532"),
        asset: z.literal("0x036CbD53842c5426634e7929541eC2318f3dCF7e"),
        amount: z.string().regex(/^[1-9][0-9]{0,17}$/),
        payTo: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
      })
      .strict()
      .nullable(),
  })
  .strict();
// Deliberately bounded JSON Schema subset. No executable regex, remote refs or
// combinator expansion is accepted from an untrusted service description.
const allowed = new Set([
  "type",
  "properties",
  "required",
  "additionalProperties",
  "items",
  "enum",
  "const",
  "minLength",
  "maxLength",
  "minimum",
  "maximum",
  "minItems",
  "maxItems",
  "description",
  "title",
  "$schema",
  "default",
]);
export function checkSchema(schema, depth = 0) {
  if (
    !schema ||
    typeof schema !== "object" ||
    Array.isArray(schema) ||
    depth > 6 ||
    JSON.stringify(schema).length > 12000
  )
    throw new ApiError(
      422,
      "CAPABILITY_SCHEMA",
      "Unsupported or excessive capability schema",
    );
  if (Object.keys(schema).some((k) => !allowed.has(k)))
    throw new ApiError(
      422,
      "CAPABILITY_SCHEMA",
      "Capability schema uses unsupported validation keywords",
    );
  if (
    ![
      "object",
      "array",
      "string",
      "integer",
      "number",
      "boolean",
      "null",
    ].includes(schema.type)
  )
    throw new ApiError(
      422,
      "CAPABILITY_SCHEMA",
      "An explicit JSON type is required",
    );
  if (schema.enum && (!Array.isArray(schema.enum) || schema.enum.length > 30))
    throw new ApiError(422, "CAPABILITY_SCHEMA", "Invalid enum");
  for (const key of [
    "minLength",
    "maxLength",
    "minItems",
    "maxItems",
    "minimum",
    "maximum",
  ])
    if (
      schema[key] !== undefined &&
      (!Number.isFinite(schema[key]) || Math.abs(schema[key]) > 1e12)
    )
      throw new ApiError(422, "CAPABILITY_SCHEMA", "Invalid schema bound");
  if (schema.type === "object") {
    const p = schema.properties || {};
    if (Object.keys(p).length > 30 || schema.additionalProperties !== false)
      throw new ApiError(
        422,
        "CAPABILITY_SCHEMA",
        "Object capabilities must forbid extra fields",
      );
    if (
      schema.required &&
      (!Array.isArray(schema.required) ||
        schema.required.some(
          (k) => typeof k !== "string" || !Object.hasOwn(p, k),
        ))
    )
      throw new ApiError(422, "CAPABILITY_SCHEMA", "Invalid required fields");
    for (const [k, v] of Object.entries(p)) {
      if (["__proto__", "constructor", "prototype"].includes(k))
        throw new ApiError(422, "CAPABILITY_SCHEMA", "Reserved property");
      checkSchema(v, depth + 1);
    }
  } else if (schema.type === "array") checkSchema(schema.items, depth + 1);
  return schema;
}
export function validateArguments(schema, value, depth = 0) {
  if (depth === 0) checkSchema(schema);
  const fail = () => {
    throw new ApiError(
      422,
      "TOOL_ARGUMENTS",
      "Arguments do not match the reviewed capability schema",
    );
  };
  if (schema.type === "null") {
    if (value !== null) fail();
  } else if (schema.type === "array") {
    if (
      !Array.isArray(value) ||
      value.length > 50 ||
      value.length < (schema.minItems || 0) ||
      value.length > (schema.maxItems ?? 50)
    )
      fail();
    for (const v of value) validateArguments(schema.items, v, depth + 1);
  } else if (schema.type === "object") {
    if (!value || typeof value !== "object" || Array.isArray(value)) fail();
    for (const k of schema.required || []) if (!Object.hasOwn(value, k)) fail();
    for (const [k, v] of Object.entries(value)) {
      if (!Object.hasOwn(schema.properties || {}, k)) fail();
      validateArguments(schema.properties[k], v, depth + 1);
    }
  } else if (schema.type === "string") {
    if (
      typeof value !== "string" ||
      value.length > 4000 ||
      value.length < (schema.minLength || 0) ||
      value.length > (schema.maxLength ?? 4000)
    )
      fail();
  } else if (schema.type === "boolean") {
    if (typeof value !== "boolean") fail();
  } else if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    (schema.type === "integer" && !Number.isSafeInteger(value)) ||
    value < (schema.minimum ?? -Infinity) ||
    value > (schema.maximum ?? Infinity)
  )
    fail();
  if (
    schema.enum &&
    !schema.enum.some((v) => JSON.stringify(v) === JSON.stringify(value))
  )
    fail();
  if (
    Object.hasOwn(schema, "const") &&
    JSON.stringify(schema.const) !== JSON.stringify(value)
  )
    fail();
  return value;
}
