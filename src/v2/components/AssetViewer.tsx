import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  ExternalLink,
  Eye,
  ImagePlus,
  Megaphone,
  Wand2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { PillButton } from "@/v2/components/primitives";
import { ChannelPreviewDialog } from "@/v2/components/studio/ChannelPreview";
import { copyImage, fileSlug, saveFile } from "@/v2/components/saveFile";
import { useBrandKits } from "@/v2/data/api";
import { brandLogo, type AssetItem, type AssetKind, type StudioKey } from "@/v2/data/types";

/*
 * Assets viewer (2026-11-16), after the asset viewers in Midjourney, Krea, Canva and
 * Photoroom: a large preview on a dark stage, arrows and ← → keys through the current list,
 * the details beside it, and only the actions that fit this kind of asset: download and copy
 * for everything; feed preview and post copy for ads; open the result (edit, regenerate) for
 * generations; and "use it" links into the studios for uploads.
 */

const KIND_LABEL: Record<AssetKind, string> = {
  video: "Video",
  photo: "Photo",
  ad: "Ad",
  product: "Product",
  character: "Character",
  scene: "Scene",
  style: "Style or pose",
};

const STUDIO_LABEL: Record<StudioKey, string> = {
  photo: "Photo Studio",
  ad: "Ad Studio",
  ugc: "AI UGC Ads",
  shorts: "Product Shorts",
  concept: "Concept Ads",
};

const SIZE_LABEL: Record<string, string> = {
  "1:1": "1:1 Square",
  "4:5": "4:5 Portrait",
  "9:16": "9:16 Story",
  "16:9": "16:9 Wide",
};

export function AssetViewer({
  items,
  index,
  onIndex,
  onClose,
}: {
  items: AssetItem[];
  index: number | null;
  onIndex: (index: number) => void;
  onClose: () => void;
}) {
  const item = index === null ? undefined : items[index];
  const open = !!item;
  const [previewing, setPreviewing] = useState(false);
  const [busy, setBusy] = useState(false);
  const { data: kits = [] } = useBrandKits();
  const kit = kits[0];

  const step = (by: number) => {
    if (index === null || !items.length) return;
    onIndex((index + by + items.length) % items.length);
  };

  /* ← → step through the list (not while the feed preview is open on top). */
  useEffect(() => {
    if (!open || previewing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") step(1);
      else if (e.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- step reads the latest index
  }, [open, previewing, index, items.length]);

  if (!item) return null;
  const generated = item.origin === "generation";
  const pieceId = item.id.replace(/^asset_/, "");
  const stem = `replix-${fileSlug(item.title)}-${item.kind}`;
  const date = new Date(item.createdAt).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const details: [string, string][] = [
    ["Type", KIND_LABEL[item.kind]],
    ...(item.studio ? [["Made in", STUDIO_LABEL[item.studio]] as [string, string]] : []),
    ...(item.aspect ? [["Size", SIZE_LABEL[item.aspect] ?? item.aspect] as [string, string]] : []),
    [generated ? "Created" : "Added", date],
  ];

  const download = async () => {
    setBusy(true);
    try {
      /* Generated pictures carry the "made with AI" mark; the user's own uploads don't. */
      const ai = generated ? (item.kind === "ad" ? "composite" : "generated") : null;
      await saveFile(item.videoUrl ?? item.thumbnailUrl, stem, ai);
    } finally {
      setBusy(false);
    }
  };
  const copy = async () => {
    if (await copyImage(item.thumbnailUrl)) toast.success("Image copied");
    else toast.error("This browser can't copy images. Download it instead.");
  };
  const copyPost = async () => {
    const post = item.post;
    if (!post) return;
    const text = [post.primary, post.headline, post.description].filter(Boolean).join("\n\n");
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Post copy copied");
    } catch {
      toast.error("Couldn't copy. Open the result to copy it field by field.");
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => (o ? null : onClose())}>
        <DialogContent className="flex max-h-[94vh] w-[min(1100px,calc(100vw-24px))] max-w-none flex-col gap-0 overflow-hidden rounded-[18px] border-none bg-v2-surface p-0 text-v2-ink lg:flex-row [&>button:last-child]:hidden">
          {/* Stage */}
          <div className="relative flex min-h-[320px] flex-1 items-center justify-center bg-[#0f1115] p-4 sm:p-8 lg:min-h-[640px]">
            {item.videoUrl ? (
              <video
                key={item.id}
                src={item.videoUrl}
                poster={item.thumbnailUrl || undefined}
                controls
                autoPlay
                muted
                loop
                playsInline
                aria-label={item.title}
                className="max-h-[56vh] max-w-full rounded-[10px] bg-black object-contain shadow-[0_20px_60px_rgba(0,0,0,0.45)] lg:max-h-[80vh]"
              />
            ) : item.kind === "video" ? (
              <div className="relative">
                <img
                  src={item.thumbnailUrl}
                  alt={item.title}
                  className="max-h-[56vh] max-w-full rounded-[10px] object-contain lg:max-h-[80vh]"
                />
                <span className="absolute inset-x-0 bottom-3 mx-auto w-fit rounded-full bg-black/60 px-3 py-1 font-inter-tight text-xs text-white">
                  This video isn't ready to play
                </span>
              </div>
            ) : (
              <img
                key={item.id}
                src={item.thumbnailUrl}
                alt={item.title}
                className="max-h-[56vh] max-w-full rounded-[10px] object-contain shadow-[0_20px_60px_rgba(0,0,0,0.45)] lg:max-h-[80vh]"
              />
            )}
            {items.length > 1 ? (
              <>
                <button
                  type="button"
                  aria-label="Previous asset"
                  onClick={() => step(-1)}
                  className="absolute left-3 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur transition-colors hover:bg-white/20"
                >
                  <ChevronLeft className="size-5" />
                </button>
                <button
                  type="button"
                  aria-label="Next asset"
                  onClick={() => step(1)}
                  className="absolute right-3 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur transition-colors hover:bg-white/20"
                >
                  <ChevronRight className="size-5" />
                </button>
                <span className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1 font-inter-tight text-xs tabular-nums text-white/85">
                  {(index ?? 0) + 1} of {items.length}
                </span>
              </>
            ) : null}
          </div>

          {/* Panel */}
          <aside className="flex w-full shrink-0 flex-col gap-5 overflow-y-auto p-5 sm:p-6 lg:w-[320px]">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <span className="inline-flex rounded-full bg-v2-canvas px-2.5 py-1 font-inter-tight text-xs text-v2-ink-70 night:bg-v2-surface-2">
                  {KIND_LABEL[item.kind]}
                </span>
                <DialogTitle className="mt-2 break-words font-archivo text-xl font-medium capitalize leading-archivo tracking-[-0.6px]">
                  {item.title}
                </DialogTitle>
                <DialogDescription className="sr-only">
                  Preview and actions for this asset.
                </DialogDescription>
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={onClose}
                className="flex size-9 shrink-0 items-center justify-center rounded-full text-v2-ink-60 hover:bg-v2-canvas hover:text-v2-ink"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="flex flex-col gap-2.5">
              <PillButton onClick={download} disabled={busy} className="w-full">
                <Download className="size-4" /> {busy ? "Downloading…" : "Download"}
              </PillButton>
              {item.kind !== "video" ? (
                <PillButton variant="outline" onClick={copy} className="w-full">
                  <Copy className="size-4" /> Copy image
                </PillButton>
              ) : null}
              {item.kind === "ad" ? (
                <PillButton
                  variant="outline"
                  onClick={() => setPreviewing(true)}
                  className="w-full"
                >
                  <Eye className="size-4" /> Preview in the feed
                </PillButton>
              ) : null}
              {item.kind === "ad" && item.post ? (
                <PillButton variant="outline" onClick={copyPost} className="w-full">
                  <Copy className="size-4" /> Copy post text
                </PillButton>
              ) : null}
            </div>

            {/* What to do next with it */}
            <div className="flex flex-col gap-1 border-t border-v2-line pt-4">
              {generated && item.jobId ? (
                <NextLink
                  to="/generations/$jobId"
                  params={{ jobId: item.jobId }}
                  icon={item.kind === "photo" ? Wand2 : ExternalLink}
                  label={
                    item.kind === "photo" ? "Open to edit or regenerate" : "Open the full result"
                  }
                  onClick={onClose}
                />
              ) : null}
              {item.kind === "photo" ? (
                <NextLink to="/ad-studio" icon={Megaphone} label="Make an ad" onClick={onClose} />
              ) : null}
              {item.kind === "product" ? (
                <>
                  <NextLink
                    to="/photo-studio"
                    icon={ImagePlus}
                    label="Make product photos"
                    onClick={onClose}
                  />
                  <NextLink to="/ad-studio" icon={Megaphone} label="Make ads" onClick={onClose} />
                </>
              ) : null}
              {item.kind === "character" || item.kind === "scene" || item.kind === "style" ? (
                <NextLink
                  to="/photo-studio"
                  search={{ mode: "piece", use: pieceId }}
                  icon={ImagePlus}
                  label="Use in Photo Studio"
                  onClick={onClose}
                />
              ) : null}
            </div>

            <dl className="flex flex-col divide-y divide-v2-line border-t border-v2-line">
              {details.map(([label, value]) => (
                <div
                  key={label}
                  className="flex items-center justify-between gap-4 py-2.5 font-inter-tight text-sm"
                >
                  <dt className="text-v2-muted">{label}</dt>
                  <dd className="text-right text-v2-ink">{value}</dd>
                </div>
              ))}
            </dl>

            {item.post?.primary ? (
              <div className="flex flex-col gap-1.5">
                <p className="font-inter-tight text-xs text-v2-muted">Post text</p>
                <p className="line-clamp-6 whitespace-pre-line rounded-[10px] bg-v2-canvas px-3 py-2.5 font-inter-tight text-sm leading-[1.45] text-v2-ink night:bg-v2-surface-2">
                  {item.post.primary}
                </p>
              </div>
            ) : null}

            {items.length > 1 ? (
              <p className="mt-auto hidden font-inter-tight text-xs text-v2-muted lg:block">
                Use ← → to move between assets.
              </p>
            ) : null}
          </aside>
        </DialogContent>
      </Dialog>

      {item.kind === "ad" ? (
        <ChannelPreviewDialog
          key={item.id}
          open={previewing}
          onOpenChange={setPreviewing}
          image={item.thumbnailUrl}
          aspect={item.aspect ?? "1:1"}
          post={
            item.post ?? { primary: "", headline: item.title, description: "", cta: "Shop now" }
          }
          brand={{
            name: kit?.name || item.title,
            logo: kit ? brandLogo(kit) : null,
            website: kit?.website,
          }}
        />
      ) : null}
    </>
  );
}

const NEXT_LINK =
  "flex h-11 w-full items-center justify-between rounded-[60px] px-3 font-archivo text-sm font-medium text-v2-ink transition-colors hover:bg-v2-canvas night:hover:bg-v2-surface-2";

function NextLink({
  icon: Icon,
  label,
  onClick,
  to,
  params,
  search,
}: {
  icon: typeof ArrowRight;
  label: string;
  onClick: () => void;
  to: "/generations/$jobId" | "/photo-studio" | "/ad-studio";
  params?: { jobId: string };
  search?: { mode: "piece"; use: string };
}) {
  const body = (
    <>
      <span className="flex items-center gap-2.5">
        <Icon className="size-4 text-v2-ink-70" /> {label}
      </span>
      <ArrowRight className="size-4 text-v2-ink-60" />
    </>
  );
  if (to === "/generations/$jobId" && params)
    return (
      <Link to={to} params={params} onClick={onClick} className={NEXT_LINK}>
        {body}
      </Link>
    );
  if (to === "/photo-studio")
    return (
      <Link to={to} search={search ?? {}} onClick={onClick} className={NEXT_LINK}>
        {body}
      </Link>
    );
  return (
    <Link to="/ad-studio" onClick={onClick} className={NEXT_LINK}>
      {body}
    </Link>
  );
}
