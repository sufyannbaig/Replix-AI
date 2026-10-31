/**
 * Client-safe Shopify app constants.
 * Keep this file free of server-only imports (crypto, process.env, etc.)
 */

export const APP_PLANS = {
  starter: { name: "Starter", price: 9.99, wasPrice: 19.99, credits: 30, trialDays: 7 },
  pro: { name: "Pro", price: 29, wasPrice: 59, credits: 100, trialDays: 7 },
  scale: { name: "Scale", price: 59, wasPrice: 99, credits: 300, trialDays: 7 },
} as const;

export type AppPlanKey = keyof typeof APP_PLANS;

/**
 * The Free plan is NOT a recurring subscription — every new account receives a
 * one-off promotional allowance of 100 AI ad generations. Once used up the
 * merchant must pick a paid plan (which then grants a monthly allowance).
 */
export const FREE_PLAN_TOTAL_ADS = 10;

export const FREE_PLAN = {
  name: "Free",
  price: 0,
  credits: FREE_PLAN_TOTAL_ADS,
} as const;

/** How many free ads a user has consumed out of their promotional 100. */
export function freeAdsUsed(creditsRemaining: number): number {
  return Math.max(0, Math.min(FREE_PLAN_TOTAL_ADS, FREE_PLAN_TOTAL_ADS - creditsRemaining));
}
