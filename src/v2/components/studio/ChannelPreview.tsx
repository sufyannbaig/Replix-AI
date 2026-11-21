import { useState, type ReactNode } from "react";
import {
  ArrowDown,
  ArrowUp,
  Bookmark,
  ChevronRight,
  ChevronUp,
  Globe,
  Heart,
  MessageCircle,
  MoreHorizontal,
  Repeat2,
  Send,
  Share2,
  ThumbsUp,
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { AspectRatio } from "@/v2/data/types";

/*
 * See an ad the way it shows up in each channel's feed before posting it: Facebook,
 * Instagram feed, Stories and Reels, Reddit, X and LinkedIn. Mock-ups only; nothing is
 * posted. The chrome is drawn in each app's own light theme (not ours), so the ad is judged
 * against what people really scroll past. Brand name and logo come from the brand kit.
 */

export type ChannelPost = { primary: string; headline: string; description: string; cta: string };

export type ChannelBrand = { name: string; logo?: string | null; website?: string | null };

const CHANNELS = [
  { id: "facebook", label: "Facebook" },
  { id: "instagram", label: "Instagram" },
  { id: "story", label: "Stories & Reels" },
  { id: "reddit", label: "Reddit" },
  { id: "x", label: "X" },
  { id: "linkedin", label: "LinkedIn" },
] as const;

type ChannelId = (typeof CHANNELS)[number]["id"];

const RATIO: Record<AspectRatio, string> = {
  "1:1": "aspect-square",
  "4:5": "aspect-[4/5]",
  "9:16": "aspect-[9/16]",
  "16:9": "aspect-video",
};

/** Where each channel shows an ad of this shape, and how (cropped or letterboxed). */
function fitNote(channel: ChannelId, aspect: AspectRatio): string | null {
  if (channel === "story" && aspect !== "9:16")
    return "Stories and Reels are full-screen 9:16. A 9:16 ad fills the screen; this one sits in the middle on a blurred backdrop.";
  if ((channel === "x" || channel === "linkedin" || channel === "reddit") && aspect === "9:16")
    return "Tall 9:16 ads get cropped in this feed. Use 1:1 or 4:5 here.";
  if (channel === "instagram" && aspect === "16:9")
    return "Wide ads look small in the Instagram feed. 4:5 or 1:1 take up more of the screen.";
  return null;
}

const handleOf = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 24) || "yourstore";

const domainOf = (brand: ChannelBrand) => {
  const raw = brand.website?.trim();
  if (raw) {
    try {
      return new URL(raw.includes("://") ? raw : `https://${raw}`).hostname.replace(/^www\./, "");
    } catch {
      /* fall through */
    }
  }
  return `${handleOf(brand.name)}.com`;
};

/** Primary text cut where the app folds it ("… See more"). */
function folded(text: string, max: number, more: string) {
  const flat = text.replace(/\n+/g, " ");
  if (flat.length <= max) return <>{text}</>;
  return (
    <>
      {flat.slice(0, max).trimEnd()}… <span className="text-[#65676b]">{more}</span>
    </>
  );
}

function Avatar({ brand, size = 36 }: { brand: ChannelBrand; size?: number }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#12213d] font-semibold uppercase text-white"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {brand.logo ? (
        <img src={brand.logo} alt="" className="size-full bg-white object-contain p-[12%]" />
      ) : (
        brand.name.slice(0, 1)
      )}
    </span>
  );
}

function Creative({ image, aspect }: { image: string; aspect: AspectRatio }) {
  return (
    <div className={cn("w-full overflow-hidden bg-[#f0f2f5]", RATIO[aspect])}>
      <img src={image} alt="Your ad" className="size-full object-cover" />
    </div>
  );
}

type MockProps = { image: string; aspect: AspectRatio; post: ChannelPost; brand: ChannelBrand };

function Facebook({ image, aspect, post, brand }: MockProps) {
  return (
    <article className="bg-white text-[#050505]">
      <header className="flex items-center gap-2 px-3 pb-2 pt-3">
        <Avatar brand={brand} size={40} />
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-[15px] font-semibold">{brand.name}</p>
          <p className="flex items-center gap-1 text-[13px] text-[#65676b]">
            Sponsored · <Globe className="size-3" />
          </p>
        </div>
        <MoreHorizontal className="size-5 text-[#65676b]" />
      </header>
      {post.primary ? (
        <p className="whitespace-pre-line px-3 pb-3 text-[15px] leading-[1.33]">
          {folded(post.primary, 125, "See more")}
        </p>
      ) : null}
      <Creative image={image} aspect={aspect} />
      <div className="flex items-center gap-3 bg-[#f0f2f5] px-3 py-2.5">
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-[12px] uppercase text-[#65676b]">{domainOf(brand)}</p>
          <p className="truncate text-[15px] font-semibold">{post.headline}</p>
          {post.description ? (
            <p className="truncate text-[13px] text-[#65676b]">{post.description}</p>
          ) : null}
        </div>
        <span className="shrink-0 rounded-[6px] bg-[#e4e6eb] px-3 py-2 text-[14px] font-semibold">
          {post.cta}
        </span>
      </div>
      <footer className="flex justify-around border-t border-[#ced0d4] py-1.5 text-[14px] font-semibold text-[#65676b]">
        <span className="flex items-center gap-1.5">
          <ThumbsUp className="size-4" /> Like
        </span>
        <span className="flex items-center gap-1.5">
          <MessageCircle className="size-4" /> Comment
        </span>
        <span className="flex items-center gap-1.5">
          <Share2 className="size-4" /> Share
        </span>
      </footer>
    </article>
  );
}

function Instagram({ image, aspect, post, brand }: MockProps) {
  const handle = handleOf(brand.name);
  return (
    <article className="bg-white text-[#000]">
      <header className="flex items-center gap-2.5 px-3 py-2.5">
        <span className="rounded-full bg-gradient-to-tr from-[#feda75] via-[#d62976] to-[#4f5bd5] p-[2px]">
          <span className="block rounded-full bg-white p-[2px]">
            <Avatar brand={brand} size={28} />
          </span>
        </span>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-[14px] font-semibold">{handle}</p>
          <p className="text-[12px]">Sponsored</p>
        </div>
        <MoreHorizontal className="size-5" />
      </header>
      <Creative image={image} aspect={aspect} />
      <div className="flex items-center justify-between border-b border-[#dbdbdb] px-3 py-2.5 text-[14px] font-semibold text-[#0095f6]">
        {post.cta}
        <ChevronRight className="size-4" />
      </div>
      <div className="flex items-center gap-4 px-3 pt-2.5">
        <Heart className="size-6" />
        <MessageCircle className="size-6" />
        <Send className="size-6" />
        <Bookmark className="ml-auto size-6" />
      </div>
      {post.primary ? (
        <p className="whitespace-pre-line px-3 pb-3 pt-2 text-[14px] leading-[1.35]">
          <span className="font-semibold">{handle}</span> {folded(post.primary, 110, "more")}
        </p>
      ) : (
        <div className="pb-3" />
      )}
    </article>
  );
}

function Story({ image, aspect, post, brand }: MockProps) {
  const full = aspect === "9:16";
  return (
    <div className="relative mx-auto aspect-[9/16] w-full max-w-[300px] overflow-hidden rounded-[14px] bg-black text-white">
      {full ? (
        <img src={image} alt="Your ad" className="absolute inset-0 size-full object-cover" />
      ) : (
        <>
          <img
            src={image}
            alt=""
            className="absolute inset-0 size-full scale-125 object-cover opacity-70 blur-2xl"
          />
          <img
            src={image}
            alt="Your ad"
            className="absolute inset-x-0 top-1/2 w-full -translate-y-1/2 object-contain"
          />
        </>
      )}
      {/* Instagram keeps the top 14% and bottom 20% for its own controls. */}
      <div className="absolute inset-x-0 top-0 bg-gradient-to-b from-black/50 to-transparent px-3 pb-6 pt-2.5">
        <span className="block h-[2px] w-full rounded-full bg-white/40">
          <span className="block h-full w-1/3 rounded-full bg-white" />
        </span>
        <div className="mt-2.5 flex items-center gap-2">
          <Avatar brand={brand} size={28} />
          <span className="text-[13px] font-semibold">{handleOf(brand.name)}</span>
          <span className="text-[12px] text-white/80">Sponsored</span>
        </div>
      </div>
      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-1 bg-gradient-to-t from-black/55 to-transparent pb-5 pt-10">
        <ChevronUp className="size-5" />
        <span className="rounded-full bg-white px-4 py-1.5 text-[13px] font-semibold text-black">
          {post.cta}
        </span>
      </div>
    </div>
  );
}

function Reddit({ image, aspect, post, brand }: MockProps) {
  return (
    <article className="bg-white px-3 py-3 text-[#1c1c1c]">
      <header className="flex items-center gap-2 text-[12px]">
        <Avatar brand={brand} size={24} />
        <span className="font-semibold">u/{handleOf(brand.name)}</span>
        <span className="text-[#576f76]">· Promoted</span>
        <MoreHorizontal className="ml-auto size-4 text-[#576f76]" />
      </header>
      <p className="mt-2 text-[17px] font-semibold leading-snug">{post.headline}</p>
      <div className="mt-2 overflow-hidden rounded-[12px]">
        <Creative image={image} aspect={aspect === "9:16" ? "4:5" : aspect} />
      </div>
      <div className="mt-2 flex items-center justify-between gap-3">
        <span className="truncate text-[12px] text-[#576f76]">{domainOf(brand)}</span>
        <span className="shrink-0 rounded-full bg-[#0045ac] px-3.5 py-1.5 text-[13px] font-semibold text-white">
          {post.cta}
        </span>
      </div>
      <footer className="mt-2.5 flex items-center gap-2 text-[12px] font-semibold text-[#576f76]">
        <span className="flex items-center gap-1 rounded-full bg-[#eaedef] px-2.5 py-1.5">
          <ArrowUp className="size-4" /> Vote <ArrowDown className="size-4" />
        </span>
        <span className="flex items-center gap-1 rounded-full bg-[#eaedef] px-2.5 py-1.5">
          <MessageCircle className="size-4" /> 0
        </span>
        <span className="flex items-center gap-1 rounded-full bg-[#eaedef] px-2.5 py-1.5">
          <Share2 className="size-4" /> Share
        </span>
      </footer>
    </article>
  );
}

function X({ image, aspect, post, brand }: MockProps) {
  const handle = handleOf(brand.name);
  return (
    <article className="flex gap-2.5 bg-white px-3 py-3 text-[#0f1419]">
      <Avatar brand={brand} size={40} />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1 text-[15px] leading-tight">
          <span className="truncate font-bold">{brand.name}</span>
          <span className="truncate text-[#536471]">@{handle}</span>
          <MoreHorizontal className="ml-auto size-4 shrink-0 text-[#536471]" />
        </p>
        {post.primary ? (
          <p className="mt-0.5 whitespace-pre-line text-[15px] leading-[1.35]">
            {folded(post.primary, 200, "Show more")}
          </p>
        ) : null}
        <div className="mt-2.5 overflow-hidden rounded-[16px] border border-[#cfd9de]">
          <Creative image={image} aspect={aspect === "9:16" ? "1:1" : aspect} />
        </div>
        <p className="mt-1 text-[13px] text-[#536471]">From {domainOf(brand)}</p>
        <footer className="mt-2 flex items-center justify-between pr-6 text-[#536471]">
          <MessageCircle className="size-[18px]" />
          <Repeat2 className="size-[18px]" />
          <Heart className="size-[18px]" />
          <Share2 className="size-[18px]" />
        </footer>
        <p className="mt-1.5 text-[12px] text-[#536471]">Ad</p>
      </div>
    </article>
  );
}

function LinkedIn({ image, aspect, post, brand }: MockProps) {
  return (
    <article className="bg-white text-[rgba(0,0,0,0.9)]">
      <header className="flex items-center gap-2 px-3 pb-2 pt-3">
        <Avatar brand={brand} size={44} />
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-[14px] font-semibold">{brand.name}</p>
          <p className="text-[12px] text-[rgba(0,0,0,0.6)]">Promoted</p>
        </div>
        <MoreHorizontal className="size-5 text-[rgba(0,0,0,0.6)]" />
      </header>
      {post.primary ? (
        <p className="whitespace-pre-line px-3 pb-2.5 text-[14px] leading-[1.4]">
          {folded(post.primary, 150, "…more")}
        </p>
      ) : null}
      <Creative image={image} aspect={aspect === "9:16" ? "1:1" : aspect} />
      <div className="flex items-center gap-3 bg-[#eef3f8] px-3 py-2.5">
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-[14px] font-semibold">{post.headline}</p>
          <p className="truncate text-[12px] text-[rgba(0,0,0,0.6)]">{domainOf(brand)}</p>
        </div>
        <span className="shrink-0 rounded-full border border-[#0a66c2] px-3.5 py-1 text-[14px] font-semibold text-[#0a66c2]">
          {post.cta}
        </span>
      </div>
      <footer className="flex justify-around border-t border-[#e8e8e8] py-2 text-[13px] font-semibold text-[rgba(0,0,0,0.6)]">
        <span className="flex items-center gap-1.5">
          <ThumbsUp className="size-4" /> Like
        </span>
        <span className="flex items-center gap-1.5">
          <MessageCircle className="size-4" /> Comment
        </span>
        <span className="flex items-center gap-1.5">
          <Repeat2 className="size-4" /> Repost
        </span>
      </footer>
    </article>
  );
}

const MOCKS: Record<ChannelId, (p: MockProps) => ReactNode> = {
  facebook: Facebook,
  instagram: Instagram,
  story: Story,
  reddit: Reddit,
  x: X,
  linkedin: LinkedIn,
};

export function ChannelPreviewDialog({
  open,
  onOpenChange,
  image,
  aspect,
  post,
  brand,
  startOn,
}: {
  /** The tab to open on (LinkedIn for B2B ads); by default it follows the ad's shape. */
  startOn?: ChannelId;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  image: string;
  aspect: AspectRatio;
  post: ChannelPost;
  brand: ChannelBrand;
}) {
  const [channel, setChannel] = useState<ChannelId>(
    startOn ?? (aspect === "9:16" ? "story" : "facebook"),
  );
  const Mock = MOCKS[channel];
  const note = fitNote(channel, aspect);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[94vh] max-w-[460px] overflow-y-auto rounded-[18px] border-none bg-v2-surface p-5 text-v2-ink sm:p-6">
        <DialogTitle className="font-archivo text-2xl font-medium leading-archivo tracking-[-0.96px]">
          Preview in the feed
        </DialogTitle>
        <DialogDescription className="type-subtitle -mt-2 text-v2-muted">
          How this ad looks when it's posted. Nothing is published.
        </DialogDescription>
        <div role="tablist" aria-label="Channel" className="flex flex-wrap gap-2">
          {CHANNELS.map((c) => (
            <button
              key={c.id}
              type="button"
              role="tab"
              aria-selected={c.id === channel}
              onClick={() => setChannel(c.id)}
              className={cn(
                "h-9 rounded-[74px] px-4 font-archivo text-sm font-medium tracking-[-0.28px] transition-colors",
                c.id === channel
                  ? "bg-v2-pill text-v2-pill-ink"
                  : "bg-v2-canvas text-v2-ink-70 hover:text-v2-ink night:bg-v2-surface-2",
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
        <div
          role="tabpanel"
          style={{ fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" }}
          className={cn(
            "overflow-hidden rounded-[14px]",
            channel === "story"
              ? "bg-v2-canvas p-4"
              : "border border-v2-line shadow-[var(--v2-shadow-card)]",
          )}
        >
          <Mock image={image} aspect={aspect} post={post} brand={brand} />
        </div>
        {note ? <p className="font-inter-tight text-xs text-v2-muted">{note}</p> : null}
      </DialogContent>
    </Dialog>
  );
}
