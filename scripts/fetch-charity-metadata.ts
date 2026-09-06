// Enriches src/lib/charity-metadata.json with live data (name, description,
// website, logo) from the Every.org Nonprofit API, keyed by EIN.
// Requires a free public API key: https://www.every.org/charity-api
import { writeFileSync } from "node:fs";
import path from "node:path";
import metadata from "../src/lib/charity-metadata.json";

const API_KEY = process.env.EVERY_ORG_API_KEY;
const metadataPath = path.join(process.cwd(), "src", "lib", "charity-metadata.json");

type CharityMetadataEntry = {
  ein: string;
  name: string;
  description: string;
  website: string;
  logoUrl: string | null;
  profileUrl: string | null;
};

type NonprofitResponse = {
  data: {
    nonprofit: {
      name: string;
      description: string;
      websiteUrl: string;
      ein: string;
      logoUrl: string | null;
      profileUrl: string;
    };
  };
};

async function main() {
  if (!API_KEY) {
    console.error(
      "Missing EVERY_ORG_API_KEY.\n" +
        "Get a free public key at https://www.every.org/charity-api, then run:\n" +
        "  EVERY_ORG_API_KEY=pk_... npm run fetch-charity-metadata",
    );
    process.exit(1);
  }

  const updated: Record<string, CharityMetadataEntry> = { ...metadata };

  for (const [id, entry] of Object.entries(metadata)) {
    const url = `https://partners.every.org/v0.2/nonprofit/${entry.ein}?apiKey=${API_KEY}`;
    console.log(`Fetching ${id} (EIN ${entry.ein})...`);
    const res = await fetch(url);
    if (!res.ok) {
      console.log(`  failed (${res.status}) — keeping existing metadata for ${id}`);
      continue;
    }
    const json = (await res.json()) as NonprofitResponse;
    const np = json.data?.nonprofit;
    if (!np) {
      console.log(`  no nonprofit data returned — keeping existing metadata for ${id}`);
      continue;
    }

    updated[id] = {
      ein: np.ein,
      name: np.name,
      description: np.description,
      website: np.websiteUrl,
      logoUrl: np.logoUrl,
      profileUrl: np.profileUrl,
    };
    console.log(`  -> ${np.name}`);
  }

  writeFileSync(metadataPath, JSON.stringify(updated, null, 2) + "\n");
  console.log(`\nWrote ${metadataPath}`);
}

main().catch((err) => {
  console.error("FAILED:", err instanceof Error ? err.message : err);
  process.exit(1);
});
