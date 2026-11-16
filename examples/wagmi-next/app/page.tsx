"use client";

import type { ReactNode } from "react";
import { parseEther } from "viem";
import {
  useCallsStatus,
  useChainId,
  useChains,
  useConnect,
  useConnection,
  useConnectors,
  useDisconnect,
  useSendCalls,
  useSendTransaction,
  useSignMessage,
  useSignTypedData,
  useSwitchChain,
} from "wagmi";

export default function Page() {
  const connection = useConnection();
  const chainId = useChainId();
  const chains = useChains();
  const connectors = useConnectors();
  const oneShot = connectors.find((c) => c.id === "oneShotWallet");

  const connect = useConnect();
  const disconnect = useDisconnect();
  const switchChain = useSwitchChain();
  const signMessage = useSignMessage();
  const signTypedData = useSignTypedData();
  const sendTransaction = useSendTransaction();
  const sendCalls = useSendCalls();
  const callsStatus = useCallsStatus({
    id: sendCalls.data?.id ?? "",
    query: { enabled: Boolean(sendCalls.data?.id) },
  });

  const address = connection.address;

  return (
    <main>
      <h1>1Shot Wallet × wagmi</h1>

      <Section title="Connection">
        <p data-testid="status">
          Status: <strong>{connection.status}</strong>
        </p>
        <p data-testid="address">Address: {address ?? "—"}</p>
        <p data-testid="chain">
          Chain: {chains.find((c) => c.id === chainId)?.name} ({chainId})
        </p>
        {connection.isConnected ? (
          <button type="button" onClick={() => disconnect.mutate()}>
            Disconnect
          </button>
        ) : (
          <button
            type="button"
            disabled={!oneShot || connect.isPending}
            onClick={() => oneShot && connect.mutate({ connector: oneShot })}
          >
            {connect.isPending ? "Connecting…" : "Connect 1Shot Wallet"}
          </button>
        )}
        <ErrorLine error={connect.error ?? disconnect.error} />
      </Section>

      {connection.isConnected && address && (
        <>
          <Section title="Switch chain">
            {chains.map((chain) => (
              <button
                key={chain.id}
                type="button"
                disabled={chain.id === chainId || switchChain.isPending}
                onClick={() => switchChain.mutate({ chainId: chain.id })}
                style={{ marginRight: 8 }}
              >
                {chain.name}
              </button>
            ))}
            <ErrorLine error={switchChain.error} />
          </Section>

          <Section title="Sign message">
            <button
              type="button"
              onClick={() =>
                signMessage.mutate({ message: "Hello from wagmi + 1Shot" })
              }
            >
              personal_sign
            </button>
            <Result value={signMessage.data} error={signMessage.error} />
          </Section>

          <Section title="Sign typed data">
            <button
              type="button"
              onClick={() =>
                signTypedData.mutate({
                  domain: { name: "1Shot wagmi example", version: "1", chainId },
                  types: {
                    Mail: [
                      { name: "to", type: "address" },
                      { name: "contents", type: "string" },
                    ],
                  },
                  primaryType: "Mail",
                  message: { to: address, contents: "Hello, typed data" },
                })
              }
            >
              eth_signTypedData_v4
            </button>
            <Result value={signTypedData.data} error={signTypedData.error} />
          </Section>

          <Section title="Send transaction">
            <button
              type="button"
              onClick={() =>
                sendTransaction.mutate({ to: address, value: parseEther("0") })
              }
            >
              Send 0 ETH to self
            </button>
            <Result value={sendTransaction.data} error={sendTransaction.error} />
          </Section>

          <Section title="Send calls (EIP-5792)">
            <button
              type="button"
              onClick={() =>
                sendCalls.mutate({
                  calls: [
                    { to: address, value: 0n },
                    { to: address, value: 0n },
                  ],
                })
              }
            >
              wallet_sendCalls ×2
            </button>
            <Result value={sendCalls.data?.id} error={sendCalls.error} />
            {callsStatus.data && (
              <p>Calls status: {callsStatus.data.status}</p>
            )}
          </Section>
        </>
      )}
    </main>
  );
}

function Section(props: { title: string; children: ReactNode }) {
  return (
    <section
      style={{ border: "1px solid #ddd", borderRadius: 8, margin: "1rem 0", padding: "1rem" }}
    >
      <h2 style={{ fontSize: "1rem", marginTop: 0 }}>{props.title}</h2>
      {props.children}
    </section>
  );
}

function Result(props: { value: string | undefined; error: Error | null }) {
  return (
    <>
      {props.value && (
        <pre style={{ overflowWrap: "anywhere", whiteSpace: "pre-wrap" }}>
          {props.value}
        </pre>
      )}
      <ErrorLine error={props.error} />
    </>
  );
}

function ErrorLine(props: { error: Error | null }) {
  if (!props.error) return null;
  return (
    <p role="alert" style={{ color: "#b00020" }}>
      {props.error.name}: {props.error.message.split("\n")[0]}
    </p>
  );
}
