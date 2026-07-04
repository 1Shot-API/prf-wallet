import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { hashMessage } from "viem";
import { OWSSigner } from "../src/owssigner.ts";
import { API_VERSION } from "../src/rpc/types.ts";

const SIGNER_ORIGIN = "https://signer.example";
const SIGNER_URL = `${SIGNER_ORIGIN}/signer.html`;

type MessageListener = (event: MessageEvent) => void;

function setupBrowserMocks() {
  const listeners = new Set<MessageListener>();
  const contentWindow = {} as Window;

  const iframe = {
    contentWindow,
    style: {} as CSSStyleDeclaration,
    remove() {},
    addEventListener(
      type: string,
      listener: EventListenerOrEventListenerObject,
      options?: boolean | AddEventListenerOptions,
    ) {
      if (type === "load") {
        const once = typeof options === "object" && options.once;
        const handler = typeof listener === "function" ? listener : listener.handleEvent;
        queueMicrotask(() => {
          handler.call(iframe, new Event("load"));
          if (once) {
            iframe.removeEventListener(type, listener);
          }
        });
      }
    },
    removeEventListener() {},
  } as unknown as HTMLIFrameElement;

  globalThis.document = {
    createElement(tag: string) {
      assert.equal(tag, "iframe");
      return iframe;
    },
  } as unknown as Document;

  globalThis.window = {
    addEventListener(type: string, listener: MessageListener) {
      if (type === "message") listeners.add(listener);
    },
    removeEventListener(type: string, listener: MessageListener) {
      if (type === "message") listeners.delete(listener);
    },
  } as unknown as Window;

  contentWindow.postMessage = (message: { method?: string; correlationId?: string }) => {
    const id = message.correlationId ?? "0";
    const method = message.method;

    if (method === "getVersion") {
      reply("Version", {
        apiVersion: 1,
        signerVersion: "test-signer",
        recoverySessionActive: false,
      }, id);
      return;
    }

    if (method === "signDigest") {
      reply("DigestSigned", {
        digest: "0x" + "22".repeat(32),
        scheme: "secp256k1-ecdsa-recoverable",
        signature: "0x" + "33".repeat(65),
        credentialId: "cred-1",
      }, id);
      return;
    }

    if (method === "getPublicKey") {
      reply("PublicKey", {
        passkeyPublicKey: null,
        secp256k1PublicKey:
          "0x04" +
          "79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8",
        ed25519PublicKey: "0x" + "55".repeat(32),
      }, id);
    }
  };

  function reply(
    event: string,
    data: Record<string, unknown>,
    correlationId: string,
  ) {
    const payload = {
      v: API_VERSION,
      kind: "event" as const,
      event,
      correlationId,
      data,
    };
    queueMicrotask(() => {
      for (const listener of listeners) {
        listener({
          origin: SIGNER_ORIGIN,
          source: contentWindow,
          data: payload,
        } as MessageEvent);
      }
    });
  }

  const container = {
    appendChild(node: Node) {
      assert.equal(node, iframe);
    },
  } as unknown as HTMLElement;

  return { container, iframe };
}

describe("OWSSigner", () => {
  afterEach(() => {
    // @ts-expect-error test cleanup
    delete globalThis.window;
    // @ts-expect-error test cleanup
    delete globalThis.document;
  });

  it("creates via factory and calls getVersion", async () => {
    const { container } = setupBrowserMocks();
    const signer = await OWSSigner.create(container, SIGNER_URL);

    const version = await signer.getVersion();
    assert.equal(version.signerVersion, "test-signer");
    assert.equal(version.recoverySessionActive, false);

    signer.destroy();
  });

  it("signDigest and evm.signMessage delegate to RPC", async () => {
    const { container } = setupBrowserMocks();
    const signer = await OWSSigner.create(container, SIGNER_URL, {
      credentialId: "cred-1",
    });

    const digestResult = await signer.signDigest(hashMessage("hi"));
    assert.equal(digestResult.scheme, "secp256k1-ecdsa-recoverable");
    assert.match(digestResult.signature, /^0x/);

    const signature = await signer.evm.signMessage({ message: "hi" });
    assert.match(signature, /^0x/);

    signer.destroy();
  });

  it("caches EVM and Solana addresses from getPublicKey", async () => {
    const { container } = setupBrowserMocks();
    const signer = await OWSSigner.create(container, SIGNER_URL, {
      credentialId: "cred-1",
    });

    const evm = await signer.evm.getAccountAddress();
    assert.match(evm, /^0x[0-9a-f]{40}$/i);
    assert.equal(signer.getCachedAddress(), evm);

    const solana = await signer.solana.getAccountAddress();
    assert.equal(signer.getCachedSolanaAddress(), solana);

    signer.destroy();
  });
});
