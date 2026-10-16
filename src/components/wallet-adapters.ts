"use client";

import { WalletAdapterNetwork, type Adapter } from "@solana/wallet-adapter-base";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { SolflareWalletAdapter } from "@solana/wallet-adapter-solflare";
import { WalletConnectWalletAdapter } from "@solana/wallet-adapter-walletconnect";

export function createSolanaWallets(rpcUrl: string, projectId: string): Adapter[] {
  const wallets: Adapter[] = [new PhantomWalletAdapter(), new SolflareWalletAdapter()];
  const id = projectId.trim();
  if (id) {
    wallets.push(
      new WalletConnectWalletAdapter({
        network: rpcUrl.includes("devnet") ? WalletAdapterNetwork.Devnet : WalletAdapterNetwork.Mainnet,
        options: {
          projectId: id,
          metadata: {
            name: "Callout Drop",
            description: "Callout Drop checks public Pump.fun statistics. Connecting a wallet does not ask for a seed phrase.",
            url: "https://www.calloutdrop.app",
            icons: ["https://www.calloutdrop.app/logo.png"],
          },
        },
      }),
    );
  }
  return wallets;
}
