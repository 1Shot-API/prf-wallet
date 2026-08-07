import {
  useEffect,
  useEffectEvent,
  useState,
  type RefObject,
} from "react";
import { OWSSigner } from "@1shotapi/ows-signer-utils";
import { OWSWallet, RpcHelper } from "@1shotapi/ows-wallet-utils";
import {
  EVMChainId,
  type CredentialOfferApprovalRequest,
  type CredentialPresentationApprovalRequest,
  type EVMSignatureHex,
} from "@1shotapi/ows-types";
import type {
  PersonalSignApprovalRequest,
  SendTransactionApprovalRequest,
  SignTypedDataApprovalRequest,
} from "@1shotapi/ows-signer-utils";
import {
  LocalStorageCredentialRepository,
  InMemoryIssuerTrustRegistry,
  DEMO_HOLDER_PRIVATE_JWK,
} from "@ows-shared";
import {
  DemoWalletAttestationProvider,
  FetchUtils,
  HttpOid4vciClient,
  HttpOid4vpClient,
  ParseUtils,
} from "@1shotapi/ows-oid4";
import { PersonalSignEvent } from "../analytics/events";
import { resolveHostDomain } from "../analytics/hostDomain";
import { DEMO_CHAINS } from "../ows/demoChains";
import { registerAccountConnect } from "../ows/registerAccountConnect";
import { registerApprovalSigning } from "../ows/registerApprovalSigning";
import { registerCredentialsProvider } from "../ows/registerCredentialsProvider";
import {
  isWalletCreated,
  loadCachedEvmAddress,
  loadCredentialId,
  saveCachedAddresses,
  saveWalletCreated,
} from "../storage";
import { createDeferredSigner } from "./deferredSigner";
import type { ActiveModal } from "./modalTypes";

const credentialRepository = new LocalStorageCredentialRepository();
const issuerTrust = new InMemoryIssuerTrustRegistry();
const fetchUtils = new FetchUtils();
const parseUtils = new ParseUtils();
const oid4vci = new HttpOid4vciClient(fetchUtils, parseUtils);
const oid4vp = new HttpOid4vpClient(fetchUtils);
const attestationProvider = new DemoWalletAttestationProvider({
  privateJwk: DEMO_HOLDER_PRIVATE_JWK,
  issuer: "ows-demo-wallet",
});

const walletStorage = {
  isWalletCreated,
  loadCredentialId,
  saveWalletCreated,
  saveCachedAddresses,
  loadCachedEvmAddress,
};

export { credentialRepository };

type PushModal = <T>(
  build: (handlers: {
    id: string;
    resolve: (value: T) => void;
    reject: (error: unknown) => void;
  }) => ActiveModal,
) => Promise<T>;

type UseWalletBootArgs = {
  signerContainerRef: RefObject<HTMLDivElement | null>;
  walletRef: RefObject<OWSWallet | null>;
  signerRef: RefObject<OWSSigner | null>;
  rpcHelperRef: RefObject<RpcHelper | null>;
  awaitSignerRef: RefObject<(() => Promise<OWSSigner>) | null>;
  pushModal: PushModal;
  ensureReady: () => Promise<void>;
  ensureOnboardedForSigning: () => Promise<void>;
  onSigningAuthenticated: () => Promise<void>;
  setChainId: (value: EVMChainId) => void;
  setCredentialCount: (value: number) => void;
};

export function useWalletBoot({
  signerContainerRef,
  walletRef,
  signerRef,
  rpcHelperRef,
  awaitSignerRef,
  pushModal,
  ensureReady,
  ensureOnboardedForSigning,
  onSigningAuthenticated,
  setChainId,
  setCredentialCount,
}: UseWalletBootArgs): { ready: boolean; bootError: string | null } {
  const [ready, setReady] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);

  // Always call the latest session callbacks from mount-only boot registrations.
  const askModal = useEffectEvent(pushModal);
  const runEnsureReady = useEffectEvent(ensureReady);
  const runEnsureOnboarded = useEffectEvent(ensureOnboardedForSigning);
  const runOnAuthenticated = useEffectEvent(onSigningAuthenticated);
  const syncChainId = useEffectEvent(setChainId);
  const syncCredentialCount = useEffectEvent(setCredentialCount);

  useEffect(() => {
    let cancelled = false;

    async function boot(): Promise<void> {
      // Wait a tick so SignerHost has committed the ref.
      await Promise.resolve();
      const container = signerContainerRef.current;
      if (!container) {
        throw new Error("#signer-container not mounted");
      }

      // Kick off Signing Layer load without blocking the host Postmate handshake.
      // Postmate parents only retry ~5 times (~2.5s after iframe load); awaiting
      // the nested /signer/ iframe (especially over ngrok) exceeds that window.
      const signerUrl = new URL("/signer/", window.location.origin).href;
      const signerPromise = OWSSigner.create(container, signerUrl, {
        hidden: true,
        credentialId: loadCredentialId(),
      });
      const awaitSigner = async (): Promise<OWSSigner> => {
        const loaded = await signerPromise;
        signerRef.current = loaded;
        return loaded;
      };
      awaitSignerRef.current = awaitSigner;
      // Handlers close over this proxy; they must call ensureReady (awaits signer)
      // before touching signing APIs.
      const signer = createDeferredSigner(awaitSigner);

      const wallet = OWSWallet.prepare({ debug: true });
      walletRef.current = wallet;

      const ask = <T,>(
        build: (handlers: {
          id: string;
          resolve: (value: T) => void;
          reject: (error: unknown) => void;
        }) => ActiveModal,
      ) => askModal(build);

      registerAccountConnect(wallet, signer, {
        storage: walletStorage,
        ensureReady: () => runEnsureReady(),
        requestConnectApproval: () =>
          ask<boolean>(({ id, resolve }) => ({
            id,
            kind: "connect",
            resolve,
          })),
      });

      const defaultChainId = DEMO_CHAINS[0]!.chainId;
      const rpcHelper = new RpcHelper(
        new Map(DEMO_CHAINS.map((chain) => [chain.chainId, chain.rpcUrl])),
        wallet,
        signer,
        { defaultChainId },
      );
      rpcHelperRef.current = rpcHelper;
      syncChainId(rpcHelper.getChainId());

      registerApprovalSigning(wallet, signer, {
        ensureReady: () => runEnsureOnboarded(),
        onAuthenticated: () => runOnAuthenticated(),
        chainRpc: rpcHelper,
        approveAndSignPersonalMessage: async (
          request: PersonalSignApprovalRequest,
        ) => {
          const started = performance.now();
          const signature = await ask<EVMSignatureHex>(
            ({ id, resolve, reject }) => ({
              id,
              kind: "personalSign",
              request,
              resolve,
              reject,
            }),
          );
          wallet.analytics.emit(
            new PersonalSignEvent(
              resolveHostDomain(),
              request.address,
              request.message.length,
              Math.round(performance.now() - started),
            ),
          );
          return signature;
        },
        approveAndSignTypedData: (request: SignTypedDataApprovalRequest) =>
          ask(({ id, resolve, reject }) => ({
            id,
            kind: "typedData",
            request,
            resolve,
            reject,
          })),
        requestSendTransactionApproval: (
          request: SendTransactionApprovalRequest,
        ) =>
          ask<boolean>(({ id, resolve }) => ({
            id,
            kind: "sendTransaction",
            request,
            resolve,
          })),
      });

      registerCredentialsProvider(wallet, signer, {
        repository: credentialRepository,
        oid4vci,
        oid4vp,
        trust: issuerTrust,
        attestationProvider,
        ensureReady: () => runEnsureReady(),
        requestCredentialOfferApproval: (
          request: CredentialOfferApprovalRequest,
        ) =>
          ask<boolean>(({ id, resolve }) => ({
            id,
            kind: "credentialOffer",
            request,
            resolve,
          })),
        requestCredentialPresentationApproval: (
          request: CredentialPresentationApprovalRequest,
        ) =>
          ask<boolean>(({ id, resolve }) => ({
            id,
            kind: "credentialPresentation",
            request,
            resolve,
          })),
      });

      // Register Postmate.Model immediately — before nested signer iframe load.
      void wallet.start().catch((error: unknown) => {
        if (cancelled) return;
        console.error(
          "[ows-example-general-wallet] Postmate handshake failed",
          error,
        );
        setBootError(error instanceof Error ? error.message : String(error));
      });

      // Finish Signing Layer init in the background; UI can paint meanwhile.
      void awaitSigner().catch((error: unknown) => {
        if (cancelled) return;
        console.error(
          "[ows-example-general-wallet] Signing Layer failed to load",
          error,
        );
        setBootError(error instanceof Error ? error.message : String(error));
      });

      // Paint UI without awaiting host handshake — standalone /wallet/ has no parent.
      const listed = await credentialRepository.list();
      if (cancelled) return;
      syncCredentialCount(listed.length);
      setReady(true);
      console.info("[ows-example-general-wallet] ready", {
        chainId: rpcHelper.getChainId(),
      });
    }

    void boot().catch((error: unknown) => {
      console.error("[ows-example-general-wallet] failed to start", error);
      setBootError(error instanceof Error ? error.message : String(error));
    });

    return () => {
      cancelled = true;
    };
  }, [
    awaitSignerRef,
    rpcHelperRef,
    signerContainerRef,
    signerRef,
    walletRef,
  ]);

  // Subscribe after boot sets rpcHelper — top-level effect so cleanup is obvious.
  useEffect(() => {
    if (!ready) return;
    const rpc = rpcHelperRef.current;
    if (!rpc) return;
    const handleChainChanged = (next: EVMChainId) => {
      syncChainId(next);
      walletRef.current?.providerEvents.emit("chainChanged", next);
    };
    rpc.events.on("chainChanged", handleChainChanged);
    return () => {
      rpc.events.off("chainChanged", handleChainChanged);
    };
  }, [ready, rpcHelperRef, walletRef]);

  return { ready, bootError };
}
