/**
 * Browser-only: renders a Concept ad's designed end card (src/lib/v2/end-card.ts) as a JPEG,
 * with the brand's own fonts and logo, the same way designed ads are set (compose-ad.ts).
 */
import { buildEndCard, type EndCardInput } from "@/lib/v2/end-card";
import { brandFonts, inlinePhoto, loadFonts, loadLogo } from "./compose-ad";
import type { AdDesign, AspectRatio } from "./types";

export type EndCardRequest = {
  aspect: AspectRatio;
  /** Signed link to the product hero still. */
  stillUrl: string;
  tagline: string;
  brandName: string;
  productName: string;
  colors?: string[];
  /** Fonts and logo with signed links (see resolveBrandLinks in api.ts). */
  fonts?: AdDesign["fonts"];
  logo?: AdDesign["logo"];
  cta?: string;
};

export async function composeEndCard(req: EndCardRequest): Promise<Blob> {
  const [{ default: satori }, fonts, { dataUrl: still }, brand, logo] = await Promise.all([
    import("satori"),
    loadFonts(),
    inlinePhoto(req.stillUrl),
    req.fonts ? brandFonts({ fonts: req.fonts }).catch(() => null) : Promise.resolve(null),
    loadLogo({ logo: req.logo }),
  ]);
  const render = async (withBrand: boolean) => {
    const input: EndCardInput = {
      aspect: req.aspect,
      still,
      tagline: req.tagline,
      brandName: req.brandName,
      productName: req.productName,
      colors: req.colors,
      logo,
      cta: req.cta,
      ...(withBrand && brand ? { fonts: brand.names } : {}),
    };
    const { width, height, tree } = buildEndCard(input);
    const svg = await satori(tree as unknown as Parameters<typeof satori>[0], {
      width,
      height,
      fonts: withBrand && brand ? [...fonts, ...brand.files] : fonts,
    });
    return { width, height, svg };
  };
  /* A broken brand font file must never cost the card: retry with the card's own fonts. */
  const { width, height, svg } =
    brand && (brand.names.heading || brand.names.body)
      ? await render(true).catch(() => render(false))
      : await render(false);
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const g = canvas.getContext("2d");
    if (!g) throw new Error("No canvas");
    g.drawImage(img, 0, 0, width, height);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Empty canvas"))), "image/jpeg", 0.9),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}
