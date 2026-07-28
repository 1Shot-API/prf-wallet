import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import { OWSSigner } from "@1shotapi/ows-signer-utils";
import { OWSWallet, type RpcHelper } from "@1shotapi/ows-wallet-utils";
import {
  EVMAccountAddress,
  EVMChainId,
  OwsUserRejectedError,
  SolanaAccountAddress,
} from "@1shotapi/ows-types";
import type { LocalStorageCredentialRepository } from "@ows-shared";
import {
  isWalletCreated,
  loadBackup,
  loadCredentialId,
  saveBackup,
  saveCachedAddresses,
  saveWalletCreated,
} from "../storage";
import type { ActiveModal, WalletSetupChoice } from "./modalTypes";

type PushModal = <T>(
  build: (handlers: {
    id: string;
    resolve: (value: T) => void;
    reject: (error: unknown) => void;
  }) => ActiveModal,
) => Promise<T>;

type UseWalletSessionArgs = {
  signerRef: RefObject<OWSSigner | null>;
  walletRef: RefObject<OWSWallet | null>;
  rpcHelperRef: RefObject<RpcHelper | null>;
  awaitSignerRef: RefObject<(() => Promise<OWSSigner>) | null>;
  pushModal: PushModal;
  credentialRepository: LocalStorageCredentialRepository;
  setEvmAddress: (value: EVMAccountAddress) => void;
  setSolanaAddress: (value: SolanaAccountAddress) => void;
  setCredentialCount: (value: number) => void;
  setWalletCreated: (value: boolean) => void;
  setChainId: (value: EVMChainId) => void;
};

export function useWalletSession({
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
}: UseWalletSessionArgs) {
  const unlockedRef = useRef(false);
  const unlockInFlightRef = useRef<Promise<void> | undefined>(undefined);
  const [unlocked, setUnlockedState] = useState(false);

  const setUnlocked = useCallback((value: boolean) => {
    unlockedRef.current = value;
    setUnlockedState(value);
  }, []);

  const refreshAddresses = useCallback(async () => {
    const signer = signerRef.current;
    if (!signer) return;
    const [evm, solana] = await Promise.all([
      signer.evm.getAccountAddress(),
      signer.solana.getAccountAddress(),
    ]);
    setEvmAddress(evm);
    setSolanaAddress(solana);
    saveCachedAddresses(evm, solana);
  }, [setEvmAddress, setSolanaAddress, signerRef]);

  const refreshCredentialCount = useCallback(async () => {
    const listed = await credentialRepository.list();
    setCredentialCount(listed.length);
  }, [credentialRepository, setCredentialCount]);

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
  }, [refreshAddresses, setUnlocked, setWalletCreated, signerRef]);

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
    [refreshAddresses, setUnlocked, setWalletCreated, signerRef],
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
  }, [
    loginWithPasskey,
    refreshAddresses,
    setUnlocked,
    setWalletCreated,
    signerRef,
  ]);

  const runSetupFlow = useCallback(async () => {
    const wallet = walletRef.current;
    if (!wallet) throw new Error("Wallet not ready");
    const display = await wallet.requestDisplay();
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
  }, [
    createNewWalletFromUi,
    loginWithPasskey,
    requestWalletSetupChoice,
    walletRef,
  ]);

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
  useEffect(() => {
    ensureReadyRef.current = ensureReadyImpl;
  }, [ensureReadyImpl]);

  const awaitSignerReady = useCallback(async (): Promise<OWSSigner> => {
    const awaitSigner = awaitSignerRef.current;
    if (!awaitSigner) {
      throw new Error(
        "Signing Layer not started — wallet boot has not begun yet",
      );
    }
    return awaitSigner();
  }, [awaitSignerRef]);

  const ensureReady = useCallback(async () => {
    const awaitSigner = awaitSignerRef.current;
    if (!awaitSigner) {
      throw new Error(
        "Signing Layer not started — wallet boot has not begun yet",
      );
    }
    await awaitSigner();
    await ensureReadyRef.current();
  }, [awaitSignerRef]);

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
  }, [awaitSignerRef]);

  const onSigningAuthenticated = useCallback(async () => {
    await refreshAddresses();
    setUnlocked(true);
  }, [refreshAddresses, setUnlocked]);

  const switchChain = useCallback(
    async (next: string) => {
      const rpc = rpcHelperRef.current;
      if (!rpc) return;
      const previous = rpc.getChainId();
      try {
        await rpc.switchChain(next);
      } catch (error: unknown) {
        setChainId(previous);
        console.error(
          "[ows-example-general-wallet] chain switch failed",
          error,
        );
        throw error;
      }
    },
    [rpcHelperRef, setChainId],
  );

  const requestHide = useCallback(async () => {
    await walletRef.current?.requestHide();
  }, [walletRef]);

  const openCredentialList = useCallback(async () => {
    const listed = await credentialRepository.list();
    setCredentialCount(listed.length);
    await pushModal<void>(({ id, resolve }) => ({
      id,
      kind: "credentialList",
      credentials: listed,
      resolve,
    }));
  }, [credentialRepository, pushModal, setCredentialCount]);

  const openCreateBackup = useCallback(async () => {
    const wallet = walletRef.current;
    if (!wallet) return;
    const display = await wallet.requestDisplay();
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
  }, [pushModal, walletRef]);

  const openRestoreBackup = useCallback(async () => {
    const encrypted = loadBackup();
    if (!encrypted) {
      window.alert("No backup found. Create a backup first.");
      return;
    }
    const wallet = walletRef.current;
    if (!wallet) return;
    const display = await wallet.requestDisplay();
    try {
      const restored = await pushModal<boolean>(({ id, resolve }) => ({
        id,
        kind: "restoreBackup",
        encryptedPrivateKey: encrypted,
        resolve,
      }));
      if (restored) {
        setUnlocked(true);
        setWalletCreated(true);
        await refreshAddresses();
      }
    } finally {
      await display.hide();
    }
  }, [pushModal, refreshAddresses, setUnlocked, setWalletCreated, walletRef]);

  const persistBackup = useCallback((encryptedPrivateKey: string) => {
    saveBackup(encryptedPrivateKey);
  }, []);

  return {
    unlocked,
    setUnlocked,
    refreshAddresses,
    refreshCredentialCount,
    loginWithPasskey,
    createNewWalletFromUi,
    ensureReady,
    ensureOnboardedForSigning,
    onSigningAuthenticated,
    awaitSignerReady,
    switchChain,
    requestHide,
    openCredentialList,
    openCreateBackup,
    openRestoreBackup,
    persistBackup,
  };
}
