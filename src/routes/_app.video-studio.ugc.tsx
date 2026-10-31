import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useCredits } from "@/hooks/use-credits";
import { cn } from "@/lib/utils";
import { AppShell } from "@/v2/components/shell/AppShell";
import { FilterTabs, PillButton, PillLink } from "@/v2/components/primitives";
import { ModeSwitcher, type StudioMode } from "@/v2/components/studio/ModeSwitcher";
import { ComposerBar, TemplateChip } from "@/v2/components/studio/ComposerBar";
import { ProductPicker } from "@/v2/components/studio/ProductPicker";
import { useUgcTemplates, videoGenerationCost } from "@/v2/data/api";
import type { AspectRatio, Product, UgcStyle, UgcTemplate } from "@/v2/data/types";
import artSkincare from "@/assets/v2/video/recent-01.png";
import artPouch from "@/assets/v2/video/recent-02.png";
import artSneaker from "@/assets/v2/video/recent-10.png";
import artSerum from "@/assets/v2/video/recent-07.png";
import artSoda from "@/assets/v2/gallery/e9c3b.png";
import artMocha from "@/assets/v2/gallery/d726d.png";
import artTruffle from "@/assets/v2/gallery/908f4.png";
import modeWand from "@/assets/v2/studio/mode-wand.svg";
import modeSliders from "@/assets/v2/studio/mode-sliders.svg";
import modeCrop from "@/assets/v2/studio/mode-crop.svg";

type UgcMode = "templates" | "custom";

export const Route = createFileRoute("/_app/video-studio/ugc")({
  validateSearch: (search: Record<string, unknown>): { mode?: UgcMode } =>
    search.mode === "custom" ? { mode: "custom" } : {},
  head: () => ({ meta: [{ title: "AI UGC Ads · Replix AI" }] }),
  component: UgcPage,
});

/* Tilted wall of creator clips (Figma 543:108096); offsets are each tile's box. */
const WALL: { src: string; left: number; top: number; radius: number }[] = [
  { src: artTruffle, left: 408, top: 166.4, radius: 14.8 },
  { src: artMocha, left: 223, top: 193.64, radius: 7.4 },
  { src: artSerum, left: 304, top: 128.45, radius: 12 },
  { src: artTruffle, left: 334, top: 234.51, radius: 14.8 },
  { src: artSneaker, left: 381, top: 59.36, radius: 12 },
  { src: artSoda, left: 196, top: 86.6, radius: 12 },
  { src: artSkincare, left: 277, top: 21.41, radius: 12 },
];

const TemplatesArt = (
  <span aria-hidden className="absolute inset-0 overflow-hidden rounded-[14px]">
    {WALL.map((tile, i) => (
      <span
        key={i}
        className="absolute flex h-[114.85px] w-[100.9px] items-center justify-center"
        style={{ left: tile.left, top: tile.top }}
      >
        <img
          src={tile.src}
          alt=""
          className="h-[99.6px] w-[78.7px] object-cover"
          style={{ borderRadius: tile.radius, transform: "rotate(-13.4deg) skewX(0.72deg)" }}
        />
      </span>
    ))}
    <span className="absolute left-[224px] top-[7px] h-[88px] w-[273px] bg-gradient-to-b from-[var(--v2-surface)] to-transparent" />
    <span className="absolute left-[224px] top-[169px] h-[88px] w-[276px] bg-gradient-to-t from-[var(--v2-surface)] to-transparent" />
  </span>
);

function Tile({
  bg,
  src,
  size,
  flip,
  style,
}: {
  bg: string;
  src: string;
  size: [number, number];
  flip?: boolean;
  style: React.CSSProperties;
}) {
  return (
    <span
      className="absolute flex size-10 items-center justify-center rounded-[8px] border-[0.8px] border-white shadow-[0_0_27.4px_rgba(0,0,0,0.1)]"
      style={{ background: bg, ...style }}
    >
      <img
        src={src}
        alt=""
        className={cn(flip && "-scale-y-100")}
        style={{ width: size[0], height: size[1] }}
      />
    </span>
  );
}

const CustomArt = (
  <span aria-hidden className="absolute inset-0 overflow-hidden rounded-[14px]">
    <img
      src={artSoda}
      alt=""
      className="absolute left-[191px] top-[105px] h-[158px] w-[136px] rounded-t-[12px] object-cover"
    />
    <Tile bg="#fef0bf" src={modeWand} size={[19.4, 19.4]} flip style={{ left: 321, top: 96 }} />
    <Tile bg="#e2ebfe" src={modeSliders} size={[14.5, 15]} style={{ left: 341, top: 150 }} />
    <Tile
      bg="linear-gradient(93.3deg, rgb(255,235,201) 0.24%, rgba(193,214,255,0.6) 99.77%)"
      src={modeWand}
      size={[19.4, 19.4]}
      flip
      style={{ left: 141, top: 96 }}
    />
    <span className="absolute left-[161px] top-[150px] flex size-10 items-center justify-center rounded-[8px] v2-brand-fill">
      <img src={modeCrop} alt="" className="size-[14.75px] -scale-y-100 invert" />
    </span>
    <span className="absolute bottom-0 left-0 h-[60px] w-full bg-gradient-to-t from-[var(--v2-surface)] to-transparent" />
  </span>
);

const MODES: readonly StudioMode<UgcMode>[] = [
  {
    value: "templates",
    title: "From Templates",
    description: "Pick a creator style, add your product",
    illustration: TemplatesArt,
  },
  {
    value: "custom",
    title: "Custom",
    description: "Your own character, scene and script",
    illustration: CustomArt,
  },
];

const STYLES: readonly { value: "all" | UgcStyle; label: string }[] = [
  { value: "all", label: "All" },
  { value: "tutorial", label: "Tutorial" },
  { value: "review", label: "Review" },
  { value: "unboxing", label: "Unboxing" },
  { value: "reveal", label: "Reveal" },
  { value: "try-on", label: "Try-on" },
];

/* UGC ads run 15–60s; 30s is the common default for TikTok and Reels. */
const DURATIONS = [15, 30, 45, 60] as const;

function UgcPage() {
  const { mode = "templates" } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const { plan, credits } = useCredits();
  const { data: templates = [] } = useUgcTemplates();

  const [style, setStyle] = useState<"all" | UgcStyle>("all");
  const [template, setTemplate] = useState<UgcTemplate | null>(null);
  const [locked, setLocked] = useState<UgcTemplate | null>(null);
  const [product, setProduct] = useState<Product | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [aspect, setAspect] = useState<AspectRatio>("9:16");
  const [seconds, setSeconds] = useState(30);
  const [script, setScript] = useState("");

  const visible = useMemo(
    () => templates.filter((t) => style === "all" || t.style === style),
    [templates, style],
  );
  const cost = videoGenerationCost(seconds);

  const choose = (t: UgcTemplate) => {
    if (t.isPro && plan === "free") setLocked(t);
    else setTemplate(t);
  };

  return (
    <AppShell
      title="Video Studio"
      subtitle={
        <>
          <Link to="/video-studio" className="hover:underline">
            Video Studio
          </Link>{" "}
          › AI UGC Ads
        </>
      }
    >
      <div className="mt-10 flex flex-col gap-10 pb-[160px]">
        <ModeSwitcher
          modes={MODES}
          value={mode}
          onChange={(next) => navigate({ search: next === "templates" ? {} : { mode: next } })}
        />

        {mode === "templates" ? (
          <div className="flex flex-col gap-[30px]">
            <FilterTabs
              label="Filter UGC templates"
              options={STYLES}
              value={style}
              onChange={setStyle}
              className="self-start"
            />
            {visible.length ? (
              <div className="grid grid-cols-2 gap-5 md:grid-cols-3 xl:grid-cols-4">
                {visible.map((t) => {
                  const active = template?.id === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => choose(t)}
                      aria-pressed={active}
                      aria-label={`${t.name}${t.isPro ? " (Pro)" : ""}`}
                      className={cn(
                        "group relative aspect-[244/353] overflow-hidden rounded-[12px] outline-none",
                        active && "ring-[1.7px] ring-[#124498]",
                      )}
                    >
                      <img
                        src={t.posterUrl}
                        alt=""
                        className={cn(
                          "size-full object-cover transition-transform duration-500 group-hover:scale-[1.04]",
                          active && "rounded-[12px] border-2 border-white",
                        )}
                      />
                      {t.isPro ? (
                        <span className="absolute right-[14px] top-[14px] rounded-[18px] bg-gradient-to-b from-[#d0ffb6] to-[#ffebc9] px-[14px] py-[7px] font-archivo text-base font-medium leading-archivo tracking-[-0.64px] text-[#12213d]">
                          Pro
                        </span>
                      ) : null}
                      <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 to-transparent p-3 text-left font-inter-tight text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">
                        {t.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="rounded-[18px] bg-v2-surface py-16 text-center font-inter-tight text-sm text-v2-muted">
                No {STYLES.find((s) => s.value === style)?.label.toLowerCase()} templates yet.
              </p>
            )}
          </div>
        ) : (
          <div className="flex h-[360px] items-center justify-center rounded-[18px] border border-dashed border-v2-border bg-v2-surface font-inter-tight text-sm text-v2-muted">
            Custom UGC is being built.
          </div>
        )}
      </div>

      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-20 flex justify-center px-4 lg:bottom-6 lg:left-[308px]">
        <div className="pointer-events-auto w-full max-w-[622px]">
          <ComposerBar
            product={product}
            onPickProduct={() => setPickerOpen(true)}
            chips={
              template ? <TemplateChip name={template.name} imageUrl={template.posterUrl} /> : null
            }
            aspect={aspect}
            onAspectChange={setAspect}
            count={1}
            onCountChange={() => undefined}
            duration={{ value: seconds, options: DURATIONS, onChange: setSeconds }}
            note={script}
            onNoteChange={setScript}
            notePlaceholder="What should the creator say? Type it, or let AI write it from your product."
            noteAction={
              <button
                type="button"
                disabled={!product}
                title={product ? undefined : "Add a product first"}
                onClick={() => {
                  // Backend hook-up: call the script writer with the product + template style.
                  setScript(
                    `I didn't expect ${product?.name ?? "this"} to be this good. Here's why it's in my bag every day…`,
                  );
                }}
                className="flex shrink-0 items-center gap-1 rounded-full bg-v2-nav-active px-2.5 py-1 font-archivo text-[11px] text-v2-ink disabled:opacity-40"
              >
                <Sparkles className="size-3" /> Write with AI
              </button>
            }
            cost={cost}
            canGenerate={!!product && !!template}
            onGenerate={() => {
              if (credits < cost) {
                toast.error(`You need ${cost} credits for this video.`, {
                  action: { label: "Upgrade", onClick: () => navigate({ to: "/upgrade" }) },
                });
                return;
              }
              toast.success("Video queued. Results will appear once generation is connected.");
            }}
          />
        </div>
      </div>

      <ProductPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onSelect={setProduct}
        initialSelectedId={product?.id}
      />

      <Dialog open={!!locked} onOpenChange={(open) => !open && setLocked(null)}>
        <DialogContent className="max-w-[420px] rounded-[18px] border-none bg-v2-surface p-0 text-v2-ink">
          {locked ? (
            <img
              src={locked.posterUrl}
              alt=""
              className="h-[240px] w-full rounded-t-[18px] object-cover"
            />
          ) : null}
          <div className="flex flex-col gap-3 p-6">
            <DialogTitle className="font-archivo text-2xl font-medium leading-archivo tracking-[-0.96px]">
              {locked?.name} is a Pro template
            </DialogTitle>
            <DialogDescription className="font-inter-tight text-sm leading-[1.41] text-v2-muted">
              Upgrade to use every premium UGC creator, Concept Ads and more credits each month.
            </DialogDescription>
            <div className="mt-2 flex gap-3">
              <PillLink to="/upgrade">See Plans</PillLink>
              <PillButton variant="outline" onClick={() => setLocked(null)}>
                Not now
              </PillButton>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
