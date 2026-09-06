import { Connection } from "@solana/web3.js";
import { CHARITIES } from "@/lib/charities";
import {
  RPC_URL,
  explorerAddress,
  explorerTx,
  fetchDonations,
  lamportsToSol,
  totalsByCharity,
  type Donation,
} from "@/lib/ledger";

// Read at request time so a slow or rate-limited RPC can never fail the build.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "OneClickGood — On-chain ledger",
  description: "Every donation made through the OneClickGood Blink, read back from Solana devnet.",
};

function formatWhen(blockTime: number | null): string {
  if (!blockTime) return "—";
  return new Date(blockTime * 1000).toISOString().replace("T", " ").slice(0, 19) + " UTC";
}

export default async function LedgerPage() {
  let donations: Donation[] = [];
  let error: string | null = null;

  try {
    donations = await fetchDonations(new Connection(RPC_URL, "confirmed"), 15);
  } catch (err) {
    error = err instanceof Error ? err.message : "Could not reach the Solana RPC node.";
  }

  const totals = totalsByCharity(donations);
  const grandTotal = totals.reduce((sum, t) => sum + t.lamports, 0);
  const allEven = donations.length > 0 && donations.every((d) => d.evenSplit);

  return (
    <main className="ledger">
      <h1>On-chain ledger</h1>
      <p>
        Every donation below was read back from Solana devnet at page load. There is no database —
        the chain is the record. Run <code>npm run verify</code> to check these numbers yourself
        against an RPC node, without trusting this page.
      </p>

      {error && <p className="error">Could not read the chain: {error}</p>}

      <h2>Totals received</h2>
      <table>
        <thead>
          <tr>
            <th>Nonprofit</th>
            <th>Wallet</th>
            <th className="num">Received</th>
          </tr>
        </thead>
        <tbody>
          {totals.map((t) => {
            const charity = CHARITIES.find((c) => c.id === t.id)!;
            return (
              <tr key={t.id}>
                <td>{t.name}</td>
                <td>
                  <a href={explorerAddress(charity.publicKey)} target="_blank" rel="noreferrer">
                    <code>{charity.publicKey.slice(0, 8)}…</code>
                  </a>
                </td>
                <td className="num">{lamportsToSol(t.lamports)} SOL</td>
              </tr>
            );
          })}
          <tr className="total">
            <td colSpan={2}>Total across the basket</td>
            <td className="num">{lamportsToSol(grandTotal)} SOL</td>
          </tr>
        </tbody>
      </table>

      <h2>
        Donations{" "}
        <span className={allEven ? "ok" : "warn"}>
          {donations.length > 0 && (allEven ? "· every split verified even" : "· uneven split found")}
        </span>
      </h2>

      {donations.length === 0 && !error && <p>No donations recorded on devnet yet.</p>}

      <ol className="donations">
        {donations.map((d) => (
          <li key={d.signature}>
            <div className="row">
              <strong>{lamportsToSol(d.totalLamports)} SOL</strong>
              <span className={d.evenSplit ? "ok" : "warn"}>
                {d.evenSplit ? "even split ✓" : "uneven ✗"}
              </span>
              <span className="when">{formatWhen(d.blockTime)}</span>
            </div>
            <div className="shares">
              {d.shares.map((s) => (
                <span key={s.id}>
                  {s.name} <code>{lamportsToSol(s.lamports)}</code>
                </span>
              ))}
            </div>
            {d.memo && <div className="memo">“{d.memo}”</div>}
            <a href={explorerTx(d.signature)} target="_blank" rel="noreferrer">
              <code>{d.signature.slice(0, 32)}…</code>
            </a>
          </li>
        ))}
      </ol>

      <p>
        <a href="/">← Back to the Blink</a>
      </p>
    </main>
  );
}
