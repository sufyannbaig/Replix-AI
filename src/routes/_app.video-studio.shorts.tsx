import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useCredits } from "@/hooks/use-credits";
import { useGenerate } from "@/v2/components/studio/useGenerate";
import { cn } from "@/lib/utils";
import { HoverVideo } from "@/v2/components/HoverVideo";
import { AppShell } from "@/v2/components/shell/AppShell";
import { FilterTabs, PillButton, PillLink } from "@/v2/components/primitives";
import { ModeSwitcher, type StudioMode } from "@/v2/components/studio/ModeSwitcher";
import {
  ChipSelect,
  ComposerBar,
  missingHint,
  TemplateChip,
} from "@/v2/components/studio/ComposerBar";
import { ProductPicker } from "@/v2/components/studio/ProductPicker";
import {
  StackArt,
  UploadCard,
  UploadTip,
  type UploadedImage,
} from "@/v2/components/studio/UploadCard";
import { useShortTemplates, videoGenerationCost } from "@/v2/data/api";
import { uploadRef } from "@/v2/data/inputs";
import type { AspectRatio, Product, ShortStyle, ShortTemplate } from "@/v2/data/types";
import s1 from "@/assets/v2/catalog/short/studio-turn.webp";
import s2 from "@/assets/v2/catalog/short/floating.webp";
import s3 from "@/assets/v2/catalog/short/360-spin.webp";
import s5 from "@/assets/v2/catalog/short/dramatic-light.webp";
import s6 from "@/assets/v2/catalog/short/morning-light.webp";
import s7 from "@/assets/v2/catalog/short/splash.webp";
import sceneBack from "@/assets/v2/catalog/scene/pastel-blue-sweep.webp";
import sceneMiddle from "@/assets/v2/catalog/scene/marble-kitchen.webp";
import sceneFront from "@/assets/v2/catalog/scene/sand-linen-studio.webp";
import modeWand from "@/assets/v2/studio/mode-wand.svg";
import modeSliders from "@/assets/v2/studio/mode-sliders.svg";
import modeCrop from "@/assets/v2/studio/mode-crop.svg";

type ShortsMode = "templates" | "custom";

export const Route = createFileRoute("/_app/video-studio/shorts")({
  validateSearch: (search: Record<string, unknown>): { mode?: ShortsMode } =>
    search.mode === "custom" ? { mode: "custom" } : {},
  head: () => ({ meta: [{ title: "Product Shorts · Replix AI" }] }),
  component: ShortsPage,
});

/* Scattered template stills (Figma 543:20422), placed in the card's right half. */
const STILLS: { src: string; left: number; top: number; w: number; h: number }[] = [
  { src: s2, left: 214, top: 80, w: 74, h: 92 },
  { src: s5, left: 305, top: 15, w: 72, h: 92 },
  { src: s3, left: 307, top: 120, w: 72, h: 92 },
  { src: s6, left: 391, top: 52, w: 74, h: 92 },
  { src: s7, left: 406, top: 152, w: 72, h: 92 },
  { src: s1, left: 230, top: 186, w: 72, h: 70 },
];

const TemplatesArt = (
  <span
    aria-hidden
    className="absolute inset-0 rounded-[14px] max-xl:-translate-x-[130px] max-xl:translate-y-[60px]"
  >
    {STILLS.map((still, i) => (
      <img
        key={i}
        src={still.src}
        alt=""
        className="absolute rounded-[12px] object-cover"
        style={{ left: still.left, top: still.top, width: still.w, height: still.h }}
      />
    ))}
    <span className="absolute bottom-0 left-[200px] h-[70px] w-[300px] bg-gradient-to-t from-[var(--v2-surface)] to-transparent" />
  </span>
);

const CustomArt = (
  <span aria-hidden className="absolute inset-0 rounded-[14px] max-xl:-translate-x-[50px]">
    <img
      src={s2}
      alt=""
      className="absolute left-[118px] top-[148px] h-[112px] w-[78px] rounded-l-[12px] object-cover"
    />
    <img
      src={s5}
      alt=""
      className="absolute left-[196px] top-[105px] h-[158px] w-[136px] rounded-t-[12px] object-cover"
    />
    <img
      src={s6}
      alt=""
      className="absolute left-[332px] top-[148px] h-[112px] w-[60px] rounded-r-[12px] object-cover"
    />
    <span className="absolute left-[95px] top-[136px] flex size-10 items-center justify-center rounded-[8px] bg-[#f5b400]">
      <img src={modeCrop} alt="" className="size-[14.75px] -scale-y-100 invert" />
    </span>
    <span className="absolute left-[158px] top-[96px] flex size-10 items-center justify-center rounded-[8px] border-[0.8px] border-white bg-[#e2ebfe] shadow-[0_0_27.4px_rgba(0,0,0,0.1)]">
      <img src={modeWand} alt="" className="size-[19.4px] -scale-y-100" />
    </span>
    <span className="absolute left-[322px] top-[96px] flex size-10 items-center justify-center rounded-[8px] border-[0.8px] border-white bg-[#fef0bf] shadow-[0_0_27.4px_rgba(0,0,0,0.1)]">
      <img src={modeWand} alt="" className="size-[19.4px] -scale-y-100" />
    </span>
    <span className="absolute left-[372px] top-[148px] flex size-10 items-center justify-center rounded-[8px] border-[0.8px] border-white bg-[#e2ebfe] shadow-[0_0_27.4px_rgba(0,0,0,0.1)]">
      <img src={modeSliders} alt="" className="h-[15px] w-[14.5px]" />
    </span>
  </span>
);

/* Figma reuses the UGC copy on these cards; this is the Shorts wording from the wireframe. */
const MODES: readonly StudioMode<ShortsMode>[] = [
  {
    value: "templates",
    title: "From Templates",
    description: "Scene, lighting and motion already set",
    illustration: TemplatesArt,
  },
  {
    value: "custom",
    title: "Custom",
    description: "Your own scene, reference and motion",
    illustration: CustomArt,
  },
];

const STYLES: readonly { value: "all" | ShortStyle; label: string }[] = [
  { value: "all", label: "All" },
  { value: "studio", label: "Studio" },
  { value: "lifestyle", label: "Lifestyle" },
  { value: "floating", label: "Floating" },
  { value: "spin", label: "360 spin" },
  { value: "dramatic", label: "Dramatic light" },
];

const ANIMATIONS = ["Auto", "Camera pan", "Zoom in", "Zoom out", "Orbit", "Floating"] as const;
type Animation = (typeof ANIMATIONS)[number];

const animationLoop = (a: Animation) => `/v2/videos/chips/${a.toLowerCase().replace(" ", "-")}.mp4`;

const ANIMATION_OPTIONS = ANIMATIONS.map((value) => ({
  value,
  previewSrc: animationLoop(value),
}));

const SceneArt = <StackArt images={[sceneBack, sceneMiddle, sceneFront]} />;
const ReferenceArt = <StackArt images={[s7, s6, s5]} />;

/* Product Shorts are 5–10 second clips. */
const DURATIONS = [5, 8, 10] as const;

function ShortsPage() {
  const { mode = "templates" } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const { plan } = useCredits();
  const { generate, pending: generating } = useGenerate();
  const { data: templates = [] } = useShortTemplates();

  const [style, setStyle] = useState<"all" | ShortStyle>("all");
  const [template, setTemplate] = useState<ShortTemplate | null>(null);
  const [locked, setLocked] = useState<ShortTemplate | null>(null);
  const [product, setProduct] = useState<Product | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [aspect, setAspect] = useState<AspectRatio>("9:16");
  const [seconds, setSeconds] = useState(8);
  const [note, setNote] = useState("");
  const [scene, setScene] = useState<UploadedImage | null>(null);
  const [reference, setReference] = useState<UploadedImage | null>(null);
  const [animation, setAnimation] = useState<Animation>("Auto");

  const visible = useMemo(
    () => templates.filter((t) => style === "all" || t.styles.includes(style)),
    [templates, style],
  );
  const cost = videoGenerationCost(seconds);

  return (
    <AppShell
      title="Product Shorts"
      subtitle={
        <>
          <Link to="/video-studio" className="hover:underline">
            Video Studio
          </Link>{" "}
          › Product Shorts
        </>
      }
    >
      <div className="mt-10 flex flex-col gap-10 pb-[250px] sm:pb-[160px]">
        <ModeSwitcher
          modes={MODES}
          value={mode}
          onChange={(next) => navigate({ search: next === "templates" ? {} : { mode: next } })}
        />

        {mode === "templates" ? (
          <div className="flex flex-col gap-[30px]">
            <FilterTabs
              label="Filter shorts templates"
              options={STYLES}
              value={style}
              onChange={setStyle}
              className="self-start"
            />
            <div className="grid grid-cols-2 gap-x-5 gap-y-10 md:grid-cols-3 xl:grid-cols-4">
              {visible.map((t) => {
                const active = template?.id === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => (t.isPro && plan === "free" ? setLocked(t) : setTemplate(t))}
                    aria-pressed={active}
                    aria-label={`${t.name}${t.isPro ? " (Pro)" : ""}`}
                    className={cn(
                      "group relative aspect-[244/353] overflow-hidden rounded-[12px] outline-none",
                      active && "ring-[1.7px] ring-[#124498]",
                    )}
                  >
                    <HoverVideo
                      poster={t.posterUrl}
                      src={t.videoUrl}
                      active={active}
                      className={cn(active && "rounded-[12px] border-2 border-white")}
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
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-10 md:grid-cols-2 md:gap-5 xl:gap-10">
            <div className="flex flex-col gap-3">
              <UploadCard
                title="Upload Your Scene"
                subtitle="The background your product sits in"
                button="Upload Scene"
                art={SceneArt}
                value={scene}
                onChange={setScene}
                libraryKind="scene"
              />
              <UploadTip>
                A clear, empty spot in the frame gives the product room to move.
              </UploadTip>
            </div>
            <div className="flex flex-col gap-3">
              <UploadCard
                title="Upload a Reference"
                subtitle="Optional: an image or video of the motion you want"
                button="Upload Reference"
                art={ReferenceArt}
                value={reference}
                onChange={setReference}
                acceptVideo
              />
              <UploadTip>A short clip works best. We copy its motion, not its look.</UploadTip>
            </div>
          </div>
        )}
      </div>

      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-20 flex justify-center px-4 lg:bottom-6 lg:left-[308px]">
        <div className="pointer-events-auto w-full max-w-[622px]">
          <ComposerBar
            product={product}
            onPickProduct={() => setPickerOpen(true)}
            chips={
              mode === "templates" ? (
                template ? (
                  <TemplateChip name={template.name} imageUrl={template.posterUrl} />
                ) : null
              ) : (
                <ChipSelect
                  label="Animation"
                  value={animation}
                  options={ANIMATION_OPTIONS}
                  onChange={setAnimation}
                />
              )
            }
            aspect={aspect}
            onAspectChange={setAspect}
            count={1}
            onCountChange={() => undefined}
            duration={{ value: seconds, options: DURATIONS, onChange: setSeconds }}
            note={note}
            onNoteChange={setNote}
            notePlaceholder="Anything to add about the shot? (optional)"
            cost={cost}
            canGenerate={!!product && (mode === "templates" ? !!template : !!scene)}
            generateHint={missingHint([
              mode === "templates" ? !template && "a template" : !scene && "a scene",
              !product && "a product",
            ])}
            onGenerate={() =>
              generate({
                studio: "shorts",
                kind: "video",
                inputs:
                  mode === "templates" && template
                    ? { studio: "shorts", mode, templateId: template.id }
                    : {
                        studio: "shorts",
                        mode: "custom",
                        scene: uploadRef(scene),
                        motionReference: uploadRef(reference),
                        animation,
                      },
                product: product!,
                style:
                  mode === "templates" && template
                    ? { label: template.name, imageUrl: template.posterUrl }
                    : { label: `Custom · ${animation} animation`, imageUrl: scene?.url },
                aspect,
                count: 1,
                seconds,
                note: note.trim() || undefined,
                cost,
              })
            }
            generating={generating}
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
              Upgrade to use every premium motion template, Concept Ads and more credits each month.
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
