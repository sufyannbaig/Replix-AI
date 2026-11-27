/**
 * Brand fonts: the Google Fonts list (via Fontsource, which serves static font files the ad
 * renderer can read), and loading a font into the page for previews. Pure helpers are at the
 * top so they can be tested.
 */

export type GoogleFont = {
  /** Fontsource id, e.g. "instrument-serif". */
  id: string;
  family: string;
  category: string;
  weights: number[];
};

/** Fontsource ids are the family in lower case with spaces as dashes. */
export function fontsourceId(family: string) {
  return family
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** The weight closest to the one asked for, preferring heavier on a tie. */
export function nearestWeight(weights: number[], want: number) {
  if (!weights.length) return want;
  return [...weights].sort((a, b) => Math.abs(a - want) - Math.abs(b - want) || b - a)[0];
}

/** Static latin woff file on jsdelivr (satori can't read woff2 or variable fonts). */
export function googleFontFile(family: string, weight: number, format: "woff" | "woff2" = "woff") {
  return `https://cdn.jsdelivr.net/fontsource/fonts/${fontsourceId(family)}@latest/latin-${weight}-normal.${format}`;
}

/** Search the list by family name; families that start with the query come first. */
export function searchFonts(fonts: GoogleFont[], query: string, limit = 40) {
  const q = query.trim().toLowerCase();
  if (!q) return fonts.slice(0, limit);
  const starts: GoogleFont[] = [];
  const contains: GoogleFont[] = [];
  for (const f of fonts) {
    const name = f.family.toLowerCase();
    if (name.startsWith(q)) starts.push(f);
    else if (name.includes(q)) contains.push(f);
  }
  return [...starts, ...contains].slice(0, limit);
}

const w = (...weights: number[]) => weights;

/** Shown first, and used on its own if the Fontsource list can't be fetched. */
export const POPULAR_FONTS: GoogleFont[] = [
  ["Inter", "sans-serif", w(400, 500, 600, 700, 800)],
  ["Inter Tight", "sans-serif", w(400, 500, 600, 700, 800)],
  ["Archivo", "sans-serif", w(400, 500, 600, 700, 800)],
  ["Poppins", "sans-serif", w(400, 500, 600, 700, 800)],
  ["Montserrat", "sans-serif", w(400, 500, 600, 700, 800)],
  ["DM Sans", "sans-serif", w(400, 500, 600, 700)],
  ["Manrope", "sans-serif", w(400, 500, 600, 700, 800)],
  ["Plus Jakarta Sans", "sans-serif", w(400, 500, 600, 700, 800)],
  ["Work Sans", "sans-serif", w(400, 500, 600, 700, 800)],
  ["Outfit", "sans-serif", w(400, 500, 600, 700, 800)],
  ["Space Grotesk", "sans-serif", w(400, 500, 600, 700)],
  ["Sora", "sans-serif", w(400, 500, 600, 700, 800)],
  ["Lato", "sans-serif", w(400, 700, 900)],
  ["Open Sans", "sans-serif", w(400, 500, 600, 700, 800)],
  ["Roboto", "sans-serif", w(400, 500, 700, 900)],
  ["Nunito", "sans-serif", w(400, 500, 600, 700, 800)],
  ["Raleway", "sans-serif", w(400, 500, 600, 700, 800)],
  ["Anton", "sans-serif", w(400)],
  ["Bebas Neue", "display", w(400)],
  ["Oswald", "sans-serif", w(400, 500, 600, 700)],
  ["Barlow Condensed", "sans-serif", w(400, 500, 600, 700, 800)],
  ["Archivo Black", "sans-serif", w(400)],
  ["Syne", "sans-serif", w(400, 500, 600, 700, 800)],
  ["Playfair Display", "serif", w(400, 500, 600, 700, 800)],
  ["Instrument Serif", "serif", w(400)],
  ["DM Serif Display", "serif", w(400)],
  ["Fraunces", "serif", w(400, 500, 600, 700, 800)],
  ["Cormorant Garamond", "serif", w(400, 500, 600, 700)],
  ["EB Garamond", "serif", w(400, 500, 600, 700, 800)],
  ["Libre Baskerville", "serif", w(400, 700)],
  ["Lora", "serif", w(400, 500, 600, 700)],
  ["Merriweather", "serif", w(400, 700, 900)],
  ["Abril Fatface", "display", w(400)],
  ["Caveat", "handwriting", w(400, 500, 600, 700)],
  ["Pacifico", "handwriting", w(400)],
  ["Space Mono", "monospace", w(400, 700)],
].map(([family, category, weights]) => ({
  id: fontsourceId(family as string),
  family: family as string,
  category: category as string,
  weights: weights as number[],
}));

type FontsourceItem = {
  id: string;
  family: string;
  category: string;
  weights: number[];
  subsets: string[];
  variable?: boolean;
};

/** Every Google font with a latin subset, popular ones first. Falls back to POPULAR_FONTS. */
export async function fetchGoogleFonts(): Promise<GoogleFont[]> {
  try {
    const res = await fetch("https://api.fontsource.org/v1/fonts?type=google&subsets=latin");
    if (!res.ok) throw new Error(String(res.status));
    const items = (await res.json()) as FontsourceItem[];
    const all = items
      .filter((f) => f.subsets?.includes("latin") && f.weights?.length)
      .map((f) => ({ id: f.id, family: f.family, category: f.category, weights: f.weights }));
    const popular = new Set(POPULAR_FONTS.map((f) => f.id));
    return [
      ...POPULAR_FONTS.filter((p) => all.some((f) => f.id === p.id)),
      ...all.filter((f) => !popular.has(f.id)).sort((a, b) => a.family.localeCompare(b.family)),
    ];
  } catch {
    return POPULAR_FONTS;
  }
}

const loaded = new Map<string, Promise<boolean>>();

/**
 * Load a font into the page so previews can use it by family name. Google fonts come from
 * jsdelivr; uploaded fonts from their (signed) URL. Resolves false if it can't load.
 */
export function loadFontFace(family: string, opts: { url?: string; weight?: number } = {}) {
  if (typeof document === "undefined" || !family) return Promise.resolve(false);
  const weight = opts.weight ?? 400;
  const key = `${family}|${weight}|${opts.url ?? ""}`;
  let job = loaded.get(key);
  if (!job) {
    const src = opts.url ?? googleFontFile(family, weight, "woff2");
    job = new FontFace(family, `url(${JSON.stringify(src)})`, {
      weight: opts.url ? "100 900" : String(weight),
    })
      .load()
      .then((face) => {
        document.fonts.add(face);
        return true;
      })
      .catch(() => false);
    loaded.set(key, job);
  }
  return job;
}

/** Font file types a brand can upload, by extension. */
export const FONT_UPLOAD_TYPES: Record<string, string> = {
  ttf: "font/ttf",
  otf: "font/otf",
  woff: "font/woff",
};

/** "Acme_Sans-Bold.otf" -> "Acme Sans Bold". */
export function fontNameFromFile(fileName: string) {
  return (
    fileName
      .replace(/\.[^.]+$/, "")
      .replace(/[-_]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 80) || "Custom font"
  );
}
