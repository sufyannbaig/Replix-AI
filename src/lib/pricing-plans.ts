export type PricingPlanKey = "free" | "starter" | "pro" | "scale";

export type PricingPlan = {
  key: PricingPlanKey;
  name: string;
  desc: string;
  price: number;
  /** Original price shown crossed out to highlight the discount. Only for paid plans. */
  wasPrice?: number;
  /** Monthly generation allowance (for Free this is the one-off promo total). */
  ads: number;
  features: readonly string[];
  cta: string;
  highlight: boolean;
  label?: string;
};

/**
 * Single source of truth for the publicly displayed pricing.
 * Used by the landing page, the /pricing page, the install plan picker and the
 * sales assistant so everything quotes the same numbers.
 */
export const PRICING_PLANS: readonly PricingPlan[] = [
  {
    key: "free",
    name: "Free",
    desc: "Try Replix AI — 10 ads free",
    price: 0,
    ads: 10,
    features: [
      "10 AI ad generations",
      "AI ad creatives",
      "AI captions & hooks",
      "Basic creative styles",
      "Instagram/Facebook preview",
    ],
    cta: "Create 10 Free Ads",
    highlight: false,
    label: "10 Free Ads",
  },
  {
    key: "starter",
    name: "Starter",
    desc: "For small Shopify brands",
    price: 9.99,
    wasPrice: 19.99,
    ads: 30,
    features: [
      "30 AI generations/month",
      "All creative styles",
      "Edit captions & hooks",
      "Basic Brand DNA",
      "High-quality downloads",
    ],
    cta: "Start Starter",
    highlight: false,
  },
  {
    key: "pro",
    name: "Pro",
    desc: "For growing Shopify brands",
    price: 29,
    wasPrice: 59,
    ads: 100,
    features: [
      "100 AI generations/month",
      "Advanced Brand DNA",
      "Multiple creative concepts",
      "Premium creative styles",
      "Full creative library",
    ],
    cta: "Start Pro",
    highlight: true,
    label: "Most Popular",
  },
  {
    key: "scale",
    name: "Scale",
    desc: "For brands creating ads at scale",
    price: 59,
    wasPrice: 99,
    ads: 300,
    features: [
      "300 AI generations/month",
      "Advanced Brand DNA",
      "Multiple products",
      "Unlimited access to available creative styles",
      "Priority support",
    ],
    cta: "Start Scale",
    highlight: false,
  },
];

export const PAID_PRICING_PLANS = PRICING_PLANS.filter((p) => p.key !== "free");

export function formatPlanPrice(price: number): string {
  return price === 0 ? "$0" : `$${Number.isInteger(price) ? price : price.toFixed(2)}`;
}

export function pricingSummary(): string {
  return PRICING_PLANS.map(
    (p) =>
      `${p.name} — ${formatPlanPrice(p.price)}${p.key === "free" ? " (one-off 10 free ads, no subscription)" : "/month"}${
        p.label ? ` [${p.label}]` : ""
      }: ${p.features.join("; ")}`,
  ).join("\n");
}
