import { OWSProxy } from "@1shotapi/ows-provider";
import {
  EVMAccountAddress,
  EVMChainId,
  HexString,
  EVMTransactionHash,
} from "@1shotapi/ows-types";
import {
  createPublicClient,
  custom,
  encodeFunctionData,
  erc20Abi,
  formatUnits,
  getAddress,
  isAddress,
  parseUnits,
  type Address,
  type Hex,
} from "viem";
import "./styles.css";

const USDC_DECIMALS = 6;

const HOST_CHAINS = [
  {
    chainId: EVMChainId("0xaa36a7"),
    label: "Sepolia",
    usdc: EVMAccountAddress("0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238"),
    blockExplorerUrl: "https://sepolia.etherscan.io",
  },
  {
    chainId: EVMChainId("0x14a34"),
    label: "Base Sepolia",
    usdc: EVMAccountAddress("0x036CbD53842c5426634e7929541eC2318f3dCF7e"),
    blockExplorerUrl: "https://sepolia.basescan.org",
  },
  {
    chainId: EVMChainId("0x4cef52"),
    label: "Arc Testnet",
    usdc: EVMAccountAddress("0x3600000000000000000000000000000000000000"),
    blockExplorerUrl: "https://testnet.arcscan.app",
  },
] as const;

type UsdcMode = "balance" | "send";

const messageInput = document.getElementById("message-input") as HTMLTextAreaElement;
const signButton = document.getElementById("sign-button") as HTMLButtonElement;
const showWalletButton = document.getElementById(
  "show-wallet-button",
) as HTMLButtonElement;
const chainSelect = document.getElementById("chain-select") as HTMLSelectElement;
const chainRefreshButton = document.getElementById(
  "chain-refresh-button",
) as HTMLButtonElement;
const usdcModeSelect = document.getElementById(
  "usdc-mode-select",
) as HTMLSelectElement;
const usdcContractEl = document.getElementById("usdc-contract") as HTMLParagraphElement;
const usdcSendFields = document.getElementById("usdc-send-fields") as HTMLDivElement;
const usdcDestinationInput = document.getElementById(
  "usdc-destination-input",
) as HTMLInputElement;
const usdcAmountInput = document.getElementById(
  "usdc-amount-input",
) as HTMLInputElement;
const usdcActionButton = document.getElementById(
  "usdc-action-button",
) as HTMLButtonElement;
const usdcOutput = document.getElementById("usdc-output") as HTMLPreElement;
const usdcTxLink = document.getElementById("usdc-tx-link") as HTMLParagraphElement;
const statusEl = document.getElementById("status") as HTMLParagraphElement;
const signatureOutput = document.getElementById("signature-output") as HTMLPreElement;
const walletContainer = document.getElementById("wallet-container")!;

function setStatus(message: string, isError = false): void {
  statusEl.textContent = message;
  statusEl.classList.toggle("status--error", isError);
}

function normalizeChainIdHex(value: string): EVMChainId {
  return EVMChainId(`0x${BigInt(value).toString(16)}`);
}

function chainMeta(chainId: EVMChainId) {
  return HOST_CHAINS.find((chain) => chain.chainId === chainId) ?? null;
}

function setChainSelectValue(chainId: EVMChainId): void {
  const value = String(chainId);
  if ([...chainSelect.options].some((option) => option.value === value)) {
    chainSelect.value = value;
    return;
  }
  const option = document.createElement("option");
  option.value = value;
  option.textContent = value;
  chainSelect.append(option);
  chainSelect.value = value;
}

function clearUsdcOutputs(): void {
  usdcOutput.hidden = true;
  usdcOutput.textContent = "";
  usdcTxLink.hidden = true;
  usdcTxLink.textContent = "";
}

function syncUsdcUi(): void {
  const mode = usdcModeSelect.value as UsdcMode;
  const meta = chainMeta(EVMChainId(chainSelect.value as `0x${string}`));
  usdcSendFields.hidden = mode !== "send";
  usdcActionButton.textContent =
    mode === "send" ? "Send USDC" : "Check Balance";
  usdcContractEl.textContent = meta
    ? `USDC: ${meta.usdc}`
    : "USDC: unsupported chain";
  clearUsdcOutputs();
}

async function refreshChainFromWallet(proxy: OWSProxy): Promise<EVMChainId> {
  const chainId = normalizeChainIdHex(
    await proxy.ethereum.request({ method: "eth_chainId" }),
  );
  setChainSelectValue(chainId);
  syncUsdcUi();
  return chainId;
}

function createPublicClientFromProxy(proxy: OWSProxy) {
  return createPublicClient({
    transport: custom(proxy.ethereum),
  });
}

async function resolveAccount(proxy: OWSProxy): Promise<EVMAccountAddress> {
  let accounts = await proxy.ethereum.request({ method: "eth_accounts" });
  if (accounts.length === 0) {
    accounts = await proxy.ethereum.request({ method: "eth_requestAccounts" });
  }
  const account = accounts[0];
  if (!account) {
    throw new Error("No account returned from wallet");
  }
  return EVMAccountAddress(account);
}

function explorerTxUrl(chainId: EVMChainId, hash: string): string | null {
  const meta = chainMeta(chainId);
  if (!meta) return null;
  return `${meta.blockExplorerUrl}/tx/${hash}`;
}

async function main(): Promise<void> {
  setStatus("Connecting to wallet…");
  syncUsdcUi();
  console.info("[ows-example-host] embedding Branding Layer", __WALLET_IFRAME_URL__);

  const proxy = await OWSProxy.create(walletContainer, __WALLET_IFRAME_URL__);

  try {
    const chainId = await refreshChainFromWallet(proxy);
    setStatus(`Wallet connected on ${chainId}. Enter a message and click Sign.`);
  } catch (error) {
    setStatus(
      error instanceof Error ? error.message : "Failed to read chain id",
      true,
    );
  }

  chainSelect.addEventListener("change", () => {
    void (async () => {
      const selected = EVMChainId(chainSelect.value as `0x${string}`);
      chainSelect.disabled = true;
      clearUsdcOutputs();
      try {
        await proxy.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: selected }],
        });
        syncUsdcUi();
        setStatus(`Switched to ${selected}`);
      } catch (error) {
        await refreshChainFromWallet(proxy).catch(() => undefined);
        setStatus(
          error instanceof Error ? error.message : "Chain switch failed",
          true,
        );
      } finally {
        chainSelect.disabled = false;
      }
    })();
  });

  chainRefreshButton.addEventListener("click", () => {
    void (async () => {
      chainRefreshButton.disabled = true;
      try {
        const chainId = await refreshChainFromWallet(proxy);
        setStatus(`Chain synced: ${chainId}`);
      } catch (error) {
        setStatus(
          error instanceof Error ? error.message : "Failed to refresh chain",
          true,
        );
      } finally {
        chainRefreshButton.disabled = false;
      }
    })();
  });

  usdcModeSelect.addEventListener("change", () => {
    syncUsdcUi();
  });

  signButton.addEventListener("click", () => {
    void handleSign(proxy);
  });

  usdcActionButton.addEventListener("click", () => {
    const mode = usdcModeSelect.value as UsdcMode;
    if (mode === "send") {
      void handleSendUsdc(proxy);
    } else {
      void handleCheckUsdcBalance(proxy);
    }
  });

  showWalletButton.addEventListener("click", () => {
    proxy.showWallet();
    setStatus("Wallet panel shown. Use × in the wallet to hide.");
  });
}

async function handleSign(proxy: OWSProxy): Promise<void> {
  const message = messageInput.value.trim();
  if (!message) {
    setStatus("Enter a message to sign.", true);
    return;
  }

  signButton.disabled = true;
  signatureOutput.hidden = true;
  setStatus("Requesting accounts…");

  try {
    const account = await resolveAccount(proxy);

    setStatus("Approve the passkey prompt to sign…");

    const signature = await proxy.ethereum.request({
      method: "personal_sign",
      params: [message, account],
    });

    signatureOutput.textContent = signature;
    signatureOutput.hidden = false;
    setStatus(`Signed as ${account}`);
  } catch (error) {
    const messageText =
      error instanceof Error ? error.message : "Signing failed";
    setStatus(messageText, true);
  } finally {
    signButton.disabled = false;
  }
}

async function handleCheckUsdcBalance(proxy: OWSProxy): Promise<void> {
  const chainId = normalizeChainIdHex(chainSelect.value);
  const meta = chainMeta(chainId);
  if (!meta) {
    setStatus("USDC is not configured for this chain.", true);
    clearUsdcOutputs();
    return;
  }

  usdcActionButton.disabled = true;
  clearUsdcOutputs();
  setStatus("Reading USDC balance…");

  try {
    const token = getAddress(meta.usdc) as Address;
    const account = await resolveAccount(proxy);
    const owner = getAddress(account) as Address;
    const client = createPublicClientFromProxy(proxy);

    const [name, symbol, balance, decimals] = await Promise.all([
      client.readContract({
        address: token,
        abi: erc20Abi,
        functionName: "name",
      }),
      client.readContract({
        address: token,
        abi: erc20Abi,
        functionName: "symbol",
      }),
      client.readContract({
        address: token,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [owner],
      }),
      client.readContract({
        address: token,
        abi: erc20Abi,
        functionName: "decimals",
      }),
    ]);

    usdcOutput.textContent = [
      `Contract: ${token}`,
      `Account:  ${owner}`,
      `Name:     ${name}`,
      `Symbol:   ${symbol}`,
      `Balance:  ${formatUnits(balance, decimals)} ${symbol}`,
      `Raw:      ${balance.toString()}`,
    ].join("\n");
    usdcOutput.hidden = false;
    setStatus(`Balance for ${symbol}: ${formatUnits(balance, decimals)}`);
  } catch (error) {
    setStatus(
      error instanceof Error ? error.message : "Failed to read USDC balance",
      true,
    );
  } finally {
    usdcActionButton.disabled = false;
  }
}

async function handleSendUsdc(proxy: OWSProxy): Promise<void> {
  const chainId = normalizeChainIdHex(chainSelect.value);
  const meta = chainMeta(chainId);
  if (!meta) {
    setStatus("USDC is not configured for this chain.", true);
    clearUsdcOutputs();
    return;
  }

  const destinationRaw = usdcDestinationInput.value.trim();
  if (!isAddress(destinationRaw)) {
    setStatus("Enter a valid destination address.", true);
    clearUsdcOutputs();
    return;
  }

  const amountRaw = usdcAmountInput.value.trim();
  let amount: bigint;
  try {
    amount = parseUnits(amountRaw, USDC_DECIMALS);
  } catch {
    setStatus("Enter a valid USDC amount.", true);
    clearUsdcOutputs();
    return;
  }
  if (amount <= 0n) {
    setStatus("Amount must be greater than zero.", true);
    clearUsdcOutputs();
    return;
  }

  usdcActionButton.disabled = true;
  clearUsdcOutputs();
  setStatus("Preparing USDC transfer…");

  try {
    const account = await resolveAccount(proxy);
    const to = getAddress(destinationRaw) as Address;
    const data = encodeFunctionData({
      abi: erc20Abi,
      functionName: "transfer",
      args: [to, amount],
    }) as Hex;

    setStatus("Approve the transaction in the wallet…");
    const hash = EVMTransactionHash(await proxy.ethereum.request({
      method: "eth_sendTransaction",
      params: [
        {
          from: account,
          to: meta.usdc,
          data: HexString(data),
          value: HexString("0x0"),
          chainId,
        },
      ],
    }));

    usdcOutput.textContent = `Transaction hash:\n${hash}`;
    usdcOutput.hidden = false;
    const url = explorerTxUrl(chainId, hash);
    if (url) {
      usdcTxLink.innerHTML = "";
      const link = document.createElement("a");
      link.href = url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = "View on explorer";
      usdcTxLink.append(link);
      usdcTxLink.hidden = false;
    }
    setStatus(`USDC sent. Hash ${hash}`);
  } catch (error) {
    setStatus(
      error instanceof Error ? error.message : "Failed to send USDC",
      true,
    );
  } finally {
    usdcActionButton.disabled = false;
  }
}

main().catch((error: unknown) => {
  console.error("[ows-example-host] failed to start", error);
  setStatus(
    error instanceof Error ? error.message : "Failed to connect to wallet",
    true,
  );
});
