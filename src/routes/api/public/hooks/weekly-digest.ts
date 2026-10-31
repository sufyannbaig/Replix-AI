import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendInternalTransactionalEmail } from "@/lib/email/send-internal.server";

/**
 * Scheduled hook (called weekly by pg_cron) that sends every user a digest
 * of their ad activity for the past 7 days. Idempotent per ISO week.
 *
 * Auth: requires the project's anon/publishable key in the `apikey` header,
 * matching the documented pg_cron pattern. The route lives under
 * /api/public/* so middleware does not redirect cron requests to /login.
 */
export const Route = createFileRoute("/api/public/hooks/weekly-digest")({
  server: {
    handlers: {
      GET: async () => {
        return Response.json({
          ok: true,
          info: "POST to trigger the weekly digest. Requires apikey header.",
        });
      },
      POST: async ({ request }) => {
        // Auth: requires a dedicated server-only secret. The previous
        // implementation accepted the public anon key, which is shipped in
        // the browser bundle and would let anyone trigger a mass email send.
        const provided =
          request.headers.get("x-cron-secret") || request.headers.get("apikey");
        const expected = process.env.WEEKLY_DIGEST_SECRET;
        if (!expected) {
          console.error("WEEKLY_DIGEST_SECRET is not configured");
          return new Response("Server misconfigured", { status: 500 });
        }
        if (!provided || provided !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }

        const since = new Date();
        since.setUTCDate(since.getUTCDate() - 7);
        const sinceIso = since.toISOString();
        const now = new Date();
        const isoWeek = `${now.getUTCFullYear()}-W${String(
          Math.ceil(
            ((now.getTime() - Date.UTC(now.getUTCFullYear(), 0, 1)) /
              86400000 +
              new Date(Date.UTC(now.getUTCFullYear(), 0, 1)).getUTCDay() +
              1) /
              7,
          ),
        ).padStart(2, "0")}`;
        const weekRange = `${since.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          timeZone: "UTC",
        })} – ${now.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          timeZone: "UTC",
        })}`;

        // Paginate through all auth users
        let processed = 0;
        let sent = 0;
        let page = 1;
        const perPage = 200;
        // Safety cap to avoid runaway loops
        const maxPages = 50;

        while (page <= maxPages) {
          const { data, error } = await supabaseAdmin.auth.admin.listUsers({
            page,
            perPage,
          });
          if (error) {
            console.error("listUsers failed", error);
            break;
          }
          const users = data?.users ?? [];
          if (users.length === 0) break;

          for (const u of users) {
            processed++;
            if (!u.email) continue;

            // Count ads in window + capture top hook
            const { data: ads, count } = await supabaseAdmin
              .from("ads")
              .select("hook, created_at", { count: "exact" })
              .eq("user_id", u.id)
              .gte("created_at", sinceIso)
              .order("created_at", { ascending: false })
              .limit(1);

            const adsGenerated = count ?? 0;
            if (adsGenerated === 0) continue; // skip inactive users

            const { data: profile } = await supabaseAdmin
              .from("profiles")
              .select("display_name")
              .eq("id", u.id)
              .maybeSingle();

            try {
              const result = await sendInternalTransactionalEmail({
                templateName: "weekly-digest",
                recipientEmail: u.email,
                idempotencyKey: `digest-${u.id}-${isoWeek}`,
                templateData: {
                  name: profile?.display_name ?? undefined,
                  adsGenerated,
                  topHook: ads?.[0]?.hook ?? "",
                  creditsUsed: adsGenerated,
                  weekRange,
                },
              });
              if (result.status === "enqueued") sent++;
            } catch (err) {
              console.error("weekly digest send failed", u.id, err);
            }
          }

          if (users.length < perPage) break;
          page++;
        }

        return Response.json({ ok: true, processed, sent, week: isoWeek });
      },
    },
  },
});
