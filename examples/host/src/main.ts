import { OWSProxy } from "@1shotapi/ows-provider";
import { EVMAccountAddress, EVMChainId } from "@1shotapi/ows-types";
import {
  createPublicClient,
  custom,
  erc20Abi,
  formatUnits,
  getAddress,
  isAddress,
  type Address,
} from "viem";
import "./styles.css";

const messageInput = document.getElementById("message-input") as HTMLTextAreaElement;
const signButton = document.getElementById("sign-button") as HTMLButtonElement;
const showWalletButton = document.getElementById(
  "show-wallet-button",
) as HTMLButtonElement;
const chainSelect = document.getElementById("chain-select") as HTMLSelectElement;
const chainRefreshButton = document.getElementById(
  "chain-refresh-button",
) as HTMLButtonElement;
const tokenAddressInput = document.getElementById(
  "token-address-input",
) as HTMLInputElement;
const checkBalanceButton = document.getElementById(
  "check-balance-button",
) as HTMLButtonElement;
const tokenBalanceOutput = document.getElementById(
  "token-balance-output",
) as HTMLPreElement;
const statusEl = document.getElementById("status") as HTMLParagraphElement;
const signatureOutput = document.getElementById("signature-output") as HTMLPreElement;
const walletContainer = document.getElementById("wallet-container")!;

function setStatus(message: string, isError = false): void {
  statusEl.textContent = message;
  statusEl.classList.toggle("status--error", isError);
}

/** Canonical hex chain id for `<option value>` matching. */
function normalizeChainIdHex(value: string): EVMChainId {
  return EVMChainId(`0x${BigInt(value).toString(16)}`);
}

function setChainSelectValue(chainId: EVMChainId): void {
  const value = String(chainId);
  if ([...chainSelect.options].some((option) => option.value === value)) {
    chainSelect.value = value;
    return;
  }
  // Unknown chain — show it as a temporary option so the UI stays honest.
  const option = document.createElement("option");
  option.value = value;
  option.textContent = value;
  chainSelect.append(option);
  chainSelect.value = value;
}

async function refreshChainFromWallet(proxy: OWSProxy): Promise<EVMChainId> {
  const chainId = normalizeChainIdHex(
    await proxy.ethereum.request({ method: "eth_chainId" }),
  );
  setChainSelectValue(chainId);
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
  return account;
}

async function main(): Promise<void> {
  setStatus("Connecting to wallet…");
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
      try {
        await proxy.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: selected }],
        });
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

  signButton.addEventListener("click", () => {
    void handleSign(proxy);
  });

  checkBalanceButton.addEventListener("click", () => {
    void handleCheckBalance(proxy);
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

async function handleCheckBalance(proxy: OWSProxy): Promise<void> {
  const rawAddress = tokenAddressInput.value.trim();
  if (!isAddress(rawAddress)) {
    setStatus("Enter a valid ERC-20 contract address.", true);
    tokenBalanceOutput.hidden = true;
    return;
  }

  checkBalanceButton.disabled = true;
  tokenBalanceOutput.hidden = true;
  setStatus("Reading token balance…");

  try {
    const token = getAddress(rawAddress) as Address;
    const account = await resolveAccount(proxy);
    const owner = getAddress(account) as Address;
    const client = createPublicClientFromProxy(proxy);

    // name / symbol / balanceOf via eth_call through the EIP-1193 proxy.
    // decimals is only used to format the balance for display.
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

    tokenBalanceOutput.textContent = [
      `Contract: ${token}`,
      `Account:  ${owner}`,
      `Name:     ${name}`,
      `Symbol:   ${symbol}`,
      `Balance:  ${formatUnits(balance, decimals)} ${symbol}`,
      `Raw:      ${balance.toString()}`,
    ].join("\n");
    tokenBalanceOutput.hidden = false;
    setStatus(`Balance for ${symbol}: ${formatUnits(balance, decimals)}`);
  } catch (error) {
    setStatus(
      error instanceof Error ? error.message : "Failed to read token balance",
      true,
    );
  } finally {
    checkBalanceButton.disabled = false;
  }
}

main().catch((error: unknown) => {
  console.error("[ows-example-host] failed to start", error);
  setStatus(
    error instanceof Error ? error.message : "Failed to connect to wallet",
    true,
  );
});
