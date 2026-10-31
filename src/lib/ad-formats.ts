// Platform-specific ad format specs and client-side image crop helpers.

export type AdFormatId =
  | "ig_story"
  | "ig_reel"
  | "ig_feed_square"
  | "ig_feed_portrait"
  | "fb_feed"
  | "fb_story";

export type AdFormat = {
  id: AdFormatId;
  label: string;
  platform: "instagram" | "facebook";
  width: number;
  height: number;
  // human-readable aspect (e.g. "9:16")
  aspect: string;
  description: string;
};

export const AD_FORMATS: AdFormat[] = [
  {
    id: "ig_story",
    label: "Instagram Story",
    platform: "instagram",
    width: 1080,
    height: 1920,
    aspect: "9:16",
    description: "Full-screen vertical",
  },
  {
    id: "ig_reel",
    label: "Instagram Reel",
    platform: "instagram",
    width: 1080,
    height: 1920,
    aspect: "9:16",
    description: "Vertical video / cover",
  },
  {
    id: "ig_feed_square",
    label: "Instagram Feed (Square)",
    platform: "instagram",
    width: 1080,
    height: 1080,
    aspect: "1:1",
    description: "Classic square post",
  },
  {
    id: "ig_feed_portrait",
    label: "Instagram Feed (Portrait)",
    platform: "instagram",
    width: 1080,
    height: 1350,
    aspect: "4:5",
    description: "Higher engagement portrait",
  },
  {
    id: "fb_feed",
    label: "Facebook Feed",
    platform: "facebook",
    width: 1200,
    height: 1500,
    aspect: "4:5",
    description: "Recommended feed size",
  },
  {
    id: "fb_story",
    label: "Facebook Story",
    platform: "facebook",
    width: 1080,
    height: 1920,
    aspect: "9:16",
    description: "Full-screen vertical",
  },
];

export function getFormatsForPlatform(platform: string): AdFormat[] {
  if (platform === "instagram") return AD_FORMATS.filter((f) => f.platform === "instagram");
  if (platform === "facebook") return AD_FORMATS.filter((f) => f.platform === "facebook");
  return AD_FORMATS;
}

/**
 * Load an image in a canvas-safe way.
 * Product images come from Shopify's CDN; drawing those URLs directly can
 * intermittently leave the export canvas blank/black in some browsers. Fetching
 * the bytes first and loading a data URL makes the final draw local and stable.
 */
async function loadImage(src: string): Promise<HTMLImageElement> {
  const safeSrc = /^https?:\/\//i.test(src) ? await fetchImageAsDataUrl(src) : src;
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "sync";
    img.onload = () => {
      if (img.naturalWidth <= 0 || img.naturalHeight <= 0) {
        reject(new Error("Loaded image has no dimensions"));
        return;
      }
      resolve(img);
    };
    img.onerror = () => reject(new Error("Could not load image for export"));
    img.src = safeSrc;
  });
}

async function fetchImageAsDataUrl(src: string): Promise<string> {
  const res = await fetch(src, { cache: "force-cache", mode: "cors" });
  if (!res.ok) throw new Error("Could not fetch image for export");
  const blob = await res.blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not prepare image for export"));
    reader.readAsDataURL(blob);
  });
}

/**
 * Center-crop + scale `srcUrl` to the target format dimensions and return a Blob.
 */
export async function cropImageToFormat(srcUrl: string, format: AdFormat): Promise<Blob> {
  const img = await loadImage(srcUrl);
  const canvas = document.createElement("canvas");
  canvas.width = format.width;
  canvas.height = format.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");

  const srcAspect = img.width / img.height;
  const dstAspect = format.width / format.height;

  // Cover-fit (center crop): scale so the smaller dimension fills, crop the rest.
  let sx = 0;
  let sy = 0;
  let sw = img.width;
  let sh = img.height;
  if (srcAspect > dstAspect) {
    // source is wider — crop sides
    sw = img.height * dstAspect;
    sx = (img.width - sw) / 2;
  } else {
    // source is taller — crop top/bottom
    sh = img.width / dstAspect;
    sy = (img.height - sh) / 2;
  }

  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, format.width, format.height);
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, format.width, format.height);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) reject(new Error("Export failed"));
      else resolve(blob);
    }, "image/png");
  });
}

// ---------- Styled export (DOM-based, pixel-matches AdPreview) ----------

export type StyledAdInputs = {
  style: "minimal" | "bold" | "luxury" | "fun";
  hook?: string | null;
  supporting?: string | null;
  cta?: string | null;
  badge?: string | null;
  brandColor?: string | null;
};

/**
 * Rasterize an offscreen React <AdPreview> at the target format's dimensions
 * so the exported PNG matches the preview pixel-for-pixel. Uses html-to-image
 * with a pixelRatio that upscales to the final format size.
 */
export async function renderStyledAdToBlob(
  srcUrl: string,
  format: AdFormat,
  styled: StyledAdInputs,
): Promise<Blob> {
  // Lazy-load heavy deps only when a styled export is requested.
  const [{ createRoot }, htmlToImage, { AdPreview }, React] = await Promise.all([
    import("react-dom/client"),
    import("html-to-image"),
    import("@/components/AdPreview"),
    import("react"),
  ]);

  // Ensure the source image is same-origin so it captures cleanly.
  const safeSrc = /^https?:\/\//i.test(srcUrl) ? await fetchImageAsDataUrl(srcUrl) : srcUrl;

  // Render at a fixed CSS width to keep layout stable, then upscale via pixelRatio.
  const CSS_WIDTH = 540;
  const cssHeight = Math.round((CSS_WIDTH * format.height) / format.width);

  const host = document.createElement("div");
  host.style.position = "fixed";
  host.style.left = "-10000px";
  host.style.top = "0";
  host.style.width = `${CSS_WIDTH}px`;
  host.style.height = `${cssHeight}px`;
  host.style.pointerEvents = "none";
  host.style.zIndex = "-1";
  host.setAttribute("aria-hidden", "true");
  document.body.appendChild(host);

  const showOverlay = Boolean(styled.hook || styled.cta);

  try {
    const root = createRoot(host);
    await new Promise<void>((resolve) => {
      root.render(
        React.createElement(AdPreview, {
          styleId: styled.style,
          imageUrl: safeSrc,
          imageAlt: "",
          hook: styled.hook ?? undefined,
          supporting: styled.supporting ?? undefined,
          cta: styled.cta ?? undefined,
          badge: styled.badge ?? undefined,
          brandColor: styled.brandColor ?? undefined,
          showOverlay,
          aspectRatio: `${format.width} / ${format.height}`,
        }),
      );
      // Wait for layout + image decode.
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });

    // Wait for the <img> inside the preview to fully decode.
    const imgEl = host.querySelector("img");
    if (imgEl && !imgEl.complete) {
      await new Promise<void>((resolve) => {
        imgEl.addEventListener("load", () => resolve(), { once: true });
        imgEl.addEventListener("error", () => resolve(), { once: true });
      });
    }
    // Let the ResizeObserver-based sizing settle, then one more frame for
    // filters/gradients to compose.
    await new Promise<void>((r) => setTimeout(r, 120));
    await new Promise<void>((r) => requestAnimationFrame(() => r()));

    const target = host.firstElementChild as HTMLElement;
    if (!target) throw new Error("Preview node missing");

    const pixelRatio = format.width / CSS_WIDTH;
    const blob = await htmlToImage.toBlob(target, {
      pixelRatio,
      cacheBust: true,
      width: CSS_WIDTH,
      height: cssHeight,
      backgroundColor: "#000000",
      style: { transform: "none" },
    });
    if (!blob) throw new Error("Export failed");

    // Unmount asynchronously to avoid React warning about unmount during render.
    setTimeout(() => root.unmount(), 0);
    return blob;
  } finally {
    setTimeout(() => {
      if (host.parentNode) host.parentNode.removeChild(host);
    }, 50);
  }
}

/**
 * Rasterize an already-rendered DOM element (the on-screen <AdPreview>) at the
 * target format's pixel dimensions. Because we capture the exact element the
 * user sees, the export is pixel-identical to the preview.
 */
export async function renderElementToBlob(
  element: HTMLElement,
  format: AdFormat,
): Promise<Blob> {
  const htmlToImage = await import("html-to-image");

  // Ensure any <img> inside has fully decoded before capture.
  const imgs = Array.from(element.querySelectorAll("img"));
  await Promise.all(
    imgs.map((img) =>
      img.complete && img.naturalWidth > 0
        ? Promise.resolve()
        : new Promise<void>((resolve) => {
            img.addEventListener("load", () => resolve(), { once: true });
            img.addEventListener("error", () => resolve(), { once: true });
          }),
    ),
  );
  await new Promise<void>((r) => requestAnimationFrame(() => r()));

  const rect = element.getBoundingClientRect();
  const cssWidth = rect.width || element.offsetWidth || 540;
  const pixelRatio = format.width / cssWidth;

  const blob = await htmlToImage.toBlob(element, {
    pixelRatio,
    cacheBust: true,
    backgroundColor: "#000000",
    style: { transform: "none" },
  });
  if (!blob) throw new Error("Export failed");
  return blob;
}


export async function downloadCroppedImage(
  srcUrl: string,
  format: AdFormat,
  filenameStem: string,
  styled?: StyledAdInputs,
  previewElement?: HTMLElement | null,
): Promise<void> {
  const blob = previewElement
    ? await renderElementToBlob(previewElement, format)
    : styled
      ? await renderStyledAdToBlob(srcUrl, format, styled)
      : await cropImageToFormat(srcUrl, format);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${sanitizeFilename(filenameStem)}-${format.id}-${format.width}x${format.height}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}


function sanitizeFilename(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "ad"
  );
}

