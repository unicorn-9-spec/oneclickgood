import { NextRequest, NextResponse } from "next/server";
import {
  ACTIONS_CORS_HEADERS,
  MEMO_PROGRAM_ID,
  createPostResponse,
  type ActionGetResponse,
  type ActionPostRequest,
  type ActionPostResponse,
  type LinkedAction,
} from "@solana/actions";
import {
  Connection,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  clusterApiUrl,
} from "@solana/web3.js";
import { CHARITIES } from "@/lib/charities";
import { resolveOrigin } from "@/lib/http";

const RPC_URL = process.env.SOLANA_RPC_URL ?? clusterApiUrl("devnet");
const MAX_SOL = 1000;
const PRESET_AMOUNTS_SOL = [0.1, 0.5, 1];
// Each recipient share must clear Solana's rent-exempt minimum for a fresh
// 0-data account or the transfer instruction fails on-chain. ~0.00089 SOL
// per charity today; declare a safely-rounded minimum for the UI.
const MIN_SOL = 0.01;

export const OPTIONS = async () =>
  new NextResponse(null, { headers: ACTIONS_CORS_HEADERS });

export const GET = async (request: NextRequest) => {
  const origin = resolveOrigin(request);
  const iconUrl = `${origin}/icon.svg`;
  const baseHref = `${origin}/api/actions/donate`;

  const actions: LinkedAction[] = [
    ...PRESET_AMOUNTS_SOL.map((amount) => ({
      type: "transaction" as const,
      label: `${amount} SOL`,
      href: `${baseHref}?amount=${amount}`,
    })),
    {
      type: "transaction",
      label: "Donate",
      href: `${baseHref}?amount={amount}`,
      parameters: [
        {
          name: "amount",
          label: "Enter a custom SOL amount",
          type: "number",
          required: true,
          min: MIN_SOL,
          max: MAX_SOL,
        },
      ],
    },
  ];

  const payload: ActionGetResponse = {
    type: "action",
    icon: iconUrl,
    title: "OneClickGood — Disaster Relief Basket",
    description:
      `Split your donation across ${CHARITIES.length} vetted disaster-relief nonprofits ` +
      `(${CHARITIES.map((c) => c.name).join(", ")}) in one signature. Devnet demo.`,
    label: "Donate",
    links: { actions },
  };

  return NextResponse.json(payload, { headers: ACTIONS_CORS_HEADERS });
};

export const POST = async (request: NextRequest) => {
  try {
    const amountParam = request.nextUrl.searchParams.get("amount");
    const amountSol = Number(amountParam);

    if (!amountParam || !Number.isFinite(amountSol) || amountSol < MIN_SOL || amountSol > MAX_SOL) {
      return NextResponse.json(
        { message: `Invalid amount. Must be between ${MIN_SOL} and ${MAX_SOL} SOL.` },
        { status: 400, headers: ACTIONS_CORS_HEADERS },
      );
    }

    const body: ActionPostRequest = await request.json();
    let donor: PublicKey;
    try {
      donor = new PublicKey(body.account);
    } catch {
      return NextResponse.json(
        { message: "Invalid account public key." },
        { status: 400, headers: ACTIONS_CORS_HEADERS },
      );
    }

    const connection = new Connection(RPC_URL, "confirmed");

    const totalLamports = Math.round(amountSol * LAMPORTS_PER_SOL);
    const n = CHARITIES.length;
    const base = Math.floor(totalLamports / n);
    const remainder = totalLamports - base * n;
    const shares = CHARITIES.map((_, i) => base + (i < remainder ? 1 : 0));

    const rentExemptMinimum = await connection.getMinimumBalanceForRentExemption(0);
    const smallestShare = Math.min(...shares);
    if (smallestShare < rentExemptMinimum) {
      const minTotalSol = (rentExemptMinimum * n) / LAMPORTS_PER_SOL;
      return NextResponse.json(
        {
          message: `Amount too small — each of the ${n} recipients needs at least ${rentExemptMinimum} lamports to stay rent-exempt. Try at least ${minTotalSol} SOL.`,
        },
        { status: 400, headers: ACTIONS_CORS_HEADERS },
      );
    }

    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();

    const transaction = new Transaction({
      feePayer: donor,
      blockhash,
      lastValidBlockHeight,
    });

    CHARITIES.forEach((charity, i) => {
      if (shares[i] <= 0) return;
      transaction.add(
        SystemProgram.transfer({
          fromPubkey: donor,
          toPubkey: new PublicKey(charity.publicKey),
          lamports: shares[i],
        }),
      );
    });

    const memo = `OneClickGood: ${amountSol} SOL split across ${CHARITIES.map((c) => c.name).join(" / ")}`;
    transaction.add(
      new TransactionInstruction({
        keys: [],
        programId: new PublicKey(MEMO_PROGRAM_ID),
        data: Buffer.from(memo, "utf-8"),
      }),
    );

    const payload: ActionPostResponse = await createPostResponse({
      fields: {
        type: "transaction",
        transaction,
        message: `Donating ${amountSol} SOL, split evenly across ${n} vetted disaster-relief nonprofits.`,
        // Chain to a completion step that reads the confirmed transaction back
        // off-chain and reports the real per-charity amounts.
        links: {
          next: {
            type: "post",
            href: `${resolveOrigin(request)}/api/actions/donate/complete`,
          },
        },
      },
    });

    return NextResponse.json(payload, { headers: ACTIONS_CORS_HEADERS });
  } catch (err) {
    return NextResponse.json(
      { message: err instanceof Error ? err.message : "Unknown error" },
      { status: 400, headers: ACTIONS_CORS_HEADERS },
    );
  }
};
