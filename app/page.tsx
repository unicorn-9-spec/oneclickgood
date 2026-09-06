import DonateBlink from "@/components/DonateBlinkClientOnly";

export default function Home() {
  return (
    <main>
      <h1>OneClickGood</h1>
      <p>
        A Solana Blink that splits a single donation across a vetted basket of
        disaster-relief nonprofits — one signature, three wallets, no herd
        concentration.
      </p>
      <p>Connect a devnet wallet and try it below:</p>
      <DonateBlink />
      <ul>
        <li>American Red Cross</li>
        <li>Direct Relief</li>
        <li>GlobalGiving</li>
      </ul>
    </main>
  );
}
