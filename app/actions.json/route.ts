import { NextResponse } from "next/server";
import { ACTIONS_CORS_HEADERS, type ActionsJson } from "@solana/actions";

export const GET = async () => {
  const payload: ActionsJson = {
    rules: [{ pathPattern: "/api/actions/**", apiPath: "/api/actions/**" }],
  };

  return NextResponse.json(payload, { headers: ACTIONS_CORS_HEADERS });
};

export const OPTIONS = async () =>
  new NextResponse(null, { headers: ACTIONS_CORS_HEADERS });
