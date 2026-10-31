import { createFileRoute, redirect } from "@tanstack/react-router";

/*
 * Old v1 pricing page. Plans and checkout now live on /upgrade (same Shopify / Stripe
 * flow); Stripe's cancel URL still points here, so its ?checkout= flag is passed on.
 */
export const Route = createFileRoute("/_app/pricing")({
  validateSearch: (search: Record<string, unknown>): { checkout?: string } =>
    typeof search.checkout === "string" ? { checkout: search.checkout } : {},
  beforeLoad: ({ search }) => {
    throw redirect({ to: "/upgrade", search, replace: true });
  },
});
