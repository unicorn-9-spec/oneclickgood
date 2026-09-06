# OneClickGood — Donation Blink That Splits to a Vetted Basket

**Category:** Best Use of Solana

## The Hook
Blinks make giving native to social feeds, and basket-splitting fights herd concentration. It's a real
blockchain mechanic, not just a "donate here" button.

## What It Does
A Solana Blink that you can post on X (or anywhere) that allows a user to split a gift across a curated
basket of vetted nonprofits for a specific cause, all in one signature.

## Architecture
`@solana/actions` two-endpoint API
→ transaction with multiple transfers
→ Dialect registry / `dial.to` interstitial
Charities' devnet wallets are seeded using Every.org metadata.

## Weekend MVP
A working Blink on devnet rendering in `dial.to`, successfully splitting funds to 3 wallets.

## Key Challenge & Fix
**Challenge:** Blink rendering and registry approval.
**Fix:** Demo via the `dial.to` interstitial, which requires no registry approval.

## The Demo
Paste the Blink URL into `dial.to`, sign it, and show the 3-way split transaction completing on devnet.

**Live:** https://oneclickgood.vercel.app · Blink test link: `https://dial.to/?action=solana-action:https://oneclickgood.vercel.app/api/actions/donate`

## Getting Started

```bash
npm install
npm run generate-wallets   # one-time: creates 3 devnet charity wallets (already run — see src/lib/charity-wallets.json)
npm run dev                # http://localhost:3000
```

- `GET /api/actions/donate` — Blink metadata (icon, title, preset/custom amount buttons)
- `POST /api/actions/donate?amount=<SOL>` — builds an unsigned transaction that splits `amount` evenly across the 3 charity wallets below, plus a memo describing the split
- `GET /actions.json` — Actions registry rule mapping this domain's `/api/actions/**` paths

Current devnet basket (regenerate with `npm run generate-wallets` after deleting `keypairs/charities.devnet.json`):

| Charity | Devnet Wallet |
| --- | --- |
| American Red Cross | see `src/lib/charity-wallets.json` → `american-red-cross` |
| Direct Relief | see `src/lib/charity-wallets.json` → `direct-relief` |
| GlobalGiving | see `src/lib/charity-wallets.json` → `globalgiving` |

Charity name/description/website in `src/lib/charity-metadata.json` ship with static defaults and can be
refreshed from the [Every.org Nonprofit API](https://www.every.org/charity-api) (free public key required):

```bash
EVERY_ORG_API_KEY=pk_... npm run fetch-charity-metadata
```

### Proving the split lands on-chain

`npm run verify-onchain` airdrops (or reuses) a persisted devnet donor wallet at
`keypairs/verifier-donor.devnet.json`, calls this app's own `POST /api/actions/donate`, signs the
returned transaction, submits it, and prints each charity's balance before/after plus an explorer link.
If the public airdrop faucet is dry, fund the printed address manually at
[faucet.solana.com](https://faucet.solana.com/) and re-run.

```bash
APP_URL=http://localhost:3000 npm run verify-onchain
```

### Testing in `dial.to`

`dial.to` fetches your Action endpoint over the public internet, so `localhost` won't work directly. Either:

- **Deploy** (recommended, durable): `vercel link --yes --project oneclickgood && vercel deploy --yes --prod`.
- **Tunnel, no account needed** (quick local iteration): `npx cloudflared tunnel --url http://localhost:3000`, then use the printed `https://*.trycloudflare.com` URL. (`ngrok` works too but now requires a free account + authtoken.)

Then open `https://dial.to/?action=solana-action:<your-public-url>/api/actions/donate` (set the network to devnet in dial.to), connect a devnet wallet, and sign. Fund the donor wallet first via `solana airdrop 1 <address> --url devnet` or the [Solana faucet](https://faucet.solana.com/).
