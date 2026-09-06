/**
 * Independent audit of the OneClickGood basket.
 *
 * Talks to a Solana RPC node and nothing else — not our website, not a database.
 * Given only the three charity wallet addresses, it walks every donation, decodes
 * the memo, recomputes the split from the transaction's own balance changes, and
 * fails loudly if any donation was not an even three-way split.
 *
 *   npm run verify
 *   npm run verify -- --rpc https://your-node --limit 50
 */
import { Connection } from "@solana/web3.js";
import { CHARITIES } from "../src/lib/charities";
import { RPC_URL, explorerTx, fetchDonations, lamportsToSol, totalsByCharity } from "../src/lib/ledger";

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

async function main() {
  const rpc = arg("rpc", RPC_URL);
  const limit = Number(arg("limit", "25"));

  console.log(`RPC:     ${rpc}`);
  console.log(`Basket:  ${CHARITIES.length} nonprofits`);
  for (const c of CHARITIES) {
    console.log(`  ${c.name.padEnd(22)} ${c.publicKey}  (EIN ${c.ein})`);
  }
  console.log();

  const connection = new Connection(rpc, "confirmed");
  const donations = await fetchDonations(connection, limit);

  if (donations.length === 0) {
    console.log("No donations found on-chain yet.");
    return;
  }

  console.log(`Walking ${donations.length} donation(s), newest first:\n`);

  let uneven = 0;
  for (const d of donations) {
    const when = d.blockTime
      ? new Date(d.blockTime * 1000).toISOString().replace("T", " ").slice(0, 19)
      : "unknown time";
    const mark = d.evenSplit ? "even ✓" : "UNEVEN ✗";
    if (!d.evenSplit) uneven++;

    console.log(`${lamportsToSol(d.totalLamports)} SOL  ${mark}  ${when} UTC`);
    console.log(`  from ${d.donor}`);
    for (const s of d.shares) {
      console.log(`    ${s.name.padEnd(22)} ${lamportsToSol(s.lamports)} SOL`);
    }
    if (d.memo) console.log(`  memo: "${d.memo}"`);
    console.log(`  ${explorerTx(d.signature)}\n`);
  }

  const totals = totalsByCharity(donations);
  const grand = totals.reduce((sum, t) => sum + t.lamports, 0);

  console.log("Totals received:");
  for (const t of totals) {
    const pct = grand === 0 ? 0 : ((t.lamports / grand) * 100).toFixed(2);
    console.log(`  ${t.name.padEnd(22)} ${lamportsToSol(t.lamports)} SOL  (${pct}%)`);
  }
  console.log(`  ${"TOTAL".padEnd(22)} ${lamportsToSol(grand)} SOL`);
  console.log();

  if (uneven > 0) {
    console.error(`FAILED: ${uneven} donation(s) were not split evenly.`);
    process.exit(1);
  }
  console.log(`Every one of the ${donations.length} donation(s) split evenly across all ${CHARITIES.length} nonprofits.`);
}

main().catch((err) => {
  console.error("FAILED:", err instanceof Error ? err.message : err);
  process.exit(1);
});
