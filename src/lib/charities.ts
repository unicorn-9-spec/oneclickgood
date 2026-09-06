import wallets from "./charity-wallets.json";
import metadata from "./charity-metadata.json";

export type Charity = {
  id: keyof typeof wallets;
  name: string;
  description: string;
  website: string;
  ein: string;
  logoUrl: string | null;
  profileUrl: string | null;
  publicKey: string;
};

const CHARITY_IDS = Object.keys(wallets) as Array<keyof typeof wallets>;

export const CHARITIES: Charity[] = CHARITY_IDS.map((id) => {
  const m = metadata[id];
  return {
    id,
    name: m.name,
    description: m.description,
    website: m.website,
    ein: m.ein,
    logoUrl: m.logoUrl,
    profileUrl: m.profileUrl,
    publicKey: wallets[id],
  };
});
