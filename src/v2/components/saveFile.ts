import { withAiMetadata, type AiSource } from "@/lib/v2/ai-metadata";

/**
 * Save a picture or video as a file. Generated files live on the storage domain, where the
 * browser ignores `download` and opens the file instead, so it is fetched first and saved
 * from a local blob. If the fetch fails it opens in a new tab, to save from there.
 */
export async function saveFile(url: string, stem: string, ai?: AiSource | null) {
  try {
    const fetched = await fetch(url).then((r) => {
      if (!r.ok) throw new Error(String(r.status));
      return r.blob();
    });
    const blob = ai ? await markAi(fetched, ai) : fetched;
    const href = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = href;
    link.download = `${stem}.${extensionOf(blob.type)}`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(href), 10_000);
  } catch {
    window.open(url, "_blank", "noopener");
  }
}

/**
 * Write the "made with AI" mark into a generated picture before it's saved (JPEG and PNG;
 * videos and other files are returned as they are). See src/lib/v2/ai-metadata.ts.
 */
export async function markAi(blob: Blob, source: AiSource): Promise<Blob> {
  if (blob.type !== "image/jpeg" && blob.type !== "image/png") return blob;
  try {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const marked = withAiMetadata(bytes, source);
    return marked === bytes ? blob : new Blob([marked.slice().buffer], { type: blob.type });
  } catch {
    return blob;
  }
}

export function extensionOf(type: string) {
  if (type.includes("jpeg")) return "jpg";
  if (type.includes("webp")) return "webp";
  if (type.includes("mp4")) return "mp4";
  return "png";
}

/** "Acme Glow Serum" → "acme-glow-serum", for file names. */
export function fileSlug(name: string) {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "replix"
  );
}

/**
 * Copy a picture to the clipboard. Browsers only take PNG there, so other formats are
 * redrawn as PNG first. Resolves false when the browser can't copy images.
 */
export async function copyImage(url: string): Promise<boolean> {
  if (typeof ClipboardItem === "undefined" || !navigator.clipboard?.write) return false;
  try {
    const png = (async () => {
      const blob = await fetch(url).then((r) => r.blob());
      if (blob.type === "image/png") return blob;
      const bitmap = await createImageBitmap(blob);
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      canvas.getContext("2d")?.drawImage(bitmap, 0, 0);
      return await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("png"))), "image/png"),
      );
    })();
    /* Safari needs the ClipboardItem made in the click, with a promise for the data. */
    await navigator.clipboard.write([new ClipboardItem({ "image/png": png })]);
    return true;
  } catch {
    return false;
  }
}
