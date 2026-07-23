import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { OWSSigner } from "@1shotapi/ows-signer-utils";
import { OWSWallet, type RpcHelper } from "@1shotapi/ows-wallet-utils";
import {
  EVMAccountAddress,
  EVMChainId,
  SolanaAccountAddress,
} from "@1shotapi/ows-types";
import { DEMO_CHAINS } from "../ows/demoChains";
import {
  isWalletCreated,
  loadCachedEvmAddress,
  loadCachedSolanaAddress,
} from "../storage";
import type { ActiveModal } from "./modalTypes";
import { useModalQueue } from "./useModalQueue";
import { credentialRepository, useWalletBoot } from "./useWalletBoot";
import { useWalletSession } from "./useWalletSession";

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
  const [walletCreated, setWalletCreated] = useState(() => isWalletCreated());
  const [evmAddress, setEvmAddress] = useState<EVMAccountAddress>(
    () => loadCachedEvmAddress() ?? EVMAccountAddress("0x0"),
  );
  const [solanaAddress, setSolanaAddress] = useState<SolanaAccountAddress>(
    () => loadCachedSolanaAddress() ?? SolanaAccountAddress("—"),
  );
  const [chainId, setChainId] = useState<EVMChainId>(DEMO_CHAINS[0]!.chainId);
  const [credentialCount, setCredentialCount] = useState(0);
  const [embedded] = useState(() => window.parent !== window);

  const signerContainerRef = useRef<HTMLDivElement | null>(null);
  const walletRef = useRef<OWSWallet | null>(null);
  const signerRef = useRef<OWSSigner | null>(null);
  const rpcHelperRef = useRef<RpcHelper | null>(null);
  const awaitSignerRef = useRef<(() => Promise<OWSSigner>) | null>(null);

  const { activeModal, pushModal } = useModalQueue();

  const session = useWalletSession({
    signerRef,
    walletRef,
    rpcHelperRef,
    awaitSignerRef,
    pushModal,
    credentialRepository,
    setEvmAddress,
    setSolanaAddress,
    setCredentialCount,
    setWalletCreated,
    setChainId,
  });

  const { ready, bootError } = useWalletBoot({
    signerContainerRef,
    walletRef,
    signerRef,
    rpcHelperRef,
    awaitSignerRef,
    pushModal,
    ensureReady: session.ensureReady,
    ensureOnboardedForSigning: session.ensureOnboardedForSigning,
    onSigningAuthenticated: session.onSigningAuthenticated,
    setChainId,
    setCredentialCount,
  });

  const getSigner = useCallback(() => signerRef.current, []);

  const value = useMemo<WalletContextValue>(
    () => ({
      ready,
      bootError,
      embedded,
      unlocked: session.unlocked,
      walletCreated,
      evmAddress,
      solanaAddress,
      chainId,
      chains: DEMO_CHAINS,
      credentialCount,
      activeModal,
      signerContainerRef,
      getSigner,
      awaitSignerReady: session.awaitSignerReady,
      ensureReady: session.ensureReady,
      setUnlocked: session.setUnlocked,
      refreshAddresses: session.refreshAddresses,
      refreshCredentialCount: session.refreshCredentialCount,
      switchChain: session.switchChain,
      requestHide: session.requestHide,
      openCredentialList: session.openCredentialList,
      openCreateBackup: session.openCreateBackup,
      openRestoreBackup: session.openRestoreBackup,
      loginWithPasskey: session.loginWithPasskey,
      createNewWalletFromUi: session.createNewWalletFromUi,
      persistBackup: session.persistBackup,
    }),
    [
      ready,
      bootError,
      embedded,
      session,
      walletCreated,
      evmAddress,
      solanaAddress,
      chainId,
      credentialCount,
      activeModal,
      getSigner,
    ],
  );

  return (
    <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
  );
}
