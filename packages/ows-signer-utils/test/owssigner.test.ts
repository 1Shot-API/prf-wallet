import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { hashMessage } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { OWSSigner } from "../src/owssigner.ts";
import { API_VERSION } from "@1shotapi/ows-types";

const SIGNER_ORIGIN = "https://signer.example";
const SIGNER_URL = `${SIGNER_ORIGIN}/signer.html`;

/** secp256k1 generator point G (uncompressed). */
const SECP_KEY_A =
  ("0x04" +
    "79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798" +
    "483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8") as `0x${string}`;

/** secp256k1 private key 0x02 → distinct address from G. */
const ACCOUNT_B = privateKeyToAccount(
  ("0x" + "02".repeat(32)) as `0x${string}`,
);
const SECP_KEY_B = ACCOUNT_B.publicKey;

const ED25519_KEY_A = ("0x" + "55".repeat(32)) as `0x${string}`;
const ED25519_KEY_B = ("0x" + "66".repeat(32)) as `0x${string}`;

type MessageListener = (event: MessageEvent) => void;

type PublicKeyPayload = {
  cosePublicKey: null;
  secp256k1PublicKey: `0x${string}`;
  ed25519PublicKey: `0x${string}`;
  credentialId?: string;
};

type SetupOptions = {
  /** When set, getPublicKey does not auto-reply — tests drive events via reply(). */
  holdGetPublicKey?: boolean;
  publicKeyQueue?: PublicKeyPayload[];
};

function setupBrowserMocks(options: SetupOptions = {}) {
  const listeners = new Set<MessageListener>();
  const contentWindow = {} as Window;
  const publicKeyQueue = [...(options.publicKeyQueue ?? [])];
  let lastCorrelationId = "0";

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
        const handler =
          typeof listener === "function" ? listener : listener.handleEvent;
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

  function reply(
    event: string,
    data: Record<string, unknown>,
    correlationId: string = lastCorrelationId,
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

  contentWindow.postMessage = (message: {
    method?: string;
    correlationId?: string;
    kind?: string;
  }) => {
    if (message.kind === "cancel") return;

    const id = message.correlationId ?? "0";
    lastCorrelationId = id;
    const method = message.method;

    if (method === "getVersion") {
      reply(
        "Version",
        {
          apiVersion: 1,
          signerVersion: "test-signer",
          recoverySessionActive: false,
        },
        id,
      );
      return;
    }

    if (method === "signDigest") {
      // yParity=1 (not 27/28) — EvmSigner must canonicalize for ecrecover.
      reply(
        "DigestSigned",
        {
          results: [
            {
              digest: "0x" + "22".repeat(32),
              scheme: "secp256k1-ecdsa-recoverable",
              signature: ("0x" + "33".repeat(64) + "01") as `0x${string}`,
              credentialId: "cred-1",
            },
          ],
        },
        id,
      );
      return;
    }

    if (method === "executeBatch") {
      reply(
        "BatchExecuted",
        {
          results: [
            {
              digest: "0x" + "22".repeat(32),
              scheme: "secp256k1-ecdsa-recoverable",
              signature: ("0x" + "33".repeat(64) + "01") as `0x${string}`,
              credentialId: "cred-1",
            },
          ],
          ciphertexts: ["ows-aes1:0xdead"],
        },
        id,
      );
      return;
    }

    if (method === "getPublicKey") {
      if (options.holdGetPublicKey) {
        return;
      }
      const next = publicKeyQueue.shift() ?? {
        cosePublicKey: null,
        secp256k1PublicKey: SECP_KEY_A,
        ed25519PublicKey: ED25519_KEY_A,
      };
      reply("KeyDerived", {
        secp256k1PublicKey: next.secp256k1PublicKey,
        ed25519PublicKey: next.ed25519PublicKey,
      }, id);
      reply("PublicKey", next, id);
    }
  };

  const container = {
    appendChild(node: Node) {
      assert.equal(node, iframe);
    },
  } as unknown as HTMLElement;

  return { container, iframe, reply, getLastCorrelationId: () => lastCorrelationId };
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

    const digestResults = await signer.signDigest([
      { digestData: hashMessage("hi") },
    ]);
    assert.equal(digestResults.length, 1);
    assert.equal(digestResults[0]!.scheme, "secp256k1-ecdsa-recoverable");
    assert.equal(digestResults[0]!.signature.slice(-2), "01");

    const [signature] = await signer.evm.signMessage(["hi"]);
    assert.equal(signature!.slice(-2), "1c");

    signer.destroy();
  });

  it("executeBatch delegates to RPC", async () => {
    const { container } = setupBrowserMocks();
    const signer = await OWSSigner.create(container, SIGNER_URL, {
      credentialId: "cred-1",
    });

    const batch = await signer.executeBatch({
      digests: [
        {
          digestData: hashMessage("hi"),
          scheme: "secp256k1-ecdsa-recoverable",
        },
      ],
      plaintexts: ["secret"],
    });
    assert.equal(batch.results?.length, 1);
    assert.equal(batch.ciphertexts?.length, 1);

    signer.destroy();
  });

  it("caches EVM, Solana, and Bitcoin addresses from getPublicKey", async () => {
    const { container } = setupBrowserMocks();
    const signer = await OWSSigner.create(container, SIGNER_URL, {
      credentialId: "cred-1",
    });

    const evm = await signer.evm.getAccountAddress();
    assert.match(evm, /^0x[0-9a-f]{40}$/i);
    assert.equal(signer.getCachedAddress(), evm);

    const solana = await signer.solana.getAccountAddress();
    assert.equal(signer.getCachedSolanaAddress(), solana);

    const btcMainnet = await signer.bitcoin.getAccountAddress();
    assert.ok(btcMainnet.startsWith("bc1q"));
    assert.equal(signer.getCachedBitcoinSegwitAddress(), btcMainnet);

    signer.destroy();
  });

  it("overwrites address caches when getPublicKey returns different keys", async () => {
    const { container } = setupBrowserMocks({
      publicKeyQueue: [
        {
          cosePublicKey: null,
          secp256k1PublicKey: SECP_KEY_A,
          ed25519PublicKey: ED25519_KEY_A,
          credentialId: "cred-a",
        },
        {
          cosePublicKey: null,
          secp256k1PublicKey: SECP_KEY_B,
          ed25519PublicKey: ED25519_KEY_B,
          credentialId: "cred-b",
        },
      ],
    });
    const signer = await OWSSigner.create(container, SIGNER_URL);

    const first = await signer.getPublicKey({ discoverable: true });
    const evmA = signer.getCachedAddress();
    const solanaA = signer.getCachedSolanaAddress();
    assert.ok(evmA);
    assert.ok(solanaA);
    assert.equal(first.credentialId, "cred-a");

    const second = await signer.getPublicKey({ discoverable: true });
    const evmB = signer.getCachedAddress();
    const solanaB = signer.getCachedSolanaAddress();
    assert.equal(second.credentialId, "cred-b");
    assert.notEqual(evmB, evmA);
    assert.notEqual(solanaB, solanaA);
    assert.equal(
      (await signer.evm.getAccountAddress()).toLowerCase(),
      ACCOUNT_B.address.toLowerCase(),
    );

    signer.destroy();
  });

  it("clearSession rejects pending RPCs so late KeyDerived cannot refill cache", async () => {
    const { container, reply, getLastCorrelationId } = setupBrowserMocks({
      holdGetPublicKey: true,
    });
    const signer = await OWSSigner.create(container, SIGNER_URL, {
      credentialId: "cred-old",
    });

    const pending = signer.getPublicKey({ credentialId: "cred-old" });
    const oldId = getLastCorrelationId();

    signer.clearSession();
    await assert.rejects(pending, /session cleared/);

    // Late KeyDerived for the abandoned correlation id must be ignored.
    reply(
      "KeyDerived",
      {
        secp256k1PublicKey: SECP_KEY_A,
        ed25519PublicKey: ED25519_KEY_A,
      },
      oldId,
    );
    await new Promise((r) => queueMicrotask(r));
    assert.equal(signer.getCachedAddress(), undefined);

    // Fresh login with a different passkey wins (still held — drive events).
    const login = signer.getPublicKey({ discoverable: true });
    const newId = getLastCorrelationId();
    reply(
      "KeyDerived",
      {
        secp256k1PublicKey: SECP_KEY_B,
        ed25519PublicKey: ED25519_KEY_B,
      },
      newId,
    );
    reply(
      "PublicKey",
      {
        cosePublicKey: null,
        secp256k1PublicKey: SECP_KEY_B,
        ed25519PublicKey: ED25519_KEY_B,
        credentialId: "cred-b",
      },
      newId,
    );
    await login;

    assert.equal(
      signer.getCachedAddress()?.toLowerCase(),
      ACCOUNT_B.address.toLowerCase(),
    );
    assert.equal(signer.getCredentialId(), "cred-b");

    signer.destroy();
  });
});
