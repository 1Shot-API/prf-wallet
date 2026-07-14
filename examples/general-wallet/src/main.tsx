import { createRoot } from "react-dom/client";
import { App } from "./App";
import { WalletProvider } from "./wallet/WalletProvider";
import "./index.css";

const root = document.getElementById("root");
if (!root) {
  throw new Error("#root not found");
}

createRoot(root).render(
  <WalletProvider>
    <App />
  </WalletProvider>,
);
