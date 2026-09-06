// Reads donations back OFF the chain. Nothing here trusts our own database
// (there isn't one) — every number is derived from devnet transactions.
import { Connection, LAMPORTS_PER_SOL, PublicKey, clusterApiUrl } from "@solana/web3.js";
import { CHARITIES } from "./charities";

export const RPC_URL = process.env.SOLANA_RPC_URL ?? clusterApiUrl("devnet");

export type Share = { id: string; name: string; lamports: number };

export type Donation = {
  signature: string;
  blockTime: number | null;
  donor: string;
  memo: string | null;
  shares: Share[];
  totalLamports: number;
  /** Every charity received a share, within 1 lamport of every other. */
  evenSplit: boolean;
};

const MEMO_RE = /Program log: Memo \(len \d+\): "([\s\S]*)"/;

export function lamportsToSol(lamports: number): number {
  return lamports / LAMPORTS_PER_SOL;
}

/**
 * Every donation touches all three charity wallets in one transaction, so the
 * signature list of any single charity is a complete index of the basket.
 */
export async function fetchDonations(
  connection: Connection,
  limit = 15,
): Promise<Donation[]> {
  const index = new PublicKey(CHARITIES[0].publicKey);
  const signatures = await connection.getSignaturesForAddress(index, { limit });

  const donations: Donation[] = [];
  for (const { signature, err } of signatures) {
    if (err) continue;
    const tx = await connection.getTransaction(signature, {
      maxSupportedTransactionVersion: 0,
    });
    if (!tx?.meta) continue;

    const keys = tx.transaction.message
      .getAccountKeys({ accountKeysFromLookups: tx.meta.loadedAddresses })
      .keySegments()
      .flat()
      .map((k) => k.toBase58());

    const delta = (address: string) => {
      const i = keys.indexOf(address);
      if (i === -1) return 0;
      return tx.meta!.postBalances[i] - tx.meta!.preBalances[i];
    };

    const shares: Share[] = CHARITIES.map((c) => ({
      id: c.id,
      name: c.name,
      lamports: delta(c.publicKey),
    }));

    // Not one of ours if any charity was left out.
    if (shares.some((s) => s.lamports <= 0)) continue;

    const amounts = shares.map((s) => s.lamports);
    const evenSplit = Math.max(...amounts) - Math.min(...amounts) <= 1;
    const memoLog = tx.meta.logMessages?.find((l) => MEMO_RE.test(l));

    donations.push({
      signature,
      blockTime: tx.blockTime ?? null,
      donor: keys[0],
      memo: memoLog ? (MEMO_RE.exec(memoLog)?.[1] ?? null) : null,
      shares,
      totalLamports: amounts.reduce((a, b) => a + b, 0),
      evenSplit,
    });
  }

  return donations;
}

export function totalsByCharity(donations: Donation[]): Share[] {
  return CHARITIES.map((c) => ({
    id: c.id,
    name: c.name,
    lamports: donations.reduce(
      (sum, d) => sum + (d.shares.find((s) => s.id === c.id)?.lamports ?? 0),
      0,
    ),
  }));
}

export function explorerTx(signature: string): string {
  return `https://explorer.solana.com/tx/${signature}?cluster=devnet`;
}

export function explorerAddress(address: string): string {
  return `https://explorer.solana.com/address/${address}?cluster=devnet`;
}
