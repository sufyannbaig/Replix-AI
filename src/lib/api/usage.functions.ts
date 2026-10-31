import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getMonthlyUsage = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const start = new Date();
    start.setUTCDate(1);
    start.setUTCHours(0, 0, 0, 0);

    const { data, error } = await supabase
      .from("usage_events")
      .select("variant_count, estimated_cost_usd")
      .eq("user_id", userId)
      .gte("created_at", start.toISOString());

    if (error) throw new Error(error.message);

    const adsThisMonth = (data ?? []).reduce(
      (n, r) => n + (r.variant_count ?? 0),
      0,
    );
    const estCostUsd = (data ?? []).reduce(
      (n, r) => n + Number(r.estimated_cost_usd ?? 0),
      0,
    );

    return {
      adsThisMonth,
      estCostUsd: Number(estCostUsd.toFixed(4)),
      periodStart: start.toISOString(),
    };
  });
