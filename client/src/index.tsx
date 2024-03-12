import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { AptosWalletAdapterProvider } from "@aptos-labs/wallet-adapter-react";
import { PetraWallet } from "petra-plugin-wallet-adapter";
import { createBrowserRouter, RouterProvider } from "react-router-dom";

const wallets = [new PetraWallet()];

const router = createBrowserRouter(
  [
    {
      path: "/",
      element: (
        <AptosWalletAdapterProvider plugins={wallets} autoConnect={true}>
          <App />
        </AptosWalletAdapterProvider>
      ),
    },
  ],
  {
    basename: process.env.PUBLIC_URL,
  },
);

const root = ReactDOM.createRoot(
  document.getElementById("root") as HTMLElement,
).render(<RouterProvider router={router} />);
