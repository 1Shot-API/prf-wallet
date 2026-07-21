import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { OWSSigner } from "@1shotapi/ows-signer-utils";
import { OWSWallet, RpcHelper } from "@1shotapi/ows-wallet-utils";
import {
  EVMAccountAddress,
  EVMChainId,
  OwsUserRejectedError,
  SolanaAccountAddress,
  type CredentialOfferApprovalRequest,
  type CredentialPresentationApprovalRequest,
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
import { DEMO_CHAINS } from "../ows/demoChains";
import { registerAccountConnect } from "../ows/registerAccountConnect";
import { registerApprovalSigning } from "../ows/registerApprovalSigning";
import { registerCredentialsProvider } from "../ows/registerCredentialsProvider";
import {
  isWalletCreated,
  loadBackup,
  loadCachedEvmAddress,
  loadCachedSolanaAddress,
  loadCredentialId,
  saveBackup,
  saveCachedAddresses,
  saveWalletCreated,
} from "../storage";
import {
  nextModalId,
  type ActiveModal,
  type WalletSetupChoice,
} from "./modalTypes";

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

/**
 * Proxy that forwards to a real {@link OWSSigner} once `awaitSigner` resolves.
 * Register Postmate handlers with this so `wallet.start()` can run before the
 * nested Signing Layer iframe finishes loading (Postmate parents give up after
 * ~2.5s of handshake retries).
 */
function createDeferredSigner(
  awaitSigner: () => Promise<OWSSigner>,
): OWSSigner {
  let instance: OWSSigner | undefined;
  let loadError: unknown;
  void awaitSigner()
    .then((signer) => {
      instance = signer;
    })
    .catch((error: unknown) => {
      loadError = error;
      console.error(
        "[ows-example-general-wallet] deferred Signing Layer load failed",
        error,
      );
    });
  return new Proxy({} as OWSSigner, {
    get(_target, property) {
      // Avoid looking like a thenable if someone awaits the proxy.
      if (property === "then") {
        return undefined;
      }
      if (!instance) {
        if (loadError !== undefined) {
          throw loadError instanceof Error
            ? loadError
            : new Error(
                `Signing Layer failed to load: ${String(loadError)}`,
              );
        }
        throw new Error(
          "Signing Layer not ready — await ensureReady() before using the signer",
        );
      }
      const value = Reflect.get(instance, property, instance);
      return typeof value === "function"
        ? (value as (...args: unknown[]) => unknown).bind(instance)
        : value;
    },
  });
}

export type WalletContextValue = {
  ready: boolean;
  bootError: string | null;
  embedded: boolean;
  unlocked: boolean;
  walletCreated: boolean;
  evmAddress: EVMAccountAddress;
  solanaAddress: SolanaAccountAddress;
  chainId: EVMChainId;
  chains: typeof DEMO_CHAINS;
  credentialCount: number;
  activeModal: ActiveModal | null;
  signerContainerRef: RefObject<HTMLDivElement | null>;
  getSigner: () => OWSSigner | null;
  /** Resolves when the Signing Layer iframe has finished loading. */
  awaitSignerReady: () => Promise<OWSSigner>;
  /** Awaits Signing Layer load, then unlocks / runs setup if needed. */
  ensureReady: () => Promise<void>;
  setUnlocked: (value: boolean) => void;
  refreshAddresses: () => Promise<void>;
  refreshCredentialCount: () => Promise<void>;
  switchChain: (chainId: string) => Promise<void>;
  requestHide: () => Promise<void>;
  openCredentialList: () => Promise<void>;
  openCreateBackup: () => Promise<void>;
  openRestoreBackup: () => Promise<void>;
  loginWithPasskey: () => Promise<void>;
  createNewWalletFromUi: () => Promise<void>;
  persistBackup: (encryptedPrivateKey: string) => void;
};

const WalletContext = createContext<WalletContextValue | null>(null);

export function useWallet(): WalletContextValue {
  const value = useContext(WalletContext);
  if (!value) {
    throw new Error("useWallet must be used within WalletProvider");
  }
  return value;
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);
  const [unlocked, setUnlockedState] = useState(false);
  const [walletCreated, setWalletCreated] = useState(() => isWalletCreated());
  const [evmAddress, setEvmAddress] = useState<EVMAccountAddress>(
    () => loadCachedEvmAddress() ?? EVMAccountAddress("0x0"),
  );
  const [solanaAddress, setSolanaAddress] = useState<SolanaAccountAddress>(
    () => loadCachedSolanaAddress() ?? SolanaAccountAddress("—"),
  );
  const [chainId, setChainId] = useState<EVMChainId>(DEMO_CHAINS[0]!.chainId);
  const [credentialCount, setCredentialCount] = useState(0);
  const [activeModal, setActiveModal] = useState<ActiveModal | null>(null);
  const [embedded] = useState(() => window.parent !== window);

  const signerContainerRef = useRef<HTMLDivElement | null>(null);
  const walletRef = useRef<OWSWallet | null>(null);
  const signerRef = useRef<OWSSigner | null>(null);
  const rpcHelperRef = useRef<RpcHelper | null>(null);
  const unlockedRef = useRef(false);
  const unlockInFlightRef = useRef<Promise<void> | undefined>(undefined);
  const modalQueueRef = useRef<ActiveModal[]>([]);

  const advanceQueue = useCallback(() => {
    const next = modalQueueRef.current[0] ?? null;
    setActiveModal(next);
  }, []);

  const removeModal = useCallback(
    (id: string) => {
      modalQueueRef.current = modalQueueRef.current.filter((m) => m.id !== id);
      advanceQueue();
    },
    [advanceQueue],
  );

  const pushModal = useCallback(
    <T,>(
      build: (handlers: {
        id: string;
        resolve: (value: T) => void;
        reject: (error: unknown) => void;
      }) => ActiveModal,
    ): Promise<T> => {
      return new Promise<T>((resolve, reject) => {
        const id = nextModalId();
        let settled = false;
        const finishResolve = (value: T) => {
          if (settled) return;
          settled = true;
          removeModal(id);
          resolve(value);
        };
        const finishReject = (error: unknown) => {
          if (settled) return;
          settled = true;
          removeModal(id);
          reject(error);
        };
        const modal = build({
          id,
          resolve: finishResolve,
          reject: finishReject,
        });
        modalQueueRef.current.push(modal);
        setActiveModal((current) => current ?? modal);
      });
    },
    [removeModal],
  );

  const setUnlocked = useCallback((value: boolean) => {
    unlockedRef.current = value;
    setUnlockedState(value);
  }, []);

  const refreshAddresses = useCallback(async () => {
    const signer = signerRef.current;
    if (!signer) return;
    const evm = await signer.evm.getAccountAddress();
    const solana = await signer.solana.getAccountAddress();
    setEvmAddress(evm);
    setSolanaAddress(solana);
    saveCachedAddresses(evm, solana);
  }, []);

  const refreshCredentialCount = useCallback(async () => {
    const listed = await credentialRepository.list();
    setCredentialCount(listed.length);
  }, []);

  const promptPasskeyName = useCallback((): Promise<string | null> => {
    return pushModal<string | null>(({ id, resolve }) => ({
      id,
      kind: "passkeyName",
      resolve,
    }));
  }, [pushModal]);

  const requestWalletSetupChoice =
    useCallback((): Promise<WalletSetupChoice> => {
      return pushModal<WalletSetupChoice>(({ id, resolve }) => ({
        id,
        kind: "walletSetup",
        resolve,
      }));
    }, [pushModal]);

  const loginWithPasskey = useCallback(async () => {
    const signer = signerRef.current;
    if (!signer) throw new Error("Signer not ready");
    const result = await signer.getPublicKey({ discoverable: true });
    const credentialId = result.credentialId ?? signer.getCredentialId();
    if (!credentialId) {
      throw new Error("Passkey login succeeded but credential id missing");
    }
    saveWalletCreated(credentialId);
    setWalletCreated(true);
    await refreshAddresses();
    setUnlocked(true);
  }, [refreshAddresses, setUnlocked]);

  const createNewWallet = useCallback(
    async (accountName: string) => {
      const signer = signerRef.current;
      if (!signer) throw new Error("Signer not ready");
      await signer.createCredential(accountName, {
        rpName: "Open Wallet",
        userDisplayName: accountName,
      });
      const credentialId = signer.getCredentialId();
      if (!credentialId) {
        throw new Error("Passkey created but credential id missing");
      }
      saveWalletCreated(credentialId);
      setWalletCreated(true);
      await refreshAddresses();
      setUnlocked(true);
    },
    [refreshAddresses, setUnlocked],
  );

  const createNewWalletFromUi = useCallback(async () => {
    const name = await promptPasskeyName();
    if (!name) {
      throw new OwsUserRejectedError("User cancelled passkey creation");
    }
    await createNewWallet(name);
  }, [createNewWallet, promptPasskeyName]);

  const unlockWithStoredCredential = useCallback(async () => {
    const signer = signerRef.current;
    if (!signer) throw new Error("Signer not ready");
    const storedCredentialId = loadCredentialId();
    if (storedCredentialId) {
      const result = await signer.getPublicKey({
        credentialId: storedCredentialId,
      });
      const credentialId = result.credentialId ?? signer.getCredentialId();
      if (!credentialId) {
        throw new Error("Passkey unlock succeeded but credential id missing");
      }
      saveWalletCreated(credentialId);
      setWalletCreated(true);
      await refreshAddresses();
      setUnlocked(true);
      return;
    }
    await loginWithPasskey();
  }, [loginWithPasskey, refreshAddresses, setUnlocked]);

  const runSetupFlow = useCallback(async () => {
    const wallet = walletRef.current;
    if (!wallet) throw new Error("Wallet not ready");
    const display = await wallet.requestDisplay({ width: 420, height: 480 });
    try {
      const choice = await requestWalletSetupChoice();
      if (choice === "cancel") {
        throw new OwsUserRejectedError("User cancelled wallet setup");
      }
      if (choice === "login") {
        await loginWithPasskey();
        return;
      }
      await createNewWalletFromUi();
    } finally {
      await display.hide();
    }
  }, [createNewWalletFromUi, loginWithPasskey, requestWalletSetupChoice]);

  const ensureReadyImpl = useCallback(async () => {
    if (unlockedRef.current) {
      return;
    }
    if (unlockInFlightRef.current) {
      await unlockInFlightRef.current;
      return;
    }

    unlockInFlightRef.current = (async () => {
      if (isWalletCreated()) {
        await unlockWithStoredCredential();
        return;
      }
      await runSetupFlow();
    })();

    try {
      await unlockInFlightRef.current;
    } finally {
      unlockInFlightRef.current = undefined;
    }
  }, [runSetupFlow, unlockWithStoredCredential]);

  const ensureReadyRef = useRef(ensureReadyImpl);
  ensureReadyRef.current = ensureReadyImpl;

  /** Resolves once `OWSSigner.create` finishes; set during boot. */
  const awaitSignerRef = useRef<(() => Promise<OWSSigner>) | null>(null);

  /**
   * Stable forever: always reads {@link awaitSignerRef} / {@link ensureReadyRef}
   * so boot-time registrations (registerAccountConnect, SignHelper, …) never
   * capture a stale unlock implementation.
   */
  const awaitSignerReady = useCallback(async (): Promise<OWSSigner> => {
    const awaitSigner = awaitSignerRef.current;
    if (!awaitSigner) {
      throw new Error(
        "Signing Layer not started — wallet boot has not begun yet",
      );
    }
    return awaitSigner();
  }, []);

  const ensureReady = useCallback(async () => {
    const awaitSigner = awaitSignerRef.current;
    if (!awaitSigner) {
      throw new Error(
        "Signing Layer not started — wallet boot has not begun yet",
      );
    }
    await awaitSigner();
    await ensureReadyRef.current();
  }, []);

  /**
   * Signed-action gate: only run setup/login when no credential exists.
   * With a known credential, the signing ceremony itself unlocks.
   */
  const ensureOnboardedForSigning = useCallback(async () => {
    const awaitSigner = awaitSignerRef.current;
    if (!awaitSigner) {
      throw new Error(
        "Signing Layer not started — wallet boot has not begun yet",
      );
    }
    await awaitSigner();
    if (isWalletCreated()) {
      return;
    }
    await ensureReadyRef.current();
  }, []);

  const onSigningAuthenticated = useCallback(async () => {
    await refreshAddresses();
    setUnlocked(true);
  }, [refreshAddresses, setUnlocked]);

  const uiBridgeRef = useRef({
    pushModal,
  });
  uiBridgeRef.current.pushModal = pushModal;

  const switchChain = useCallback(async (next: string) => {
    const rpc = rpcHelperRef.current;
    if (!rpc) return;
    const previous = rpc.getChainId();
    try {
      await rpc.switchChain(next);
    } catch (error: unknown) {
      setChainId(previous);
      console.error("[ows-example-general-wallet] chain switch failed", error);
      throw error;
    }
  }, []);

  const requestHide = useCallback(async () => {
    await walletRef.current?.requestHide();
  }, []);

  const openCredentialList = useCallback(async () => {
    const listed = await credentialRepository.list();
    setCredentialCount(listed.length);
    await pushModal<void>(({ id, resolve }) => ({
      id,
      kind: "credentialList",
      credentials: listed,
      resolve,
    }));
  }, [pushModal]);

  const openCreateBackup = useCallback(async () => {
    const wallet = walletRef.current;
    if (!wallet) return;
    const display = await wallet.requestDisplay({ width: 480, height: 420 });
    try {
      await pushModal<void>(({ id, resolve, reject }) => ({
        id,
        kind: "createBackup",
        resolve,
        reject,
      }));
    } finally {
      await display.hide();
    }
  }, [pushModal]);

  const openRestoreBackup = useCallback(async () => {
    const encrypted = loadBackup();
    if (!encrypted) {
      window.alert("No backup found. Create a backup first.");
      return;
    }
    const wallet = walletRef.current;
    if (!wallet) return;
    const display = await wallet.requestDisplay({ width: 480, height: 420 });
    try {
      const restored = await pushModal<boolean>(({ id, resolve, reject }) => ({
        id,
        kind: "restoreBackup",
        encryptedPrivateKey: encrypted,
        resolve,
        reject,
      }));
      if (restored) {
        setUnlocked(true);
        setWalletCreated(true);
        await refreshAddresses();
      }
    } finally {
      await display.hide();
    }
  }, [pushModal, refreshAddresses, setUnlocked]);

  const persistBackup = useCallback((encryptedPrivateKey: string) => {
    saveBackup(encryptedPrivateKey);
  }, []);

  const getSigner = useCallback(() => signerRef.current, []);

  useEffect(() => {
    let cancelled = false;
    let onChainChanged: ((next: EVMChainId) => void) | undefined;

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
      ) => uiBridgeRef.current.pushModal(build);

      registerAccountConnect(wallet, signer, {
        storage: walletStorage,
        ensureReady,
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
      setChainId(rpcHelper.getChainId());
      onChainChanged = (next) => {
        setChainId(next);
      };
      rpcHelper.events.on("chainChanged", onChainChanged);

      registerApprovalSigning(wallet, signer, {
        ensureReady: ensureOnboardedForSigning,
        onAuthenticated: onSigningAuthenticated,
        chainRpc: rpcHelper,
        requestPersonalSignApproval: (request: PersonalSignApprovalRequest) =>
          ask<boolean>(({ id, resolve }) => ({
            id,
            kind: "personalSign",
            request,
            resolve,
          })),
        requestSignTypedDataApproval: (
          request: SignTypedDataApprovalRequest,
        ) =>
          ask<boolean>(({ id, resolve }) => ({
            id,
            kind: "typedData",
            request,
            resolve,
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
        ensureReady,
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
      setCredentialCount(listed.length);
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
      if (onChainChanged) {
        rpcHelperRef.current?.events.off("chainChanged", onChainChanged);
      }
    };
  }, []);

  const value = useMemo<WalletContextValue>(
    () => ({
      ready,
      bootError,
      embedded,
      unlocked,
      walletCreated,
      evmAddress,
      solanaAddress,
      chainId,
      chains: DEMO_CHAINS,
      credentialCount,
      activeModal,
      signerContainerRef,
      getSigner,
      awaitSignerReady,
      ensureReady,
      setUnlocked,
      refreshAddresses,
      refreshCredentialCount,
      switchChain,
      requestHide,
      openCredentialList,
      openCreateBackup,
      openRestoreBackup,
      loginWithPasskey,
      createNewWalletFromUi,
      persistBackup,
    }),
    [
      ready,
      bootError,
      embedded,
      unlocked,
      walletCreated,
      evmAddress,
      solanaAddress,
      chainId,
      credentialCount,
      activeModal,
      getSigner,
      awaitSignerReady,
      ensureReady,
      setUnlocked,
      refreshAddresses,
      refreshCredentialCount,
      switchChain,
      requestHide,
      openCredentialList,
      openCreateBackup,
      openRestoreBackup,
      loginWithPasskey,
      createNewWalletFromUi,
      persistBackup,
    ],
  );

  return (
    <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
  );
}
