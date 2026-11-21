/**
 * Account housekeeping for 2.0 (V2_AUDIT items 7 and credit packs): delete one result,
 * delete the whole account and its files, and buy a one-off credit pack.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { creditPack } from "@/v2/data/pricing";

const APP_URL = "https://replixai.co.uk";
const USER_BUCKETS = ["outputs", "uploads", "ad-images"] as const;

/* New tables and RPCs aren't in the generated types yet: talk to them untyped. */
async function adminClient() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as SupabaseClient;
}

/** Every file under a folder, walking subfolders (Storage lists one level at a time). */
async function listAll(db: SupabaseClient, bucket: string, prefix: string): Promise<string[]> {
  const files: string[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await db.storage.from(bucket).list(prefix, { limit: 1000, offset });
    if (error || !data?.length) break;
    for (const item of data) {
      const path = `${prefix}/${item.name}`;
      if (item.id) files.push(path);
      else files.push(...(await listAll(db, bucket, path)));
    }
    if (data.length < 1000) break;
  }
  return files;
}

async function removeFiles(db: SupabaseClient, bucket: string, paths: string[]) {
  for (let i = 0; i < paths.length; i += 900) {
    await db.storage.from(bucket).remove(paths.slice(i, i + 900));
  }
}

/** Paths an output's copy points at (Edit text's clean photo, a design's own image). */
function copyPaths(copy: unknown): string[] {
  const c = copy as { photo?: unknown } | null;
  return typeof c?.photo === "string" ? [c.photo] : [];
}

/**
 * Delete one result: its picture, video and the clean photo behind Edit text. When it was
 * the job's last result, the job (and its folder) goes too. Credits are never touched.
 */
export const deleteGenerationOutput = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ outputId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const db = await adminClient();
    const { data: row } = await db
      .from("generation_outputs")
      .select("id, job_id, user_id, image_path, video_path, copy")
      .eq("id", data.outputId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!row) throw new Error("That result is already gone.");

    const own = (p: unknown): p is string =>
      typeof p === "string" && p.startsWith(`${context.userId}/`);
    const paths = [row.image_path, row.video_path, ...copyPaths(row.copy)].filter(own);
    if (paths.length) await removeFiles(db, "outputs", paths);
    await db.from("generation_outputs").delete().eq("id", row.id);

    const { count } = await db
      .from("generation_outputs")
      .select("id", { count: "exact", head: true })
      .eq("job_id", row.job_id);
    if (!count) {
      const { data: job } = await db
        .from("generation_jobs")
        .select("status")
        .eq("id", row.job_id)
        .maybeSingle();
      /* A running job keeps its row so it can still settle and refund. */
      if (job && job.status !== "queued" && job.status !== "running") {
        const rest = await listAll(db, "outputs", `${context.userId}/${row.job_id}`);
        if (rest.length) await removeFiles(db, "outputs", rest);
        await db.from("generation_jobs").delete().eq("id", row.job_id);
      }
    }
    return { deleted: true };
  });

/**
 * Delete the account: every file, every row, then the sign-in itself. A live paid plan has
 * to be cancelled first, so nobody keeps being charged for an account that no longer exists.
 */
export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ confirm: z.literal("DELETE") }).parse(data))
  .handler(async ({ context }) => {
    const db = await adminClient();
    const userId = context.userId;
    const { data: credits } = await db
      .from("user_credits")
      .select("plan, current_period_end")
      .eq("user_id", userId)
      .maybeSingle();
    const paidUntil = credits?.current_period_end ? Date.parse(credits.current_period_end) : 0;
    if (credits?.plan && credits.plan !== "free" && paidUntil > Date.now()) {
      throw new Error(
        "Cancel your plan in Billing first, then delete your account, so you aren't charged again.",
      );
    }

    for (const bucket of USER_BUCKETS) {
      const files = await listAll(db, bucket, userId);
      if (files.length) await removeFiles(db, bucket, files);
    }
    const { error: rowsError } = await db.rpc("v2_delete_account_rows", { _user: userId });
    if (rowsError) throw new Error("Couldn't delete your account. Please contact support.");
    const { error } = await db.auth.admin.deleteUser(userId);
    if (error) throw new Error("Couldn't delete your account. Please contact support.");
    return { deleted: true };
  });

/** Start a Stripe Checkout for a one-off credit pack. The webhook adds the credits. */
export const buyCreditPack = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ credits: z.number().int() }).parse(data))
  .handler(async ({ data, context }) => {
    const pack = creditPack(data.credits);
    if (!pack) throw new Error("Pick a credit pack.");
    const db = await adminClient();
    const userId = context.userId;

    const { data: installation } = await db
      .from("shopify_installations")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    if (installation) {
      throw new Error("Credit packs aren't available for accounts billed through Shopify yet.");
    }

    const { default: Stripe } = await import("stripe");
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
    const { data: profile } = await db
      .from("profiles")
      .select("stripe_customer_id")
      .eq("id", userId)
      .maybeSingle();
    let customerId: string | null = profile?.stripe_customer_id ?? null;
    if (!customerId) {
      const customer = await stripe.customers.create({ metadata: { user_id: userId } });
      customerId = customer.id;
      await db
        .from("profiles")
        .update({ stripe_customer_id: customerId, updated_at: new Date().toISOString() })
        .eq("id", userId);
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer: customerId,
      client_reference_id: userId,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: pack.usd * 100,
            product_data: { name: `Replix AI · ${pack.credits} credits` },
          },
        },
      ],
      metadata: { kind: "credit_pack", user_id: userId, credits: String(pack.credits) },
      success_url: `${APP_URL}/billing?pack=success`,
      cancel_url: `${APP_URL}/upgrade?checkout=cancelled`,
    });
    if (!session.url) throw new Error("Stripe checkout is not configured yet");
    return { checkoutUrl: session.url };
  });
