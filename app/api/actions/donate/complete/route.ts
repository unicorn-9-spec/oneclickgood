import { NextRequest, NextResponse } from "next/server";
import {
  ACTIONS_CORS_HEADERS,
  type CompletedAction,
  type NextActionPostRequest,
} from "@solana/actions";
import { Connection, PublicKey } from "@solana/web3.js";
import { CHARITIES } from "@/lib/charities";
import { resolveOrigin } from "@/lib/http";
import { RPC_URL, lamportsToSol } from "@/lib/ledger";

export const OPTIONS = async () =>
  new NextResponse(null, { headers: ACTIONS_CORS_HEADERS });

/**
 * Chained action step. The blink client posts the signature of the transaction
 * the user just signed; we read that transaction back off devnet and report the
 * amounts the chain actually recorded, rather than echoing what we intended.
 */
export const POST = async (request: NextRequest) => {
  const icon = `${resolveOrigin(request)}/icon.svg`;

  const completed = (title: string, description: string): CompletedAction => ({
    type: "completed",
    icon,
    title,
    description,
    label: "Done",
  });

  try {
    const body: NextActionPostRequest = await request.json();
    const signature = body.signature;

    if (!signature) {
      return NextResponse.json(completed("Donation sent", "No signature was provided to verify."), {
        headers: ACTIONS_CORS_HEADERS,
      });
    }

    const connection = new Connection(RPC_URL, "confirmed");
    const tx = await connection.getTransaction(signature, {
      maxSupportedTransactionVersion: 0,
    });

    if (!tx?.meta) {
      return NextResponse.json(
        completed(
          "Donation submitted",
          "The transaction is still confirming. Check Solana Explorer for the final split.",
        ),
        { headers: ACTIONS_CORS_HEADERS },
      );
    }

    const keys = tx.transaction.message
      .getAccountKeys({ accountKeysFromLookups: tx.meta.loadedAddresses })
      .keySegments()
      .flat()
      .map((k) => k.toBase58());

    const received = CHARITIES.map((charity) => {
      const i = keys.indexOf(new PublicKey(charity.publicKey).toBase58());
      const lamports = i === -1 ? 0 : tx.meta!.postBalances[i] - tx.meta!.preBalances[i];
      return { name: charity.name, sol: lamportsToSol(lamports) };
    });

    const total = received.reduce((sum, r) => sum + r.sol, 0);
    const breakdown = received.map((r) => `${r.name}: ${r.sol} SOL`).join(" · ");

    return NextResponse.json(
      completed(
        `${total} SOL delivered to ${CHARITIES.length} nonprofits`,
        `Confirmed on devnet and read back from the chain — ${breakdown}. Signature ${signature.slice(0, 16)}…`,
      ),
      { headers: ACTIONS_CORS_HEADERS },
    );
  } catch (err) {
    return NextResponse.json(
      completed(
        "Donation sent",
        err instanceof Error ? err.message : "Could not read the transaction back from devnet.",
      ),
      { headers: ACTIONS_CORS_HEADERS },
    );
  }
};
