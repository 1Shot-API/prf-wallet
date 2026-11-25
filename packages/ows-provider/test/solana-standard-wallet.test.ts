import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { base58 } from "@scure/base";
import { ConversionUtils } from "@1shotapi/ows-types";
import { SolanaSignMessage } from "@solana/wallet-standard-features";
import type { WalletAccount } from "@wallet-standard/base";
import { SolanaHostClient } from "../src/solana/SolanaHostClient.ts";
import { OwsSolanaStandardWallet } from "../src/solana/standard-wallet.ts";

const SYSTEM_PROGRAM = "11111111111111111111111111111111";
const FAKE_SIG = base58.encode(new Uint8Array(64).fill(7));

function mockRpc(
  handler: (method: string, params: unknown) => unknown,
): { request: <T>(method: string, params: unknown) => Promise<T> } {
  return {
    request: async <T>(method: string, params: unknown): Promise<T> =>
      handler(method, params) as T,
  };
}

describe("OwsSolanaStandardWallet", () => {
  it("connect populates accounts from getAccountAddress", async () => {
    const client = {
      getAccountAddress: async () => SYSTEM_PROGRAM,
      signMessage: async () => ({ signatures: [] }),
      signTransaction: async () => ({ signatures: [] }),
      signAndSendTransaction: async () => ({ signature: FAKE_SIG }),
      signIn: async () => ({
        account: SYSTEM_PROGRAM,
        signedMessage: ConversionUtils.bytesToBase64(
          new TextEncoder().encode("hi"),
        ),
        signature: FAKE_SIG,
      }),
    };

    const wallet = new OwsSolanaStandardWallet(client as never);
    assert.equal(wallet.accounts.length, 0);

    const accountLengths: number[] = [];
    wallet.features["standard:events"].on("change", ({ accounts }) => {
      accountLengths.push(accounts?.length ?? -1);
    });

    const { accounts } = await wallet.features["standard:connect"].connect();
    assert.equal(accounts.length, 1);
    assert.equal(accounts[0]?.address, SYSTEM_PROGRAM);
    assert.equal(accounts[0]?.publicKey.length, 32);
    assert.equal(wallet.accounts.length, 1);
    assert.deepEqual(accountLengths, [1]);

    await wallet.features["standard:disconnect"].disconnect();
    assert.equal(wallet.accounts.length, 0);
    assert.deepEqual(accountLengths, [1, 0]);
  });

  it("signMessage base64-encodes wire payloads and decodes signatures", async () => {
    const message = new TextEncoder().encode("hello solana");
    const sent: unknown[] = [];
    const client = {
      getAccountAddress: async () => SYSTEM_PROGRAM,
      signMessage: async (params: { messages: string[] }) => {
        sent.push(params);
        return { signatures: [FAKE_SIG] };
      },
      signTransaction: async () => ({ signatures: [] }),
      signAndSendTransaction: async () => ({ signature: FAKE_SIG }),
      signIn: async () => {
        throw new Error("unused");
      },
    };

    const wallet = new OwsSolanaStandardWallet(client as never);
    const account = (
      await wallet.features["standard:connect"].connect()
    ).accounts[0] as WalletAccount;

    const [out] = await wallet.features[SolanaSignMessage].signMessage({
      account,
      message,
    });

    assert.deepEqual(sent[0], {
      messages: [ConversionUtils.bytesToBase64(message)],
    });
    assert.deepEqual(out?.signedMessage, message);
    assert.deepEqual(out?.signature, base58.decode(FAKE_SIG));
    assert.equal(out?.signatureType, "ed25519");
  });
});

describe("SolanaHostClient.registerSolanaWallet", () => {
  it("dispatches wallet-standard:register-wallet (idempotent)", () => {
    const g = globalThis as typeof globalThis & {
      window?: Window & typeof globalThis;
    };
    const previous = g.window;

    const listeners = new Map<string, Set<EventListener>>();
    const fakeWindow = {
      dispatchEvent(event: Event): boolean {
        const set = listeners.get(event.type);
        if (set) {
          for (const listener of set) {
            listener(event);
          }
        }
        return true;
      },
      addEventListener(type: string, listener: EventListener): void {
        if (!listeners.has(type)) listeners.set(type, new Set());
        listeners.get(type)!.add(listener);
      },
      removeEventListener(type: string, listener: EventListener): void {
        listeners.get(type)?.delete(listener);
      },
    } as unknown as Window & typeof globalThis;
    g.window = fakeWindow;

    try {
      let registerCalls = 0;
      fakeWindow.addEventListener(
        "wallet-standard:register-wallet",
        ((event: Event) => {
          const detail = (event as { detail: (api: unknown) => void }).detail;
          detail({
            register: () => {
              registerCalls += 1;
              return () => {
                registerCalls -= 1;
              };
            },
          });
        }) as EventListener,
      );

      const client = new SolanaHostClient(
        mockRpc(() => SYSTEM_PROGRAM) as never,
      );
      client.registerSolanaWallet();
      assert.equal(registerCalls, 1);

      client.registerSolanaWallet();
      assert.equal(registerCalls, 1, "second register is idempotent");

      client.unregisterSolanaWallet();
      assert.equal(registerCalls, 0);
    } finally {
      if (previous === undefined) {
        Reflect.deleteProperty(g, "window");
      } else {
        g.window = previous;
      }
    }
  });
});
