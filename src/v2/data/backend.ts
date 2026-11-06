/**
 * Client-side plumbing for the v2 data seam: who is signed in, whether the v2 tables exist
 * yet, signed URLs for private files, and uploads to the `uploads` bucket.
 *
 * The hooks in api.ts use the database when there is a signed-in user and the phase 0
 * migration has been applied; otherwise (dev `?preview=1`, or before Lovable runs the
 * migration) they fall back to the bundled sample data so the app keeps working.
 */
import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { V2Database } from "./db-types";

export const db = supabase as unknown as SupabaseClient<V2Database>;

export const UPLOADS_BUCKET = "uploads";

function isDevPreview() {
  return (
    import.meta.env.DEV &&
    typeof window !== "undefined" &&
    window.sessionStorage.getItem("replix-dev-preview") === "1"
  );
}

/* Tables found missing this page load; reset on reload (after the migration lands). */
const missingTables = new Set<string>();

/** PostgREST "relation does not exist" / "not in the schema cache". */
export function isMissingTable(error: PostgrestError | null) {
  if (!error) return false;
  return error.code === "42P01" || error.code === "PGRST205" || /schema cache/i.test(error.message);
}

/** The signed-in user's id when `table` can be used, otherwise null (use sample data). */
export async function backendUser(table: keyof V2Database["public"]["Tables"]) {
  if (typeof window === "undefined" || isDevPreview() || missingTables.has(table)) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

/**
 * Run a query; if the table doesn't exist yet, remember that and return null so the caller
 * falls back. Any other error is thrown so React Query shows it.
 */
export async function tryTable<T>(
  table: keyof V2Database["public"]["Tables"],
  run: () => PromiseLike<{ data: T | null; error: PostgrestError | null }>,
): Promise<T | null> {
  const { data, error } = await run();
  if (isMissingTable(error)) {
    missingTables.add(table);
    return null;
  }
  if (error) throw new Error(error.message);
  return data;
}

/* Signed URLs are reused until shortly before they expire, so images don't reload on refetch. */
const SIGNED_TTL_SECONDS = 60 * 60 * 6;
const signedCache = new Map<string, { url: string; expires: number }>();

/** True for a storage path (`<uid>/...`) rather than an absolute or bundled URL. */
export function isStoragePath(value: string) {
  return !/^(https?:|blob:|data:|\/)/i.test(value);
}

/** Resolve storage paths in the uploads bucket to signed URLs; other URLs pass through. */
export async function resolveUrls(values: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const now = Date.now();
  const toSign: string[] = [];
  for (const v of new Set(values)) {
    if (!v) continue;
    if (!isStoragePath(v)) out.set(v, v);
    else {
      const hit = signedCache.get(v);
      if (hit && hit.expires > now + 60_000) out.set(v, hit.url);
      else toSign.push(v);
    }
  }
  if (toSign.length) {
    const { data, error } = await supabase.storage
      .from(UPLOADS_BUCKET)
      .createSignedUrls(toSign, SIGNED_TTL_SECONDS);
    if (error) throw new Error(error.message);
    for (const item of data ?? []) {
      if (!item.path || !item.signedUrl) continue;
      signedCache.set(item.path, {
        url: item.signedUrl,
        expires: now + SIGNED_TTL_SECONDS * 1000,
      });
      out.set(item.path, item.signedUrl);
    }
  }
  return out;
}

const EXTENSIONS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
};

/** Upload a file to `<uid>/<folder>/<random>.<ext>` in the uploads bucket; returns the path. */
export async function uploadUserFile(userId: string, folder: string, file: Blob) {
  const ext = EXTENSIONS[file.type];
  if (!ext) throw new Error("Use a PNG, JPG or WebP image (or an MP4 / MOV video).");
  const path = `${userId}/${folder}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from(UPLOADS_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw new Error(error.message);
  return path;
}

/** Turn "my-product_photo.jpg" into "my product photo". */
export function nameFromFile(file: File, fallback: string) {
  return (
    file.name
      .replace(/\.[^.]+$/, "")
      .replace(/[-_]+/g, " ")
      .trim()
      .slice(0, 120) || fallback
  );
}
