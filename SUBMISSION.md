*This is a submission for [Weekend Challenge: Generosity Edition](https://dev.to/challenges/weekend-2026-09-03)*

## What I Built

Generosity has a concentration problem. When a disaster happens, attention collapses onto whichever organisation is most visible that week, and money follows attention. Three charities can be doing equally good work in the same disaster zone, and one of them gets the donations because it got the news cycle. The donor almost never intended that outcome — splitting a gift by hand across three organisations means three websites, three checkout forms, three card entries, and nobody does that for $20.

**OneClickGood** is a Solana Blink that makes the split the default instead of the effort. You click one amount, sign one transaction, and it lands in three vetted disaster-relief nonprofits at once — American Red Cross, Direct Relief and GlobalGiving — split evenly to the lamport.

The important part is that the split is not a promise made in a paragraph like this one. It is three `SystemProgram.transfer` instructions inside a single atomic transaction. Either all three nonprofits are funded or none of them are; the chain will not let me favour one and quietly under-fund the others. Every donation also carries an SPL Memo naming the amount and the basket, so the intent sits on the ledger next to the money.

> **[ INSERT COVER IMAGE — still of the Blink card ]**
> Screenshot just the Blink card on the homepage (icon, title, 0.1 / 0.5 / 1 SOL buttons). Crop tight, and leave headroom — DEV crops cover images to a wide banner.
> *Alt text: "The OneClickGood Blink card showing donation amount buttons"*

## Demo

**Live: [oneclickgood.vercel.app](https://oneclickgood.vercel.app)** — connect any Solana wallet on **devnet** and try it.

Here is the whole thing end to end: pick an amount, approve once in Phantom, and the Blink chains to a completion screen that reports what the *chain* recorded — then the public ledger shows the donation the moment it confirms.

> **[ INSERT GIF — `media/donate-flow.gif` ]**
> *Alt text: "Donating 0.5 SOL through the OneClickGood Blink: one Phantom approval, then a completion screen showing the three-way split, then the on-chain ledger"*

Note the completion screen. It does not echo back what my server intended to send — it fetches the confirmed transaction from devnet and reports the balance changes the chain actually recorded:

> **0.5 SOL delivered to 3 nonprofits**
> Confirmed on devnet and read back from the chain — American Red Cross: 0.166666667 SOL · Direct Relief: 0.166666667 SOL · GlobalGiving: 0.166666666 SOL

A real transaction from that flow, signed by a browser wallet: [`28rjB9bH…ZcBro`](https://explorer.solana.com/tx/28rjB9bHHaqrXfXNmmRLJJ3c6XdUm5Xd2EMKumpwRd9sLHrgCm6n4XBokb3NyPK7YgNnFAkVQyddgT1eeWvZcBro?cluster=devnet). One signer, three recipients, one memo.

### Don't trust my site — audit it

There is no database in this project. The [public ledger](https://oneclickgood.vercel.app/ledger) is rendered by reading devnet at request time, which means my page can be wrong in only one direction: it can fail to load. It cannot quietly report a number the chain disagrees with.

And you do not have to take the page's word either. `npm run verify` talks to a Solana RPC node and nothing else — not my website, not my server. Given only the three wallet addresses, it walks every donation, decodes the memo, recomputes each split from the transaction's own `preBalances`/`postBalances`, and **exits non-zero if any donation was not an even three-way split**:

> **[ INSERT GIF — `media/verify-cli.gif` ]**
> *Alt text: "npm run verify walking every donation from an RPC node and confirming all splits were even"*

```
0.5 SOL  even ✓  2026-09-06 19:45:58 UTC
  from BQoHF3RLx5saWhfK8kZWGkhJU4SXinym3D81kW27KbjW
    American Red Cross     0.166666667 SOL
    Direct Relief          0.166666667 SOL
    GlobalGiving           0.166666666 SOL
  memo: "OneClickGood: 0.5 SOL split across American Red Cross / Direct Relief / GlobalGiving"

Totals received:
  American Red Cross     0.733333336 SOL  (33.33%)
  Direct Relief          0.733333333 SOL  (33.33%)
  GlobalGiving           0.733333331 SOL  (33.33%)
  TOTAL                  2.2 SOL

Every one of the 5 donation(s) split evenly across all 3 nonprofits.
```

If that output and the website ever disagree, the chain is right and I am wrong.

## Code

{% embed https://github.com/unicorn-9-spec/oneclickgood %}

## How I Built It

**A Blink, not an app with a donate button.** This is the decision the whole project rests on. OneClickGood implements the [Solana Actions](https://solana.com/docs/advanced/actions) spec: a `GET` that returns the card metadata and available amounts, and a `POST` that builds an unsigned transaction for whoever clicked. That makes the donation a *portable object* rather than a page — the same URL renders and signs inside any Blink client, and `actions.json` maps the domain so the whole site is discoverable as an Action provider. Nothing about it is specific to my frontend.

**The split, and the one bug that mattered.** Splitting evenly is integer division on lamports, and integer division leaves a remainder. Dropping it would silently shave lamports off the donation, so the remainder is distributed one lamport at a time across the first N charities — which is why the audit output reads `0.166666667 / 0.166666667 / 0.166666666` rather than three identical numbers. That asymmetry is the remainder being spent rather than lost.

The subtler bug: I initially allowed a minimum donation of 0.001 SOL. Split three ways that is ~0.00033 SOL each, which is **below Solana's rent-exempt minimum** for a fresh account — so the transfer would have been built happily by my server and then rejected on-chain. The fix queries `getMinimumBalanceForRentExemption(0)` at request time and refuses the donation with a real explanation, rather than handing the user a transaction that cannot land.

**Action chaining.** The `POST` response returns `links.next`, so after signing, the Blink client posts the signature to a completion endpoint. That endpoint fetches the transaction and diffs `preBalances` against `postBalances` for each charity account. This is why the success screen can state amounts as fact — they are read back off the chain, not remembered from a variable. Chaining is a spec feature that exists only *because* this is an Action, and it turns the Blink from a fire-and-forget button into something that closes its own loop.

**Charity data is real even though the wallets aren't.** Names, descriptions, logos and websites are pulled from the [Every.org](https://www.every.org/charity-api) nonprofit API by **EIN** — `530196605` for the American Red Cross, `951831116` for Direct Relief, `300108263` for GlobalGiving — so the basket references verifiable 501(c)(3) records rather than three strings I typed.

**Being straight about the limits.** These are devnet wallets I generated, not addresses controlled by the Red Cross, and devnet SOL is not money. This is a proof of the *mechanism* — that a one-signature multi-recipient donation is a real, auditable primitive — not a live fundraising channel. I would rather write that down than let a demo imply otherwise. Making it real is a wallet-custody and trust problem, not a code problem.

**The thing that broke mid-build.** My original plan was to demo through `dial.to`, Dialect's Blink interstitial, exactly as their docs still recommend. Partway through the weekend the domain stopped resolving — `NXDOMAIN`, and not a local DNS hiccup; `dialect.to` itself stayed up, so it looked like a lapsed registration rather than a migration. Rather than ship a demo that depends on somebody else's uptime, I embedded Dialect's own `@dialectlabs/blinks` React client directly into the site, so the card renders and signs on my origin. The Blink is still spec-compliant and still portable; it just no longer needs a third party to be reachable to be seen. Two React bugs fell out of that move — a hydration mismatch from `WalletMultiButton`, and passing the client a relative URL where it wanted an absolute one — and both are in the commit history.

**Stack.** Next.js App Router on Vercel, `@solana/actions` for the spec types and `createPostResponse`, `@solana/web3.js` for transaction building and every chain read, `@dialectlabs/blinks` + wallet-adapter for the on-site renderer. No database anywhere in the project — devnet is the only state.

## Prize Categories

**Best Use of Solana.**

Most donation projects use a chain as a payment rail: the app decides what happened, then writes a receipt. Here the chain is the *enforcement mechanism and the source of truth*, in four concrete ways:

1. **Atomicity is the product.** Even distribution across three nonprofits isn't a policy I promise to follow — it's three transfer instructions in one transaction. Partial favouritism is not something the runtime will execute.
2. **It's a Solana-native primitive, not an app.** A spec-conforming Action/Blink is portable and embeddable: the donation is a URL other surfaces can render and sign, which is exactly the composability Actions were introduced for.
3. **Action chaining closes the loop.** `links.next` lets the Blink read its own confirmed transaction back off devnet and report the real amounts. That capability exists only because it's an Action.
4. **Every number is chain-derived and independently auditable.** No database exists. The ledger page reads devnet live, and `npm run verify` reproduces every figure from an RPC node with no access to my infrastructure — and fails loudly if a split was ever uneven.

Remove Solana and this isn't a worse version of the project. It's just a promise in a blog post, which is the exact thing it was built to avoid.
