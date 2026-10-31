import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AdPreview, type AdStyleId } from "@/components/AdPreview";

export type SocialPreviewProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  styleId: AdStyleId;
  imageUrl: string;
  imageAlt?: string;
  hook?: string | null;
  supporting?: string | null;
  caption?: string | null;
  cta?: string | null;
  badge?: string | null;
  brandName?: string | null;
  initialPlatform?: "instagram" | "facebook";
  finishedCreative?: boolean;
};

function handleFrom(name: string) {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "")
      .slice(0, 20) || "yourstore"
  );
}

export function SocialPreviewModal({
  open,
  onOpenChange,
  styleId,
  imageUrl,
  imageAlt = "",
  hook,
  supporting,
  caption,
  cta,
  badge,
  brandName,
  initialPlatform = "instagram",
  finishedCreative = false,
}: SocialPreviewProps) {
  const platform = initialPlatform;
  const name = (brandName?.trim() || "Your Store").slice(0, 28);
  const user = handleFrom(name);
  // Only ever show real headline copy — never fall back to the image alt/title
  // (which can be a raw filename) or the store name.
  const headline = hook?.trim() || "";
  const bodyText = caption?.trim() || supporting?.trim() || "";
  const showOverlay = Boolean(hook || cta);

  const creative = finishedCreative ? (
    <img src={imageUrl} alt={imageAlt || name} className="aspect-square w-full object-cover" />
  ) : (
    <AdPreview
      styleId={styleId}
      imageUrl={imageUrl}
      imageAlt={imageAlt}
      hook={hook ?? undefined}
      supporting={supporting ?? undefined}
      cta={cta ?? undefined}
      badge={badge ?? undefined}
      showOverlay={showOverlay}
      aspectRatio="1 / 1"
    />
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-sm overflow-y-auto rounded-3xl border-border bg-card p-6 shadow-soft">
        <DialogHeader className="text-left">
          <DialogTitle className="font-display text-lg font-bold">
            {platform === "instagram" ? "Instagram" : "Facebook"} preview
          </DialogTitle>
          <DialogDescription>
            This is how the creative would appear in the feed. Nothing will be published.
          </DialogDescription>
        </DialogHeader>

        <article className="overflow-hidden rounded-2xl border border-border bg-background shadow-soft">
          <div className="flex items-center gap-2 p-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-navy text-[0.65rem] font-bold uppercase text-navy-foreground">
              {name.slice(0, 1)}
            </span>
            <div className="min-w-0 leading-tight">
              <p className="truncate text-xs font-semibold">
                {platform === "instagram" ? user : name}
              </p>
              <p className="text-[0.65rem] text-muted-foreground">Sponsored</p>
            </div>
          </div>

          <div className="bg-muted/30">{creative}</div>

          <div className="space-y-2 p-3">
            {headline ? <p className="text-sm font-semibold">{headline}</p> : null}
            {bodyText ? <p className="text-xs text-muted-foreground">{bodyText}</p> : null}
            {cta ? (
              <Button className="brand-gradient w-full rounded-full text-white shadow-soft">
                {cta}
              </Button>
            ) : null}
          </div>
        </article>

        <Button
          variant="outline"
          className="w-full rounded-full shadow-soft"
          onClick={() => onOpenChange(false)}
        >
          Close preview
        </Button>
      </DialogContent>
    </Dialog>
  );
}
