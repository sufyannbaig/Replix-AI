/**
 * A logo for brands whose website blocks automatic reads (adidas.com, for one), or whose page
 * shows none we can find. Wikidata keeps the official logo of most known companies (property
 * P154) next to their official website (P856). We only take a logo from an entry whose website
 * is the same site the user typed, so we never put another company's logo on a kit.
 *
 * Only www.wikidata.org is called: its API also answers Commons file questions, and returns a
 * PNG thumbnail that browsers may load (it sends access-control-allow-origin: *).
 */

const API = "https://www.wikidata.org/w/api.php";
const USER_AGENT = "ReplixAI/1.0 (https://replixai.co.uk; brand kit logo lookup)";
const LOGO_WIDTH = 800;

type Snak = { datavalue?: { value?: unknown } };
type Claim = {
  rank?: "preferred" | "normal" | "deprecated";
  mainsnak?: Snak;
  qualifiers?: Record<string, unknown>;
};
export type WikidataEntity = { id?: string; claims?: Record<string, Claim[]> };

/** "www.adidas.com", "adidas.com/us" and "shop.adidas.com" are all the adidas.com site. */
export function siteKey(raw: string) {
  const host = (() => {
    try {
      return new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`).hostname;
    } catch {
      return "";
    }
  })()
    .toLowerCase()
    .replace(/^www\d?\./, "");
  const parts = host.split(".");
  /* Keep "brand.co.uk" whole; otherwise the last two labels. */
  const twoPartTld = parts.length >= 3 && /^(co|com|org|net|ac|gov)$/.test(parts[parts.length - 2]);
  return parts.slice(twoPartTld ? -3 : -2).join(".");
}

/** The current logo file of an entity, if its official website is the given site. */
export function logoFileFor(entity: WikidataEntity, site: string) {
  const claims = entity.claims ?? {};
  const sites = (claims.P856 ?? [])
    .map((c) => c.mainsnak?.datavalue?.value)
    .filter((v): v is string => typeof v === "string");
  if (!sites.some((s) => siteKey(s) === siteKey(site))) return null;
  const logos = (claims.P154 ?? []).filter(
    (c) =>
      c.rank !== "deprecated" &&
      typeof c.mainsnak?.datavalue?.value === "string" &&
      /* A logo with an end date (P582) is a retired one. */
      !c.qualifiers?.P582,
  );
  const pick = logos.find((c) => c.rank === "preferred") ?? logos[logos.length - 1];
  return (pick?.mainsnak?.datavalue?.value as string | undefined) ?? null;
}

async function wikidata<T>(params: Record<string, string>): Promise<T> {
  const url = new URL(API);
  for (const [k, v] of Object.entries({ ...params, format: "json", origin: "*" })) {
    url.searchParams.set(k, v);
  }
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    signal: AbortSignal.timeout(8_000),
  });
  if (!res.ok) throw new Error(`Wikidata answered ${res.status}`);
  return (await res.json()) as T;
}

/** A PNG link to the brand's official logo, or null. Never throws. */
export async function findBrandLogo(name: string, site: string): Promise<string | null> {
  try {
    const terms = [...new Set([name.trim(), siteKey(site).split(".")[0]].filter(Boolean))];
    const ids: string[] = [];
    for (const search of terms) {
      const found = await wikidata<{ search?: { id: string }[] }>({
        action: "wbsearchentities",
        search,
        language: "en",
        type: "item",
        limit: "7",
      });
      for (const r of found.search ?? []) if (!ids.includes(r.id)) ids.push(r.id);
      if (ids.length >= 7) break;
    }
    if (!ids.length) return null;

    const got = await wikidata<{ entities?: Record<string, WikidataEntity> }>({
      action: "wbgetentities",
      ids: ids.slice(0, 14).join("|"),
      props: "claims",
    });
    /* Keep search order: the best name match first. */
    const file = ids
      .map((id) => got.entities?.[id])
      .map((e) => (e ? logoFileFor(e, site) : null))
      .find(Boolean);
    if (!file) return null;

    const info = await wikidata<{
      query?: { pages?: Record<string, { imageinfo?: { thumburl?: string }[] }> };
    }>({
      action: "query",
      titles: `File:${file}`,
      prop: "imageinfo",
      iiprop: "url",
      iiurlwidth: String(LOGO_WIDTH),
    });
    const page = Object.values(info.query?.pages ?? {})[0];
    const thumb = page?.imageinfo?.[0]?.thumburl;
    if (!thumb) return null;
    const clean = new URL(thumb);
    clean.search = "";
    return clean.protocol === "https:" ? clean.toString() : null;
  } catch {
    return null;
  }
}
