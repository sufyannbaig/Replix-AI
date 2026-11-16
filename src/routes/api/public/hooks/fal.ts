import { createFileRoute } from "@tanstack/react-router";

/**
 * fal.ai calls this when a Product Short's video is ready (docs/V2_VIDEO_PLAN.md).
 *
 * Nothing in the call is trusted: it only says "look at job X now". The job must be a
 * running Short whose stored fal request id matches the one in the call, and the result is
 * then fetched from fal with our own key (syncVideoJob), never taken from this body. The
 * result screen's poll does the same check, so a lost or blocked webhook only slows it.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const Route = createFileRoute("/api/public/hooks/fal")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const jobId = new URL(request.url).searchParams.get("job") ?? "";
        if (!UUID.test(jobId)) return new Response("Bad request", { status: 400 });
        const body = (await request.json().catch(() => null)) as { request_id?: unknown } | null;
        const requestId = typeof body?.request_id === "string" ? body.request_id : "";

        const { admin, syncVideoJob } = await import("@/lib/v2/generation.server");
        const { data: row } = await admin
          .from("generation_jobs")
          .select("*")
          .eq("id", jobId)
          .maybeSingle();
        if (!row || !requestId || row.provider_job_ids?.[0] !== requestId) {
          return new Response("Unknown job", { status: 404 });
        }
        await syncVideoJob(row, true);
        return Response.json({ ok: true });
      },
    },
  },
});
