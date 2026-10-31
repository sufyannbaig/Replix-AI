import { useState, type RefObject } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AD_FORMATS, downloadCroppedImage, type StyledAdInputs } from "@/lib/ad-formats";

// Default export format: Instagram Feed Portrait (1080×1350) — the highest-
// engagement, most versatile ad size that crops well to other placements.
const DEFAULT_FORMAT = AD_FORMATS.find((f) => f.id === "ig_feed_portrait") ?? AD_FORMATS[0];

export function AdDownloadMenu({
  imageUrl,
  filenameStem,
  variant = "icon",
  styled,
  previewRef,
}: {
  imageUrl: string;
  filenameStem: string;
  variant?: "icon" | "button";
  styled?: StyledAdInputs;
  /**
   * Optional ref to the on-screen <AdPreview> element. When provided, the
   * export captures that exact node so the PNG is pixel-identical to what the
   * user sees.
   */
  previewRef?: RefObject<HTMLElement | null>;
}) {
  const [busy, setBusy] = useState(false);

  const handleExport = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    setBusy(true);
    try {
      await downloadCroppedImage(
        imageUrl,
        DEFAULT_FORMAT,
        filenameStem,
        styled,
        previewRef?.current ?? null,
      );
      toast.success("Ad exported");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      onClick={handleExport}
      disabled={busy}
      title="Export ad"
      aria-label="Export ad image"
      className={
        variant === "icon"
          ? "grid size-8 place-items-center rounded-full bg-background/80 text-foreground shadow-soft backdrop-blur hover:bg-background disabled:opacity-60"
          : "inline-flex items-center gap-2 rounded-full bg-brand-gradient px-5 py-2 text-sm font-semibold text-white shadow-soft transition hover:opacity-95 disabled:opacity-60"
      }
    >
      {busy ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
      {variant === "button" && (busy ? "Exporting..." : "Export")}
    </button>
  );
}
