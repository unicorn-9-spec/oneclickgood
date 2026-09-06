"use client";

import dynamic from "next/dynamic";

// Wallet state (connected address, etc.) is only known in the browser, so this
// whole widget must skip SSR entirely to avoid a hydration mismatch (React #418).
const DonateBlink = dynamic(() => import("./DonateBlink"), {
  ssr: false,
  loading: () => <p style={{ color: "#b7bcc7" }}>Loading wallet…</p>,
});

export default function DonateBlinkClientOnly() {
  return <DonateBlink />;
}
