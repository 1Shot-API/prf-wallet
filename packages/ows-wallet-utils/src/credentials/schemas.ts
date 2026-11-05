import { z } from "zod";
import {
  CredentialClaimNameSchema,
  CredentialConfigurationIdSchema,
  CredentialIdSchema,
  CredentialIssuerSchema,
  CredentialOfferUriSchema,
  CredentialTypeNameSchema,
  PresentationRequestUriSchema,
  UriStringSchema,
} from "@1shotapi/ows-types";

const credentialOfferSchema = z.object({
  credentialIssuer: CredentialIssuerSchema,
  credentialConfigurationIds: z.array(CredentialConfigurationIdSchema),
  grants: z.record(z.string(), z.unknown()).optional(),
});

export const acceptOfferParamsSchema = z
  .object({
    credentialOfferUri: CredentialOfferUriSchema.optional(),
    offer: credentialOfferSchema.optional(),
  })
  .refine((v) => v.credentialOfferUri !== undefined || v.offer !== undefined, {
    message: "credentialOfferUri or offer is required",
  });

export const presentParamsSchema = z
  .object({
    requestUri: PresentationRequestUriSchema.optional(),
    request: z
      .object({
        id: z.string(),
        verifier: z.object({
          id: UriStringSchema,
          name: z.string(),
        }),
        requestedClaims: z.array(CredentialClaimNameSchema),
        credentialTypes: z.array(CredentialTypeNameSchema).optional(),
        nonce: z.string().optional(),
        audience: z.string().optional(),
      })
      .optional(),
    acceptedIssuers: z.array(CredentialIssuerSchema).optional(),
  })
  .refine((v) => v.requestUri !== undefined || v.request !== undefined, {
    message: "requestUri or request is required",
  });

export const listParamsSchema = z
  .object({
    type: CredentialTypeNameSchema.optional(),
    issuer: CredentialIssuerSchema.optional(),
  })
  .optional();

export const deleteParamsSchema = z.object({
  credentialId: CredentialIdSchema,
});

export const CREDENTIAL_PARAM_SCHEMAS = {
  acceptOffer: acceptOfferParamsSchema,
  present: presentParamsSchema,
  list: listParamsSchema,
  delete: deleteParamsSchema,
} as const;
