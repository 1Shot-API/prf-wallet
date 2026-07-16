import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  OwsInvalidRequestError,
  OwsNotAllowedError,
  OwsTimeoutError,
} from "../src/errors.ts";
import {
  SignerRpcClient,
  isSignerEventMessage,
} from "../src/rpc/client.ts";
import { API_VERSION } from "@1shotapi/ows-types";

const SIGNER_ORIGIN = "https://signer.example";

type MessageListener = (event: MessageEvent) => void;

function setupDomMocks() {
  const listeners = new Set<MessageListener>();
  const posted: Array<{ message: unknown; targetOrigin: string }> = [];
  const contentWindow = {} as Window;

  const iframe = {
    contentWindow,
  } as HTMLIFrameElement;

  globalThis.window = {
    addEventListener(type: string, listener: MessageListener) {
      if (type === "message") listeners.add(listener);
    },
    removeEventListener(type: string, listener: MessageListener) {
      if (type === "message") listeners.delete(listener);
    },
  } as unknown as Window;

  contentWindow.postMessage = (
    message: unknown,
    targetOrigin: string,
  ): void => {
    posted.push({ message, targetOrigin });
  };

  function dispatch(
    event: string,
    data: Record<string, unknown>,
    correlationId = "1",
    origin = SIGNER_ORIGIN,
    source: Window = contentWindow,
  ) {
    const payload = {
      v: API_VERSION,
      kind: "event" as const,
      event,
      correlationId,
      data,
    };
    for (const listener of listeners) {
      listener({
        origin,
        source,
        data: payload,
      } as MessageEvent);
    }
  }

  function emit(event: string, data: Record<string, unknown>, correlationId = "1") {
    dispatch(event, data, correlationId);
  }

  return { iframe, posted, emit, dispatch, contentWindow };
}

describe("SignerRpcClient", () => {
  afterEach(() => {
    // @ts-expect-error test cleanup
    delete globalThis.window;
  });

  it("posts correlated requests to the signer origin", async () => {
    const { iframe, posted, emit } = setupDomMocks();
    const client = new SignerRpcClient(iframe, SIGNER_ORIGIN, 5_000);

    const promise = client.request("getVersion", undefined, {
      terminalEvent: "Version",
    });

    assert.equal(posted.length, 1);
    assert.equal(posted[0]?.targetOrigin, SIGNER_ORIGIN);
    assert.deepEqual(posted[0]?.message, {
      v: 1,
      kind: "request",
      method: "getVersion",
      correlationId: "1",
      params: undefined,
    });

    emit("Version", {
      apiVersion: 1,
      signerVersion: "0.1.0",
      recoverySessionActive: false,
    });

    const result = await promise;
    assert.equal(result.signerVersion, "0.1.0");
    client.destroy();
  });

  it("rejects NotAllowed and InvalidRequest terminal errors", async () => {
    const { iframe, emit } = setupDomMocks();
    const client = new SignerRpcClient(iframe, SIGNER_ORIGIN, 5_000);

    const notAllowed = client.request("signDigest", { digestData: "0x" + "11".repeat(32) }, {
      terminalEvent: "DigestSigned",
    });
    emit("NotAllowed", { reason: "userCancelled" });
    await assert.rejects(notAllowed, OwsNotAllowedError);

    const invalid = client.request("getVersion", undefined, {
      terminalEvent: "Version",
    });
    emit("InvalidRequest", { reason: "badParams" }, "2");
    await assert.rejects(invalid, OwsInvalidRequestError);

    client.destroy();
  });

  it("times out when no terminal event arrives", async () => {
    const { iframe } = setupDomMocks();
    const client = new SignerRpcClient(iframe, SIGNER_ORIGIN, 20);

    await assert.rejects(
      client.request("getVersion", undefined, {
        terminalEvent: "Version",
        timeoutMs: 20,
      }),
      OwsTimeoutError,
    );

    client.destroy();
  });

  it("merges alsoWaitFor events after terminal PublicKey", async () => {
    const { iframe, emit } = setupDomMocks();
    const client = new SignerRpcClient(iframe, SIGNER_ORIGIN, 5_000);

    const promise = client.request("getPublicKey", { challenge: "0x" + "aa".repeat(32) }, {
      terminalEvent: "PublicKey",
      alsoWaitFor: ["ChallengeSigned"],
    });

    emit("PublicKey", {
      cosePublicKey: null,
      secp256k1PublicKey: "0x" + "04".repeat(32),
      ed25519PublicKey: "0x" + "05".repeat(32),
    });

    emit("ChallengeSigned", {
      challenge: "0x" + "aa".repeat(32),
      signature: "sig",
    });

    const result = await promise;
    assert.equal(result.signature, "sig");
    assert.match(String(result.secp256k1PublicKey), /^0x/);

    client.destroy();
  });

  it("ignores messages from wrong origin", async () => {
    const { iframe, dispatch, emit } = setupDomMocks();
    const client = new SignerRpcClient(iframe, SIGNER_ORIGIN, 5_000);

    const promise = client.request("getVersion", undefined, {
      terminalEvent: "Version",
    });

    dispatch(
      "Version",
      {
        apiVersion: 1,
        signerVersion: "evil",
        recoverySessionActive: false,
      },
      "1",
      "https://evil.example",
    );

    emit("Version", {
      apiVersion: 1,
      signerVersion: "good",
      recoverySessionActive: false,
    });

    const result = await promise;
    assert.equal(result.signerVersion, "good");
    client.destroy();
  });
});

describe("isSignerEventMessage", () => {
  it("validates event envelope shape", () => {
    assert.equal(
      isSignerEventMessage({
        v: 1,
        kind: "event",
        event: "Version",
        data: {},
      }),
      true,
    );
    assert.equal(isSignerEventMessage({ kind: "event" }), false);
  });
});
