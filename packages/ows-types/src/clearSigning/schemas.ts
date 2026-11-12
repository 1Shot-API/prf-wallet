import { z } from "zod";
import { EClearSigningFieldFormatSchema } from "../enums/EClearSigningFieldFormat.js";
import { EClearSigningIterationSchema } from "../enums/EClearSigningIteration.js";
import { EClearSigningVisibilitySchema } from "../enums/EClearSigningVisibility.js";
import { ClearSigningRegistryShaSchema } from "../primitives/ClearSigningRegistrySha.js";
import { EVMChainIdSchema } from "../primitives/EVMChainId.js";
import { EVMContractAddressSchema } from "../primitives/EVMContractAddress.js";
import { HexStringSchema } from "../primitives/HexString.js";
import type {
  ClearSigningLookupResult,
  IClearSigningField,
} from "./types.js";

/** Registry deployments carry decimal chain ids; brand them as hex {@link EVMChainId}. */
const DeploymentSchema = z.object({
  chainId: z
    .union([z.number().int().positive(), z.string().regex(/^[0-9]+$/)])
    .transform((n) => `0x${BigInt(n).toString(16)}`)
    .pipe(EVMChainIdSchema),
  address: EVMContractAddressSchema,
});

const VisibilitySchema = z.union([
  EClearSigningVisibilitySchema,
  z.object({
    ifNotIn: z.array(z.unknown()).optional(),
    mustMatch: z.array(z.unknown()).optional(),
  }),
]);

const FieldSchema: z.ZodType<IClearSigningField> = z.lazy(() =>
  z.object({
    path: z.string().optional(),
    value: z.unknown().optional(),
    label: z.string().optional(),
    format: EClearSigningFieldFormatSchema.optional(),
    params: z.record(z.string(), z.unknown()).optional(),
    visible: VisibilitySchema.optional(),
    separator: z.string().optional(),
    encryption: z
      .object({
        scheme: z.string(),
        plaintextType: z.string().optional(),
        fallbackLabel: z.string().optional(),
      })
      .optional(),
    fields: z.array(FieldSchema).optional(),
    iteration: EClearSigningIterationSchema.optional(),
  }),
) as z.ZodType<IClearSigningField>;

/** Zod schema for a Relayer-resolved ERC-7730 descriptor (untrusted network input). */
export const ClearSigningDescriptorSchema = z.object({
  context: z.object({
    contract: z
      .object({ deployments: z.array(DeploymentSchema) })
      .optional(),
    eip712: z
      .object({
        domain: z.record(z.string(), z.unknown()).optional(),
        deployments: z.array(DeploymentSchema).optional(),
        domainSeparator: HexStringSchema.optional(),
      })
      .optional(),
  }),
  metadata: z.object({
    owner: z.string().optional(),
    contractName: z.string().optional(),
    info: z
      .object({
        url: z.string().optional(),
        deploymentDate: z.string().optional(),
      })
      .optional(),
    token: z
      .object({
        name: z.string().optional(),
        ticker: z.string().optional(),
        decimals: z.number().int().nonnegative().optional(),
      })
      .optional(),
    constants: z.record(z.string(), z.unknown()).optional(),
    maps: z
      .record(
        z.string(),
        z.object({ values: z.record(z.string(), z.unknown()) }),
      )
      .optional(),
    enums: z.record(z.string(), z.record(z.string(), z.string())).optional(),
  }),
  format: z.object({
    key: z.string().min(3),
    intent: z.union([z.string(), z.record(z.string(), z.string())]),
    interpolatedIntent: z.string().optional(),
    fields: z.array(FieldSchema),
  }),
});

/** Zod schema for the Relayer `GET /clear-signing/*` response body. */
export const ClearSigningLookupResultSchema: z.ZodType<ClearSigningLookupResult> =
  z.discriminatedUnion("found", [
    z.object({
      found: z.literal(true),
      registrySha: ClearSigningRegistryShaSchema,
      path: z.string(),
      descriptor: ClearSigningDescriptorSchema,
    }),
    z.object({ found: z.literal(false) }),
  ]) as z.ZodType<ClearSigningLookupResult>;
