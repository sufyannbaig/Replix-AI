import { createFileRoute, Link } from "@tanstack/react-router";
import { X } from "lucide-react";
import { AiButton } from "@/v2/components/studio/AiButton";
import { toast } from "sonner";
import { useEffect, useRef, useState } from "react";
import { useGenerate } from "@/v2/components/studio/useGenerate";
import { cn } from "@/lib/utils";
import { AppShell } from "@/v2/components/shell/AppShell";
import { SectionTitle } from "@/v2/components/primitives";
import { LibraryPicker } from "@/v2/components/studio/LibraryPicker";
import { ComposerBar, missingHint } from "@/v2/components/studio/ComposerBar";
import { ProductPicker } from "@/v2/components/studio/ProductPicker";
import { StudioSteps } from "@/v2/components/studio/StudioSteps";
import type { UploadedImage } from "@/v2/components/studio/UploadCard";
import { useWriteCopy, videoGenerationCost, type WriteField } from "@/v2/data/api";
import { uploadRef } from "@/v2/data/inputs";
import {
  TAKE_FORMAT_KEYS,
  TAKE_MODEL_KEYS,
  TAKE_MODELS,
  TAKE_SECONDS,
  takeAllowed,
  type TakeFormat,
  type TakeModel,
} from "@/lib/v2/one-take";
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
  onNeedProduct,
  busy = false,
  tall = false,
}: {
  title: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  actionLabel: string;
  onAction: () => void;
  actionDisabled?: boolean;
  onNeedProduct?: () => void;
  busy?: boolean;
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
        <AiButton
          label={actionLabel}
          busy={busy}
          needsProduct={actionDisabled}
          onClick={onAction}
          onNeedProduct={onNeedProduct}
          className="absolute right-[14px] top-[17px]"
        />
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

  /* Preview-only model test: the whole ad in one generation. */
  const [canTake, setCanTake] = useState(false);
  useEffect(() => setCanTake(takeAllowed(window.location.origin)), []);
  const [takeModel, setTakeModel] = useState<TakeModel | "">("");
  const [takeFormat, setTakeFormat] = useState<TakeFormat>("ritual");
  const [takeFrom, setTakeFrom] = useState("");
  const take =
    canTake && takeModel
      ? { model: takeModel, format: takeFormat, ...(takeFrom ? { from: takeFrom } : {}) }
      : undefined;

  const cost = take ? TAKE_MODELS[take.model].credits : videoGenerationCost(seconds);
  const productName = product?.name ?? "the product";

  /* "Suggest / Write with AI": the text model drafts the field from what's filled in. */
  const writer = useWriteCopy();
  const [writing, setWriting] = useState<WriteField | null>(null);
  const write = (field: "concept" | "climax" | "script", set: (v: string) => void) => () => {
    if (!product || writing) return;
    setWriting(field);
    writer.mutate(
      { product, field, concept, climax, emotion, script, seconds },
      {
        onSuccess: set,
        onError: (e) => toast.error(e instanceof Error ? e.message : "Couldn't write that."),
        onSettled: () => setWriting(null),
      },
    );
  };
  const suggest = {
    concept: write("concept", setConcept),
    climax: write("climax", setClimax),
    script: write("script", setScript),
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
      <div className="mt-10">
        <StudioSteps
          steps={[
            { label: "Product", done: !!product, onClick: () => setPickerOpen(true) },
            { label: "Concept", done: !!concept.trim() },
            { label: "Cast & scene", done: !!character && !!scene },
            { label: "Generate", done: false },
          ]}
        />
      </div>
      <div className="mt-10 flex flex-col gap-10 pb-[250px] sm:pb-[160px] xl:flex-row xl:items-start xl:gap-[62px]">
        <div className="flex min-w-0 flex-1 flex-col gap-[60px] xl:max-w-[686px]">
          <StoryField
            title="Concept"
            placeholder="e.g. A guy drinks our energy drink and gets so charged that when a mosquito bites him, the mosquito gets shocked."
            value={concept}
            onChange={setConcept}
            actionLabel="Suggest with AI"
            onAction={suggest.concept}
            actionDisabled={!product}
            onNeedProduct={() => setPickerOpen(true)}
            busy={writing === "concept"}
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
            onNeedProduct={() => setPickerOpen(true)}
            busy={writing === "climax"}
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
            onNeedProduct={() => setPickerOpen(true)}
            busy={writing === "script"}
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
          {canTake ? (
            <div className="flex flex-col gap-2 rounded-[12px] bg-v2-surface p-3 font-inter-tight text-xs text-v2-muted">
              <span className="font-semibold text-v2-ink">One-take test (preview only)</span>
              <select
                aria-label="One-take model"
                value={takeModel}
                onChange={(e) => setTakeModel(e.target.value as TakeModel | "")}
                className="h-8 rounded-[6px] bg-v2-canvas px-2 text-v2-ink"
              >
                <option value="">Off</option>
                {TAKE_MODEL_KEYS.map((k) => (
                  <option key={k} value={k}>
                    {TAKE_MODELS[k].name}, {TAKE_SECONDS} s
                  </option>
                ))}
              </select>
              <select
                aria-label="One-take format"
                value={takeFormat}
                onChange={(e) => setTakeFormat(e.target.value as TakeFormat)}
                className="h-8 rounded-[6px] bg-v2-canvas px-2 text-v2-ink"
              >
                {TAKE_FORMAT_KEYS.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
              <input
                aria-label="Reuse plan from job"
                value={takeFrom}
                onChange={(e) => setTakeFrom(e.target.value.trim())}
                placeholder="Reuse plan from job id (optional)"
                className="h-8 rounded-[6px] bg-v2-canvas px-2 text-v2-ink"
              />
            </div>
          ) : null}
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
                  ...(take ? { take } : {}),
                },
                product: product!,
                style: { label: `${emotion} concept`, imageUrl: scene?.url },
                aspect,
                count: 1,
                seconds: take ? TAKE_SECONDS : seconds,
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
