import type { CompanyProfile } from "./types";

// Hand-written stub profile (RFC: "hard-coding a few company profiles"). Owners are fake.
export const PROFILES: CompanyProfile[] = [
  {
    id: "ledgerly",
    name: "Ledgerly Inc.",
    summary:
      "US mid-size fintech (~600 employees). Licensed money transmitter in 48 states. Consumer app offering P2P payments, debit card (issued via a partner bank), cross-border remittances to 30 countries, and a custodial crypto wallet (buy/sell/send BTC, ETH, USDC). Small-business invoicing. No lending, no securities brokerage, not a bank.",
    businessLines: [
      "P2P payments and money transmission",
      "Prepaid / debit card program via sponsor bank",
      "International remittances",
      "Custodial crypto wallet (convertible virtual currency)",
      "Small-business invoicing and payouts",
    ],
    applies: [
      "Bank Secrecy Act / AML, FinCEN rules for MSBs, Travel Rule, CVC rules",
      "OFAC sanctions screening (customers and counterparties, incl. crypto addresses)",
      "CFPB rules: Reg E (EFTA), remittance rule, prepaid rule, UDAAP, larger-participant rules for payment apps",
      "Consumer data privacy / GLBA, open banking (1033)",
      "FTC consumer protection that touches payment apps",
      "Stablecoin / digital asset regulation affecting custodial wallets",
    ],
    doesNotApply: [
      "SEC rules for exchanges, broker-dealers, investment companies, SRO rule filings",
      "Bank capital rules, bank holding company filings, deposit insurance assessments",
      "CFTC derivatives market rules (DCMs, swaps)",
      "Tax rules unless they create information reporting for payment platforms or digital assets",
      "Sanctions actions only matter via the screening program, not individually",
    ],
    areas: {
      "aml-bsa": { description: "AML/BSA program, FinCEN, Travel Rule, SARs", owner: { name: "Priya Shah (BSA Officer)", email: "bsa@ledgerly.example" } },
      sanctions: { description: "OFAC screening and sanctions compliance", owner: { name: "Marcus Lee (Sanctions)", email: "sanctions@ledgerly.example" } },
      "consumer-payments": { description: "Reg E, remittances, prepaid, CFPB supervision, UDAAP", owner: { name: "Dana Ortiz (Consumer Compliance)", email: "consumer@ledgerly.example" } },
      crypto: { description: "Custodial wallet, stablecoins, CVC-specific rules", owner: { name: "Sam Okafor (Digital Assets Counsel)", email: "crypto@ledgerly.example" } },
      privacy: { description: "Privacy, data security, open banking / 1033", owner: { name: "Lena Novak (Privacy)", email: "privacy@ledgerly.example" } },
      tax: { description: "Information reporting (1099-K, 1099-DA)", owner: { name: "Ravi Menon (Tax)", email: "tax@ledgerly.example" } },
    },
    generalCounsel: { name: "Jordan Blake (General Counsel)", email: "gc@ledgerly.example" },
  },
  {
    id: "brightside",
    name: "Brightside Foods Co.",
    summary:
      "US mid-size packaged food company (~900 employees, plants in Ohio and Georgia). Makes hot dogs and sausages, brightly colored gummy candy, and pecan-and-apple snack bars. Buys pecans, apples and corn from US farms. Sells through grocery chains and convenience stores (many customers pay with SNAP / food stamps). Runs its own fleet of 40 delivery trucks. No restaurants, no alcohol, no exports.",
    businessLines: ["Hot dogs and sausages", "Colored gummy candy", "Pecan and apple snack bars", "Grocery and convenience-store sales", "Own delivery truck fleet"],
    applies: [
      "FDA food additive and color additive rules (dyes in candy, casings, meat)",
      "Food labeling and food safety rules for packaged food and meat products",
      "EPA pesticide residue limits on crops we buy (pecans, apples, corn)",
      "USDA marketing orders and grading for pecans and apples",
      "SNAP rules that change what shoppers can buy or who qualifies (affects demand)",
      "Workplace safety and labor rules for food plants; trucking safety rules for our fleet",
    ],
    doesNotApply: [
      "Aviation, airspace, aircraft airworthiness",
      "Banking, securities, crypto, sanctions",
      "Medicare/Medicaid payment rules, medical devices",
      "Mining, offshore oil and gas, fisheries",
      "Broadcast/TV licensing",
    ],
    areas: {
      "food-safety": { description: "Additives, dyes, labeling, food safety", owner: { name: "Maria Chen (Food Safety & Regulatory)", email: "foodsafety@brightside.example" } },
      sourcing: { description: "Ingredients from farms, pesticide limits, crop rules", owner: { name: "Tom Alvarez (Sourcing)", email: "sourcing@brightside.example" } },
      sales: { description: "Retail channels, SNAP, pricing", owner: { name: "Aisha Grant (Sales Compliance)", email: "sales@brightside.example" } },
      operations: { description: "Plant safety, labor, trucking fleet", owner: { name: "Ben Kowalski (Operations)", email: "ops@brightside.example" } },
    },
    generalCounsel: { name: "Rachel Stein (General Counsel)", email: "gc@brightside.example" },
  },
];

export const getProfile = (id: string) => {
  const p = PROFILES.find((x) => x.id === id);
  if (!p) throw new Error(`Unknown profile ${id}`);
  return p;
};

export function profileBrief(p: CompanyProfile): string {
  return [
    `Company: ${p.name}`,
    p.summary,
    `Rules that APPLY:\n- ${p.applies.join("\n- ")}`,
    `Rules that DO NOT apply:\n- ${p.doesNotApply.join("\n- ")}`,
  ].join("\n\n");
}
