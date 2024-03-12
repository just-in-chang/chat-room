import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { AptosWalletAdapterProvider } from "@aptos-labs/wallet-adapter-react";
import { PetraWallet } from "petra-plugin-wallet-adapter";

const wallets = [new PetraWallet()];

const root = ReactDOM.createRoot(
  document.getElementById("root") as HTMLElement,
);
root.render(
  <AptosWalletAdapterProvider plugins={wallets} autoConnect={true}>
    <App />
  </AptosWalletAdapterProvider>,
);