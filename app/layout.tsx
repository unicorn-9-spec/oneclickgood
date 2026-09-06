import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OneClickGood — Disaster Relief Basket",
  description:
    "A Solana Blink that splits one donation across a vetted basket of disaster-relief nonprofits.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
