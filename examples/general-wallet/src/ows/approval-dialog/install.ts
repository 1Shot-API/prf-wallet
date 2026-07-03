import type {
  BrandingContext,
  BrandingModule,
  PersonalSignApprovalRequest,
} from "@1shotapi/ows-branding-core";
import { EVMAccountAddress, OwsUserRejectedError } from "@1shotapi/ows-types";
import { requestPersonalSignApproval } from "./dialog";

export type PersonalSignApprovalModuleOptions = {
  /** Override dialog mount target. */
  container?: HTMLElement;
};

export function createPersonalSignApprovalModule(
  options?: PersonalSignApprovalModuleOptions,
): BrandingModule {
  return {
    name: "approval-dialog",
    phase: "pre-start",
    install(ctx: BrandingContext): void {
      const requestApproval =
        ctx.ui?.requestPersonalSignApproval ??
        ((request: PersonalSignApprovalRequest) =>
          requestPersonalSignApproval(request, {
            container: options?.container,
          }));

      ctx.wallet.registerEip1193("personal_sign", async (params) => {
        const [message, addressParam] = params as [string, string];
        const address = EVMAccountAddress(addressParam as `0x${string}`);

        if (ctx.ensureReady) {
          await ctx.ensureReady();
        }

        const display = await ctx.wallet.requestDisplay({
          width: 448,
          height: 360,
        });
        try {
          const approved = await requestApproval({ message, address });
          if (!approved) {
            throw new OwsUserRejectedError("User rejected the signing request");
          }

          return ctx.signer.evm.signMessage({ message });
        } finally {
          await display.hide();
        }
      });
    },
  };
}

/** Default export for registry `install.ts` convention. */
export const personalSignApprovalModule = createPersonalSignApprovalModule();
