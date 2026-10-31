/** Longest edge sent to the AI models — bigger than this adds cost, not quality. */
const MAX_EDGE = 2048;
/** Hard limit on an uploaded file. */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const MAX_UPLOAD_LABEL = "10MB";

function canvasToDataUrl(img: HTMLImageElement): string {
  const scale = Math.min(1, MAX_EDGE / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.naturalWidth * scale);
  canvas.height = Math.round(img.naturalHeight * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not read that image.");
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.88);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not read that image."));
    img.src = src;
  });
}

/** Turn any image URL (including bundled product photos) into a compact data URL. */
export async function urlToDataUrl(src: string): Promise<string> {
  const img = await loadImage(src);
  return canvasToDataUrl(img);
}

/** Turn an uploaded file into a compact data URL. */
export async function fileToDataUrl(file: File): Promise<string> {
  if (file.size > MAX_UPLOAD_BYTES) {
    const mb = (file.size / (1024 * 1024)).toFixed(1);
    throw new Error(
      `That image is ${mb}MB. Please upload a photo of ${MAX_UPLOAD_LABEL} or less.`,
    );
  }
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await loadImage(objectUrl);
    return canvasToDataUrl(img);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/** Download an image URL as a file. */
export async function downloadImage(url: string, filename: string) {
  const res = await fetch(url);
  const blob = await res.blob();
  const href = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = href;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(href);
}
