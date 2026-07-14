import {
  EVMAccountAddress,
  OwsUserRejectedError,
  type RequestDisplayParams,
} from "@1shotapi/ows-types";
import type { TypedDataDefinition } from "viem";
import type {
  PersonalSignApprovalRequest,
  SignTypedDataApprovalRequest,
  SignTypedDataPayload,
} from "./approval-types.js";

/** EIP-1193 handler shape (matches `OWSWallet.registerEip1193`). */
export type Eip1193Handler = (params: unknown[]) => Promise<unknown>;

export type SignHelperDisplaySession = {
  hide(): Promise<void>;
};

/** Wallet surface used to show the branding iframe during consent / signing. */
export type SignHelperWallet = {
  requestDisplay(
    params: RequestDisplayParams,
  ): Promise<SignHelperDisplaySession>;
};

/** Minimal EVM signing surface (`OWSSigner.evm` subset). */
export type SignHelperSigner = {
  evm: {
    signMessage(args: { message: string }): Promise<string>;
    signTypedData(
      typedData: TypedDataDefinition,
      options?: { credentialId?: string },
    ): Promise<string>;
  };
};

export type SignHelperDisplaySize = {
  width: number;
  height: number;
};

export type SignHelperOptions = {
  /** Run before signing (e.g. passkey unlock / onboarding). */
  ensureReady?: () => Promise<void>;
  /** Consent UI for EIP-191 personal_sign. */
  requestPersonalSignApproval: (
    request: PersonalSignApprovalRequest,
  ) => Promise<boolean>;
  /** Consent UI for EIP-712 typed data. */
  requestSignTypedDataApproval: (
    request: SignTypedDataApprovalRequest,
  ) => Promise<boolean>;
  /** Flyout size for personal_sign (default 448×360). */
  personalSignDisplaySize?: SignHelperDisplaySize;
  /** Flyout size for typed data (default 448×520). */
  typedDataDisplaySize?: SignHelperDisplaySize;
};

export type Eip1193SignHandlers = {
  personal_sign: Eip1193Handler;
  eth_signTypedData: Eip1193Handler;
  eth_signTypedData_v3: Eip1193Handler;
  eth_signTypedData_v4: Eip1193Handler;
};

const DEFAULT_PERSONAL_SIGN_SIZE: SignHelperDisplaySize = {
  width: 448,
  height: 360,
};
const DEFAULT_TYPED_DATA_SIZE: SignHelperDisplaySize = {
  width: 448,
  height: 520,
};

/**
 * Headless EIP-1193 personal_sign / typed-data wiring: display → consent →
 * ensureReady → sign. Does **not** register handlers — the branding app calls
 * `wallet.registerEip1193` in the order it wants.
 *
 * Transaction signing is intentionally omitted (broadcast / monitoring TBD).
 */
export class SignHelper {
  readonly handlers: Eip1193SignHandlers;

  constructor(
    private readonly signer: SignHelperSigner,
    private readonly wallet: SignHelperWallet,
    private readonly options: SignHelperOptions,
  ) {
    const typedData: Eip1193Handler = (params) => this.handleTypedData(params);
    this.handlers = {
      personal_sign: (params) => this.handlePersonalSign(params),
      eth_signTypedData: typedData,
      eth_signTypedData_v3: typedData,
      eth_signTypedData_v4: typedData,
    };
  }

  private async handlePersonalSign(params: unknown[]): Promise<string> {
    const [message, addressParam] = params as [string, string];
    const address = EVMAccountAddress(addressParam as `0x${string}`);
    const size =
      this.options.personalSignDisplaySize ?? DEFAULT_PERSONAL_SIGN_SIZE;

    return this.withDisplay(size, async () => {
      const approved = await this.options.requestPersonalSignApproval({
        message,
        address,
      });
      if (!approved) {
        throw new OwsUserRejectedError("User rejected the signing request");
      }
      if (this.options.ensureReady) {
        await this.options.ensureReady();
      }
      return this.signer.evm.signMessage({ message });
    });
  }

  private async handleTypedData(params: unknown[]): Promise<string> {
    const [addressParam, typedDataParam] = params as [
      string,
      SignTypedDataPayload | string,
    ];
    const address = EVMAccountAddress(addressParam as `0x${string}`);
    const typedData = parseTypedData(typedDataParam);
    const size =
      this.options.typedDataDisplaySize ?? DEFAULT_TYPED_DATA_SIZE;

    return this.withDisplay(size, async () => {
      const approved = await this.options.requestSignTypedDataApproval({
        address,
        typedData,
      });
      if (!approved) {
        throw new OwsUserRejectedError("User rejected the signing request");
      }
      if (this.options.ensureReady) {
        await this.options.ensureReady();
      }
      return this.signer.evm.signTypedData(
        typedData as unknown as TypedDataDefinition,
      );
    });
  }

  private async withDisplay<T>(
    size: SignHelperDisplaySize,
    run: () => Promise<T>,
  ): Promise<T> {
    const display = await this.wallet.requestDisplay(size);
    try {
      return await run();
    } finally {
      await display.hide();
    }
  }
}

export function parseTypedData(
  value: SignTypedDataPayload | string,
): SignTypedDataPayload {
  if (typeof value === "string") {
    return JSON.parse(value) as SignTypedDataPayload;
  }
  return value;
}
