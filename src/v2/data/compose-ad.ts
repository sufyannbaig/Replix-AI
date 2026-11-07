/**
 * Browser-only: sets a designed ad's type over its text-free photo and returns a JPEG.
 * buildAdLayout (pure, tested) gives the element tree, satori turns it into an SVG with the
 * text as vector paths, and a canvas rasterises it. Rendering on the server was too slow
 * (docs/V2_AD_DESIGN_PLAN.md, section 4), a browser does it in well under a second.
 */
import { FONT, buildAdLayout } from "@/lib/v2/ad-layouts";
import { fontsourceId, googleFontFile, nearestWeight } from "./fonts";
import type { AdDesign } from "./types";

/* Static woff files (satori can't read woff2 or variable fonts), latin subset, cached by the CDN. */
const CDN = "https://cdn.jsdelivr.net/npm/@fontsource";
const FONT_FILES: { name: string; weight: 400 | 500 | 700 | 800; file: string }[] = [
  {
    name: FONT.sans,
    weight: 400,
    file: "inter-tight@5.1.0/files/inter-tight-latin-400-normal.woff",
  },
  {
    name: FONT.sans,
    weight: 500,
    file: "inter-tight@5.1.0/files/inter-tight-latin-500-normal.woff",
  },
  {
    name: FONT.sans,
    weight: 700,
    file: "inter-tight@5.1.0/files/inter-tight-latin-700-normal.woff",
  },
  { name: FONT.display, weight: 500, file: "archivo@5.1.0/files/archivo-latin-500-normal.woff" },
  { name: FONT.display, weight: 800, file: "archivo@5.1.0/files/archivo-latin-800-normal.woff" },
  { name: FONT.condensed, weight: 400, file: "anton@5.1.0/files/anton-latin-400-normal.woff" },
  {
    name: FONT.serif,
    weight: 400,
    file: "instrument-serif@5.1.0/files/instrument-serif-latin-400-normal.woff",
  },
];

type SatoriFont = {
  name: string;
  data: ArrayBuffer;
  weight: 400 | 500 | 700 | 800;
  style: "normal";
};

let fontsLoading: Promise<SatoriFont[]> | null = null;

function loadFonts() {
  fontsLoading ??= Promise.all(
    FONT_FILES.map(async (f) => {
      const res = await fetch(`${CDN}/${f.file}`);
      if (!res.ok) throw new Error(`Font ${f.file}: ${res.status}`);
      return {
        name: f.name,
        data: await res.arrayBuffer(),
        weight: f.weight,
        style: "normal" as const,
      };
    }),
  ).catch((error) => {
    fontsLoading = null; // try again next time
    throw error;
  });
  return fontsLoading;
}

/* ---------- brand fonts ---------- */

/* Our own names, so a brand font never clashes with a layout font of the same family. */
const BRAND_HEADING = "Replix Brand Heading";
const BRAND_BODY = "Replix Brand Body";
/* One file serves every weight a layout asks for, so satori never fakes or swaps a weight. */
const ALL_WEIGHTS = [400, 500, 700, 800] as const;

const fontFiles = new Map<string, Promise<ArrayBuffer | null>>();

function fetchFont(url: string) {
  let job = fontFiles.get(url);
  if (!job) {
    job = fetch(url)
      .then((res) => (res.ok ? res.arrayBuffer() : null))
      .then((data) => (data && isSatoriFont(data) ? data : null))
      .catch(() => null);
    fontFiles.set(url, job);
  }
  return job;
}

/** TTF, OTF or WOFF (satori reads these; not WOFF2). */
function isSatoriFont(data: ArrayBuffer) {
  if (data.byteLength < 12) return false;
  const tag = new TextDecoder("latin1").decode(new Uint8Array(data, 0, 4));
  return tag === "wOFF" || tag === "OTTO" || tag === "true" || tag === "\u0000\u0001\u0000\u0000";
}

const fontWeights = new Map<string, Promise<number[] | null>>();

/** The static weights Fontsource has for a Google family; null if unknown. */
function googleWeights(family: string) {
  const id = fontsourceId(family);
  let job = fontWeights.get(id);
  if (!job) {
    job = fetch(`https://api.fontsource.org/v1/fonts/${id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((info: { weights?: number[] } | null) => (info?.weights?.length ? info.weights : null))
      .catch(() => null);
    fontWeights.set(id, job);
  }
  return job;
}

/**
 * An uploaded file, or a Google family's weight closest to the first wanted one (one lookup,
 * one file). If the lookup fails, try the wanted weights in order.
 */
async function brandFontData(
  family: string | undefined,
  url: string | undefined,
  weights: number[],
) {
  if (!family) return null;
  if (url) return fetchFont(url);
  const known = await googleWeights(family);
  if (known) return fetchFont(googleFontFile(family, nearestWeight(known, weights[0])));
  for (const weight of weights) {
    const data = await fetchFont(googleFontFile(family, weight));
    if (data) return data;
  }
  return null;
}

let measureFaces = 0;

/** Canvas text width in the loaded heading font, for fitting headlines (see ad-layouts). */
async function measurer(data: ArrayBuffer) {
  const family = `Replix Measure ${++measureFaces}`;
  const face = await new FontFace(family, data.slice(0)).load();
  document.fonts.add(face);
  const g = document.createElement("canvas").getContext("2d");
  if (!g) return undefined;
  return (text: string, size: number) => {
    g.font = `${size}px "${family}"`;
    return g.measureText(text).width;
  };
}

/** Load the design's brand fonts. Anything that fails is left out; the layout font stays. */
async function brandFonts(design: AdDesign) {
  const f = design.fonts;
  const [heading, body] = await Promise.all([
    brandFontData(f?.heading, f?.files?.heading, [700, 800, 600, 400]),
    brandFontData(f?.body, f?.files?.body, [400, 500, 300]),
  ]);
  const files: SatoriFont[] = [];
  const as = (name: string, data: ArrayBuffer) =>
    ALL_WEIGHTS.forEach((weight) => files.push({ name, data, weight, style: "normal" }));
  if (heading) as(BRAND_HEADING, heading);
  if (body) as(BRAND_BODY, body);
  const measure = heading ? await measurer(heading).catch(() => undefined) : undefined;
  return {
    files,
    /* Without a measurer the brand heading can't be fitted safely, so it isn't used. */
    names: {
      ...(heading && measure ? { heading: BRAND_HEADING } : {}),
      ...(body ? { body: BRAND_BODY } : {}),
    },
    measure,
  };
}

/** The photo inlined, so the SVG has no outside links and the canvas stays exportable. */
async function inlinePhoto(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Photo: ${res.status}`);
  const blob = await res.blob();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/** Compose one ad. Rejects if anything fails; the caller keeps showing the photo then. */
export async function composeAd(design: AdDesign, photoUrl: string): Promise<Blob> {
  const [{ default: satori }, fonts, photo, brand] = await Promise.all([
    import("satori"),
    loadFonts(),
    inlinePhoto(photoUrl),
    design.fonts ? brandFonts(design).catch(() => null) : Promise.resolve(null),
  ]);
  const render = async (withBrand: boolean) => {
    const { width, height, tree } = buildAdLayout({
      layout: design.layout,
      aspect: design.aspect,
      photo,
      copy: design.copy,
      colors: design.colors,
      labels: design.labels,
      ...(withBrand && brand ? { fonts: brand.names, measure: brand.measure } : {}),
    });
    const svg = await satori(tree as unknown as Parameters<typeof satori>[0], {
      width,
      height,
      fonts: withBrand && brand ? [...fonts, ...brand.files] : fonts,
    });
    return { width, height, svg };
  };
  /* A broken brand font file must never cost the ad: retry with the layout's own fonts. */
  const useBrand = !!brand && (!!brand.names.heading || !!brand.names.body);
  const { width, height, svg } = useBrand
    ? await render(true).catch((error) => {
        console.warn("[v2 ads] brand font failed, using layout fonts", error);
        return render(false);
      })
    : await render(false);
  const svgUrl = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    const img = new Image();
    img.src = svgUrl;
    await img.decode();
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const g = canvas.getContext("2d");
    if (!g) throw new Error("No canvas");
    g.drawImage(img, 0, 0, width, height);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("Empty canvas"))),
        "image/jpeg",
        0.92,
      ),
    );
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}

/** Base64 without the data: prefix, for the save server function. */
export async function blobToBase64(blob: Blob) {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let bin = "";
  for (let i = 0; i < buf.length; i += 0x8000) {
    bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}
