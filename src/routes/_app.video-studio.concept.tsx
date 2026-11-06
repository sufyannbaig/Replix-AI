import { createFileRoute, Link } from "@tanstack/react-router";
import { Sparkles, X } from "lucide-react";
import { useRef, useState } from "react";
import { useGenerate } from "@/v2/components/studio/useGenerate";
import { cn } from "@/lib/utils";
import { AppShell } from "@/v2/components/shell/AppShell";
import { SectionTitle } from "@/v2/components/primitives";
import { LibraryPicker } from "@/v2/components/studio/LibraryPicker";
import { ComposerBar, missingHint } from "@/v2/components/studio/ComposerBar";
import { ProductPicker } from "@/v2/components/studio/ProductPicker";
import type { UploadedImage } from "@/v2/components/studio/UploadCard";
import { videoGenerationCost } from "@/v2/data/api";
import { uploadRef } from "@/v2/data/inputs";
import { VIDEO_LENGTHS } from "@/v2/data/pricing";
import type { AspectRatio, PieceKind, Product } from "@/v2/data/types";
import plusCircle from "@/assets/v2/icons/plus-circle.svg";

export const Route = createFileRoute("/_app/video-studio/concept")({
  head: () => ({ meta: [{ title: "Concept Ads · Replix AI" }] }),
  component: ConceptPage,
});

/* Figma writes "Fomo"; it's an acronym. */
const EMOTIONS = ["Humor", "Desire", "FOMO", "Pride", "Nostalgia", "Relief"] as const;
type Emotion = (typeof EMOTIONS)[number];

/* Story ads need room for a hook, build-up and payoff. */
/* Concept ads are 15 or 30 seconds; see VIDEO_LENGTHS in src/v2/data/pricing.ts. */
const DURATIONS = VIDEO_LENGTHS.concept;

/**
 * A large writing field with an AI action in the corner (Concept, Climax, Script).
 * Figma frame 543:97787: 1.5px border that runs warm yellow into soft blue.
 */
function StoryField({
  title,
  placeholder,
  value,
  onChange,
  actionLabel,
  onAction,
  actionDisabled,
  tall = false,
}: {
  title: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  actionLabel: string;
  onAction: () => void;
  actionDisabled?: boolean;
  tall?: boolean;
}) {
  return (
    <section className="flex flex-col gap-[30px]">
      <SectionTitle>{title}</SectionTitle>
      <div
        className={cn(
          "relative rounded-[14px] border-[1.5px] border-transparent",
          "[background:linear-gradient(var(--v2-surface),var(--v2-surface))_padding-box,linear-gradient(100deg,#f7d093,#a9bff0)_border-box]",
          tall ? "h-[206px]" : "h-[132px]",
        )}
      >
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          aria-label={title}
          className="size-full resize-none rounded-[14px] bg-transparent py-5 pl-[14px] pr-[170px] font-inter-tight text-sm leading-[1.4] text-v2-ink outline-none placeholder:text-v2-muted"
        />
        <button
          type="button"
          onClick={onAction}
          disabled={actionDisabled}
          title={actionDisabled ? "Add a product first" : undefined}
          className="absolute right-[14px] top-[17px] flex items-center gap-1.5 rounded-[60px] border border-[#a2a2a2] bg-v2-surface px-4 py-2 font-archivo text-xs leading-[1.4] text-black hover:bg-v2-canvas disabled:opacity-40 night:text-v2-ink"
        >
          <Sparkles className="size-3" />
          {actionLabel}
        </button>
      </div>
    </section>
  );
}

function SlotUpload({
  label,
  hint,
  value,
  onChange,
  acceptVideo,
  libraryKind,
}: {
  label: string;
  hint: string;
  libraryKind?: PieceKind;
  value: UploadedImage | null;
  onChange: (value: UploadedImage | null) => void;
  acceptVideo?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  return (
    <div className="relative flex flex-col gap-1.5">
      {libraryKind ? (
        <LibraryPicker
          kind={libraryKind}
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          onSelect={(piece) => onChange({ name: piece.name, url: piece.imageUrl })}
        />
      ) : null}
      <button
        type="button"
        onClick={() => input.current?.click()}
        className={cn(
          "flex h-[135px] w-full flex-col items-center justify-center gap-[17px] overflow-hidden rounded-[12px] border-[1.2px] border-dashed border-black/20 bg-[#f5f5f5] px-[30px] text-center transition-colors hover:border-v2-blue night:border-v2-border night:bg-v2-surface-2",
          value && "border-0 p-0",
        )}
      >
        {value ? (
          value.isVideo ? (
            <video
              src={value.url}
              className="size-full object-cover"
              muted
              loop
              autoPlay
              playsInline
            />
          ) : (
            <img src={value.url} alt="" className="size-full object-cover" />
          )
        ) : (
          <>
            <img src={plusCircle} alt="" className="size-6 opacity-70 night:invert" />
            <span className="flex flex-col gap-[5px]">
              <span className="type-label text-black/50 night:text-v2-ink-60">{label}</span>
              <span className="font-inter-tight text-xs text-v2-muted">{hint}</span>
            </span>
          </>
        )}
      </button>
      {libraryKind ? (
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="self-center font-inter-tight text-xs text-v2-muted underline underline-offset-2 hover:text-v2-ink"
        >
          or pick from Library
        </button>
      ) : null}
      {value ? (
        <button
          type="button"
          aria-label={`Remove ${label.toLowerCase()}`}
          onClick={() => onChange(null)}
          className="absolute right-2 top-2 flex size-6 items-center justify-center rounded-full bg-white/90 text-black shadow"
        >
          <X className="size-3.5" />
        </button>
      ) : null}
      <input
        ref={input}
        type="file"
        accept={
          acceptVideo ? "image/*,video/mp4,video/quicktime" : "image/png,image/jpeg,image/webp"
        }
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file)
            onChange({
              name: file.name,
              url: URL.createObjectURL(file),
              isVideo: file.type.startsWith("video/"),
            });
        }}
      />
    </div>
  );
}

function ConceptPage() {
  const { generate, pending: generating } = useGenerate();
  const [product, setProduct] = useState<Product | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [concept, setConcept] = useState("");
  const [climax, setClimax] = useState("");
  const [emotion, setEmotion] = useState<Emotion>("Humor");
  const [script, setScript] = useState("");
  const [character, setCharacter] = useState<UploadedImage | null>(null);
  const [scene, setScene] = useState<UploadedImage | null>(null);
  const [reference, setReference] = useState<UploadedImage | null>(null);
  const [aspect, setAspect] = useState<AspectRatio>("9:16");
  const [seconds, setSeconds] = useState(15);
  const [note, setNote] = useState("");

  const cost = videoGenerationCost(seconds);
  const productName = product?.name ?? "the product";

  /* Backend hook-up: these call the trained concept / ending / script models. */
  const suggest = {
    concept: () =>
      setConcept(
        `A barista is too tired to function until one taste of ${productName} turns the whole café into a slow-motion dessert commercial.`,
      ),
    climax: () =>
      setClimax(
        `The queue of customers all freeze mid-bite, then turn to camera in unison: "Where do we get ${productName}?"`,
      ),
    script: () =>
      setScript(
        `VO: Mornings are hard.\nBARISTA: (one sip) …oh.\nVO: ${productName}. Small spoon, big moment.`,
      ),
  };

  return (
    <AppShell
      title="Concept Ads"
      subtitle={
        <>
          <Link to="/video-studio" className="hover:underline">
            Video Studio
          </Link>{" "}
          › Concept Ads
        </>
      }
    >
      <div className="mt-[50px] flex flex-col gap-10 pb-[250px] sm:pb-[160px] xl:flex-row xl:items-start xl:gap-[62px]">
        <div className="flex min-w-0 flex-1 flex-col gap-[60px] xl:max-w-[686px]">
          <StoryField
            title="Concept"
            placeholder="e.g. A guy drinks our energy drink and gets so charged that when a mosquito bites him, the mosquito gets shocked."
            value={concept}
            onChange={setConcept}
            actionLabel="Suggest with AI"
            onAction={suggest.concept}
            actionDisabled={!product}
            tall
          />
          <StoryField
            title="Climax / ending"
            placeholder="How does the ad end? What's the payoff?"
            value={climax}
            onChange={setClimax}
            actionLabel="Suggest with AI"
            onAction={suggest.climax}
            actionDisabled={!product}
          />
          <section className="flex flex-col gap-[22px]">
            <SectionTitle>Target Emotion</SectionTitle>
            <div
              role="radiogroup"
              aria-label="Target emotion"
              className="flex flex-wrap items-center gap-[11px] self-start rounded-[34px] bg-v2-surface px-4 py-2"
            >
              {EMOTIONS.map((e) => (
                <button
                  key={e}
                  type="button"
                  role="radio"
                  aria-checked={emotion === e}
                  onClick={() => setEmotion(e)}
                  className={cn(
                    "flex h-7 items-center rounded-[50px] border-[0.7px] px-3 font-inter-tight text-sm tracking-[0.28px] transition-opacity",
                    emotion === e
                      ? "border-black bg-v2-surface text-black night:border-v2-ink night:text-v2-ink"
                      : "border-black/60 text-[#616161] opacity-45 hover:opacity-80 night:border-v2-border night:text-v2-ink-60",
                  )}
                >
                  {e}
                </button>
              ))}
            </div>
          </section>
          <StoryField
            title="Script"
            placeholder="Lines, voiceover or dialogue for the whole ad."
            value={script}
            onChange={setScript}
            actionLabel="Write with AI"
            onAction={suggest.script}
            actionDisabled={!product}
          />
        </div>

        <aside className="flex w-full shrink-0 flex-col gap-6 rounded-[14px] bg-v2-surface p-[26px] xl:sticky xl:top-6 xl:w-[292px]">
          <SlotUpload
            label="Character"
            hint="Click to upload"
            libraryKind="character"
            value={character}
            onChange={setCharacter}
          />
          <SlotUpload
            label="Scene"
            hint="Click to upload"
            libraryKind="scene"
            value={scene}
            onChange={setScene}
          />
          <SlotUpload
            label="Reference (optional)"
            hint="A video or image with the vibe you want"
            value={reference}
            onChange={setReference}
            acceptVideo
          />
        </aside>
      </div>

      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-20 flex justify-center px-4 lg:bottom-6 lg:left-[308px]">
        <div className="pointer-events-auto w-full max-w-[622px]">
          <ComposerBar
            product={product}
            onPickProduct={() => setPickerOpen(true)}
            aspect={aspect}
            onAspectChange={setAspect}
            count={1}
            onCountChange={() => undefined}
            duration={{ value: seconds, options: DURATIONS, onChange: setSeconds }}
            note={note}
            onNoteChange={setNote}
            notePlaceholder="Anything else the director should know? (optional)"
            cost={cost}
            canGenerate={!!product && !!concept.trim() && !!character && !!scene}
            generateHint={missingHint([
              !concept.trim() && "a concept",
              !character && "a character",
              !scene && "a scene",
              !product && "a product",
            ])}
            onGenerate={() =>
              generate({
                studio: "concept",
                kind: "video",
                inputs: {
                  studio: "concept",
                  concept: concept.trim(),
                  climax: climax.trim(),
                  emotion,
                  script: script.trim(),
                  character: uploadRef(character),
                  scene: uploadRef(scene),
                  reference: uploadRef(reference),
                },
                product: product!,
                style: { label: `${emotion} concept`, imageUrl: scene?.url },
                aspect,
                count: 1,
                seconds,
                note: concept.trim() || undefined,
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
    </AppShell>
  );
}
