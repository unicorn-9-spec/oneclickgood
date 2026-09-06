// One-time setup script: creates a devnet Keypair per charity and writes
// - keypairs/charities.devnet.json  (secret keys, gitignored)
// - src/lib/charity-wallets.json    (public keys only, safe to commit)
import { Keypair } from "@solana/web3.js";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";

const CHARITY_IDS = ["american-red-cross", "direct-relief", "globalgiving"] as const;

const root = process.cwd();
const keypairsDir = path.join(root, "keypairs");
const secretsPath = path.join(keypairsDir, "charities.devnet.json");
const publicPath = path.join(root, "src", "lib", "charity-wallets.json");

if (existsSync(secretsPath)) {
  console.log(`Wallets already exist at ${secretsPath} — delete it first if you want to regenerate.`);
  process.exit(0);
}

mkdirSync(keypairsDir, { recursive: true });

const secrets: Record<string, number[]> = {};
const publicKeys: Record<string, string> = {};

for (const id of CHARITY_IDS) {
  const kp = Keypair.generate();
  secrets[id] = Array.from(kp.secretKey);
  publicKeys[id] = kp.publicKey.toBase58();
}

writeFileSync(secretsPath, JSON.stringify(secrets, null, 2));
writeFileSync(publicPath, JSON.stringify(publicKeys, null, 2));

console.log("Generated devnet wallets:");
for (const id of CHARITY_IDS) {
  console.log(`  ${id}: ${publicKeys[id]}`);
}
console.log(`\nSecret keys saved to ${secretsPath} (gitignored, devnet-only).`);
console.log(`Public keys saved to ${publicPath}.`);
