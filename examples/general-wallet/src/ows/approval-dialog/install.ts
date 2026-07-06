import type {
  BrandingContext,
  BrandingModule,
  BrandingSignerHost,
  PersonalSignApprovalRequest,
  SignTypedDataApprovalRequest,
  SignTypedDataPayload,
} from "@1shotapi/ows-branding-core";
import { EVMAccountAddress, OwsUserRejectedError } from "@1shotapi/ows-types";
import {
  requestPersonalSignApproval,
  requestSignTypedDataApproval,
} from "./dialog";

type SignTypedDataInput = Parameters<
  BrandingSignerHost["evm"]["signTypedData"]
>[0];

export type ApprovalDialogModuleOptions = {
  /** Override dialog mount target. */
  container?: HTMLElement;
};

const TYPED_DATA_METHODS = [
  "eth_signTypedData",
  "eth_signTypedData_v3",
  "eth_signTypedData_v4",
] as const;

/**
 * Registers EIP-191 `personal_sign` and EIP-712 typed-data approval dialogs.
 * Transaction signing is intentionally omitted (broadcast / monitoring TBD).
 */
export function createApprovalDialogModule(
  options?: ApprovalDialogModuleOptions,
): BrandingModule {
  return {
    name: "approval-dialog",
    phase: "pre-start",
    install(ctx: BrandingContext): void {
      const requestPersonalApproval =
        ctx.ui?.requestPersonalSignApproval ??
        ((request: PersonalSignApprovalRequest) =>
          requestPersonalSignApproval(request, {
            container: options?.container,
          }));

      const requestTypedDataApproval =
        ctx.ui?.requestSignTypedDataApproval ??
        ((request: SignTypedDataApprovalRequest) =>
          requestSignTypedDataApproval(request, {
            container: options?.container,
          }));

      ctx.wallet.registerEip1193("personal_sign", async (params) => {
        const [message, addressParam] = params as [string, string];
        const address = EVMAccountAddress(addressParam as `0x${string}`);

        return withSigningApproval(ctx, { width: 448, height: 360 }, async () => {
          const approved = await requestPersonalApproval({ message, address });
          if (!approved) {
            throw new OwsUserRejectedError("User rejected the signing request");
          }
          return ctx.signer.evm.signMessage({ message });
        });
      });

      for (const method of TYPED_DATA_METHODS) {
        ctx.wallet.registerEip1193(method, async (params) => {
          const [addressParam, typedDataParam] = params as [
            string,
            SignTypedDataPayload | string,
          ];
          const address = EVMAccountAddress(addressParam as `0x${string}`);
          const typedData = parseTypedData(typedDataParam);

          return withSigningApproval(
            ctx,
            { width: 448, height: 520 },
            async () => {
              const approved = await requestTypedDataApproval({
                address,
                typedData,
              });
              if (!approved) {
                throw new OwsUserRejectedError(
                  "User rejected the signing request",
                );
              }
              return ctx.signer.evm.signTypedData(
                typedData as unknown as SignTypedDataInput,
              );
            },
          );
        });
      }
    },
  };
}

async function withSigningApproval<T>(
  ctx: BrandingContext,
  size: { width: number; height: number },
  run: () => Promise<T>,
): Promise<T> {
  if (ctx.ensureReady) {
    await ctx.ensureReady();
  }

  const display = await ctx.wallet.requestDisplay(size);
  try {
    return await run();
  } finally {
    await display.hide();
  }
}

function parseTypedData(
  value: SignTypedDataPayload | string,
): SignTypedDataPayload {
  if (typeof value === "string") {
    return JSON.parse(value) as SignTypedDataPayload;
  }
  return value;
}

/** Default export for registry `install.ts` convention. */
export const approvalDialogModule = createApprovalDialogModule();

/** @deprecated Use {@link approvalDialogModule}. */
export const personalSignApprovalModule = approvalDialogModule;

/** @deprecated Use {@link createApprovalDialogModule}. */
export const createPersonalSignApprovalModule = createApprovalDialogModule;
