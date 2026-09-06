"use client";

import { Buffer } from "buffer";

if (typeof window !== "undefined") {
  const w = window as unknown as { Buffer?: typeof Buffer };
  w.Buffer = w.Buffer ?? Buffer;
}

import { useMemo, useState } from "react";
import {
  ConnectionProvider,
  WalletProvider,
  useConnection,
  useWallet,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider, WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import "@solana/wallet-adapter-react-ui/styles.css";
import { Blink, useBlink } from "@dialectlabs/blinks";
import { BlinkSolanaConfig } from "@dialectlabs/blinks-core/solana";
import "@dialectlabs/blinks/index.css";
import { Transaction, VersionedTransaction, clusterApiUrl } from "@solana/web3.js";
import bs58 from "bs58";

const ACTION_PATH = "/api/actions/donate";
const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? clusterApiUrl("devnet");

function BlinkWidget() {
  const { connection } = useConnection();
  const wallet = useWallet();
  // useBlink requires an absolute URL, not a relative path.
  const [actionUrl] = useState<string>(() => `${window.location.origin}${ACTION_PATH}`);
  const { blink, isLoading } = useBlink({ url: actionUrl });

  const adapter = useMemo(
    () =>
      new BlinkSolanaConfig(connection, {
        connect: async () => wallet.publicKey?.toBase58() ?? null,
        signTransaction: async (txBase64) => {
          if (!wallet.publicKey) return { error: "Connect a wallet first." };
          try {
            const buffer = Buffer.from(txBase64, "base64");
            let transaction: Transaction | VersionedTransaction;
            try {
              transaction = VersionedTransaction.deserialize(buffer);
            } catch {
              transaction = Transaction.from(buffer);
            }
            const signature = await wallet.sendTransaction(transaction, connection);
            return { signature };
          } catch (err) {
            return { error: err instanceof Error ? err.message : "Failed to sign transaction." };
          }
        },
        signMessage: async (data) => {
          if (!wallet.signMessage) return { error: "Wallet does not support message signing." };
          const message = typeof data === "string" ? data : JSON.stringify(data);
          const signed = await wallet.signMessage(new TextEncoder().encode(message));
          return { signature: bs58.encode(signed) };
        },
      }),
    [connection, wallet],
  );

  if (isLoading || !blink) {
    return <p style={{ color: "#b7bcc7" }}>Loading Blink…</p>;
  }

  return (
    // The Blink root sizes to its parent — without an explicit width it collapses
    // to a zero-width sliver inside a centered flex column.
    <div style={{ width: "100%", maxWidth: 420 }}>
      <Blink blink={blink} adapter={adapter} stylePreset="x-dark" securityLevel="all" />
    </div>
  );
}

export default function DonateBlink() {
  return (
    <ConnectionProvider endpoint={RPC_URL}>
      <WalletProvider wallets={[]} autoConnect={false}>
        <WalletModalProvider>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "1rem",
              alignItems: "center",
              width: "100%",
            }}
          >
            <WalletMultiButton />
            <BlinkWidget />
          </div>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
