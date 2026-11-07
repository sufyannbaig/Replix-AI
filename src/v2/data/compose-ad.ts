/**
 * Browser-only: sets a designed ad's type over its text-free photo and returns a JPEG.
 * buildAdLayout (pure, tested) gives the element tree, satori turns it into an SVG with the
 * text as vector paths, and a canvas rasterises it. Rendering on the server was too slow
 * (docs/V2_AD_DESIGN_PLAN.md, section 4), a browser does it in well under a second.
 */
import { FONT, buildAdLayout } from "@/lib/v2/ad-layouts";
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

let fontsLoading: Promise<
  { name: string; data: ArrayBuffer; weight: 400 | 500 | 700 | 800; style: "normal" }[]
> | null = null;

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
  const [{ default: satori }, fonts, photo] = await Promise.all([
    import("satori"),
    loadFonts(),
    inlinePhoto(photoUrl),
  ]);
  const { width, height, tree } = buildAdLayout({
    layout: design.layout,
    aspect: design.aspect,
    photo,
    copy: design.copy,
    colors: design.colors,
    labels: design.labels,
  });
  const svg = await satori(tree as unknown as Parameters<typeof satori>[0], {
    width,
    height,
    fonts,
  });
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
