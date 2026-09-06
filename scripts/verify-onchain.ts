// End-to-end proof that the Blink's split actually lands on devnet:
// airdrop a fresh donor wallet, call our own Actions API, sign the
// returned transaction, submit it, and diff charity balances before/after.
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  Transaction,
  clusterApiUrl,
} from "@solana/web3.js";
import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { CHARITIES } from "../src/lib/charities";

const APP_URL = process.env.APP_URL ?? "http://localhost:3001";
const RPC_URL = process.env.SOLANA_RPC_URL ?? clusterApiUrl("devnet");
const DONATE_SOL = Number(process.env.DONATE_SOL ?? "0.1");
const AIRDROP_SOL = 1;
const MIN_REQUIRED_SOL = DONATE_SOL + 0.001; // + fee buffer

const keypairsDir = path.join(process.cwd(), "keypairs");
const donorPath = path.join(keypairsDir, "verifier-donor.devnet.json");

function loadOrCreateDonor(): Keypair {
  mkdirSync(keypairsDir, { recursive: true });
  if (existsSync(donorPath)) {
    const secret = Uint8Array.from(JSON.parse(readFileSync(donorPath, "utf-8")));
    return Keypair.fromSecretKey(secret);
  }
  const kp = Keypair.generate();
  writeFileSync(donorPath, JSON.stringify(Array.from(kp.secretKey)));
  return kp;
}

async function tryAirdrop(connection: Connection, pubkey: PublicKey): Promise<boolean> {
  try {
    const sig = await connection.requestAirdrop(pubkey, AIRDROP_SOL * LAMPORTS_PER_SOL);
    const latest = await connection.getLatestBlockhash();
    await connection.confirmTransaction({ signature: sig, ...latest }, "confirmed");
    return true;
  } catch (err) {
    console.log(`  airdrop failed: ${(err as Error).message}`);
    return false;
  }
}

async function main() {
  const connection = new Connection(RPC_URL, "confirmed");
  const donor = loadOrCreateDonor();
  console.log(`Donor (persisted at ${donorPath}): ${donor.publicKey.toBase58()}`);

  let donorBalanceBefore = await connection.getBalance(donor.publicKey);
  if (donorBalanceBefore / LAMPORTS_PER_SOL < MIN_REQUIRED_SOL) {
    console.log(`Balance ${donorBalanceBefore / LAMPORTS_PER_SOL} SOL is low, requesting airdrop...`);
    const ok = await tryAirdrop(connection, donor.publicKey);
    donorBalanceBefore = await connection.getBalance(donor.publicKey);
    if (!ok || donorBalanceBefore / LAMPORTS_PER_SOL < MIN_REQUIRED_SOL) {
      console.log(
        `\nThe public devnet airdrop faucet is rate-limited right now.\n` +
          `Fund this address manually at https://faucet.solana.com (devnet) and re-run this script:\n\n` +
          `  ${donor.publicKey.toBase58()}\n`,
      );
      process.exit(1);
    }
  }
  console.log(`Donor balance: ${donorBalanceBefore / LAMPORTS_PER_SOL} SOL`);

  const charityBalancesBefore = await Promise.all(
    CHARITIES.map((c) => connection.getBalance(new PublicKey(c.publicKey))),
  );

  console.log(`\nRequesting transaction from ${APP_URL}/api/actions/donate?amount=${DONATE_SOL} ...`);
  const res = await fetch(`${APP_URL}/api/actions/donate?amount=${DONATE_SOL}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ account: donor.publicKey.toBase58() }),
  });
  const json = (await res.json()) as { transaction?: string; message?: string };
  if (!res.ok || !json.transaction) {
    throw new Error(`Action API error (${res.status}): ${json.message ?? "unknown"}`);
  }
  console.log(`Server message: ${json.message}`);

  const transaction = Transaction.from(Buffer.from(json.transaction, "base64"));
  transaction.sign(donor);

  console.log("\nSubmitting signed transaction to devnet...");
  const signature = await connection.sendRawTransaction(transaction.serialize());
  const latest = await connection.getLatestBlockhash();
  await connection.confirmTransaction({ signature, ...latest }, "confirmed");
  console.log(`Confirmed: https://explorer.solana.com/tx/${signature}?cluster=devnet`);

  const charityBalancesAfter = await Promise.all(
    CHARITIES.map((c) => connection.getBalance(new PublicKey(c.publicKey))),
  );
  const donorBalanceAfter = await connection.getBalance(donor.publicKey);

  console.log("\n--- Result ---");
  console.log(
    `Donor:  ${donorBalanceBefore / LAMPORTS_PER_SOL} -> ${donorBalanceAfter / LAMPORTS_PER_SOL} SOL`,
  );
  CHARITIES.forEach((c, i) => {
    const before = charityBalancesBefore[i] / LAMPORTS_PER_SOL;
    const after = charityBalancesAfter[i] / LAMPORTS_PER_SOL;
    console.log(`${c.name.padEnd(22)} ${before} -> ${after} SOL (+${after - before})`);
  });

  const totalReceived = charityBalancesAfter.reduce((a, b) => a + b, 0) - charityBalancesBefore.reduce((a, b) => a + b, 0);
  const expected = Math.round(DONATE_SOL * LAMPORTS_PER_SOL) / LAMPORTS_PER_SOL;
  console.log(`\nTotal split to charities: ${totalReceived / LAMPORTS_PER_SOL} SOL (expected ~${expected} SOL)`);
}

main().catch((err) => {
  console.error("\nFAILED:", err instanceof Error ? err.message : err);
  process.exit(1);
});
