import type { NextRequest } from "next/server";

// Behind a tunnel/proxy (ngrok, cloudflared, Vercel), request.url reflects the
// internal bind address, not the public host — read the forwarded headers instead.
export function resolveOrigin(request: NextRequest): string {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!host) return request.nextUrl.origin;
  const proto = request.headers.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
