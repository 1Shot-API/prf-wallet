import { z } from "zod";
import {
  CredentialClaimName,
  CredentialConfigurationId,
  CredentialId,
  CredentialIssuer,
  CredentialOfferUri,
  CredentialTypeName,
  PresentationRequestUri,
  UriString,
} from "@1shotapi/ows-types";

const credentialOfferSchema = z.object({
  credentialIssuer: z.string().transform(CredentialIssuer),
  credentialConfigurationIds: z
    .array(z.string())
    .transform((ids) => ids.map(CredentialConfigurationId)),
  grants: z.record(z.string(), z.unknown()).optional(),
});

export const acceptOfferParamsSchema = z
  .object({
    credentialOfferUri: z.string().transform(CredentialOfferUri).optional(),
    offer: credentialOfferSchema.optional(),
  })
  .refine((v) => v.credentialOfferUri !== undefined || v.offer !== undefined, {
    message: "credentialOfferUri or offer is required",
  });

export const presentParamsSchema = z
  .object({
    requestUri: z.string().transform(PresentationRequestUri).optional(),
    request: z
      .object({
        id: z.string(),
        verifier: z.object({
          id: z.string().transform(UriString),
          name: z.string(),
        }),
        requestedClaims: z
          .array(z.string())
          .transform((claims) => claims.map(CredentialClaimName)),
        credentialTypes: z
          .array(z.string())
          .transform((types) => types.map(CredentialTypeName))
          .optional(),
        nonce: z.string().optional(),
        audience: z.string().optional(),
      })
      .optional(),
    acceptedIssuers: z
      .array(z.string())
      .transform((ids) => ids.map(CredentialIssuer))
      .optional(),
  })
  .refine((v) => v.requestUri !== undefined || v.request !== undefined, {
    message: "requestUri or request is required",
  });

export const listParamsSchema = z
  .object({
    type: z.string().transform(CredentialTypeName).optional(),
    issuer: z.string().transform(CredentialIssuer).optional(),
  })
  .optional();

export const deleteParamsSchema = z.object({
  credentialId: z.string().transform(CredentialId),
});

export const CREDENTIAL_PARAM_SCHEMAS = {
  acceptOffer: acceptOfferParamsSchema,
  present: presentParamsSchema,
  list: listParamsSchema,
  delete: deleteParamsSchema,
} as const;
