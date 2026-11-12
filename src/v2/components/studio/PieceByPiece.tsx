import { Upload, X } from "lucide-react";
import { useRef } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { PillButton } from "@/v2/components/primitives";
import { StepBar } from "@/v2/components/studio/StudioSteps";
import { useAddLibraryUpload, usePieceOptions } from "@/v2/data/api";
import type { PieceKind, PieceOption } from "@/v2/data/types";
import plusSmall from "@/assets/v2/pieces/plus-small.svg";
import artBack from "@/assets/v2/catalog/scene/marble-kitchen.webp";
import artMiddle from "@/assets/v2/catalog/scene/sand-linen-studio.webp";
import artFront from "@/assets/v2/catalog/scene/pastel-blue-sweep.webp";

export type PieceSelection = {
  scene: PieceOption | null;
  props: PieceOption[];
  character: PieceOption | null;
  pose: PieceOption | null;
};

export const EMPTY_SELECTION: PieceSelection = {
  scene: null,
  props: [],
  character: null,
  pose: null,
};

/** Props can be stacked (a plant behind, something in hand); the others are single. */
const MAX_PROPS = 3;

const STEPS: { kind: PieceKind; label: string; plural: string }[] = [
  { kind: "scene", label: "Scene", plural: "Scene" },
  { kind: "prop", label: "Props", plural: "Props" },
  { kind: "character", label: "Character", plural: "Character" },
  { kind: "style", label: "Pose", plural: "Pose" },
];

export function pieceStepIndex(kind: PieceKind) {
  return Math.max(
    0,
    STEPS.findIndex((s) => s.kind === kind),
  );
}

/** The selection with one more piece in it (props stack, the rest replace). */
export function addPiece(selection: PieceSelection, piece: PieceOption): PieceSelection {
  if (piece.kind === "prop")
    return selection.props.some((p) => p.id === piece.id) || selection.props.length >= MAX_PROPS
      ? selection
      : { ...selection, props: [...selection.props, piece] };
  return { ...selection, [piece.kind === "style" ? "pose" : piece.kind]: piece };
}

/**
 * Scene → Props → Character → Pose stepper (the shared chevron bar). Steps are free
 * tabs: users can jump back to change a piece.
 */
function Stepper({ step, onStep }: { step: number; onStep: (index: number) => void }) {
  return (
    <StepBar
      tabs
      label="Shot steps"
      labels={STEPS.map((s) => s.label)}
      current={step}
      onSelect={onStep}
    />
  );
}

function UploadArt() {
  return (
    <span aria-hidden className="relative block h-[82px] w-[130px]">
      <img
        src={artBack}
        alt=""
        className="absolute left-[65.7px] top-[9.5px] h-[72.6px] w-[59.5px] rotate-[7.6deg] rounded-[5px] object-cover"
      />
      <img
        src={artMiddle}
        alt=""
        className="absolute left-[34.7px] top-[5.2px] h-[73.2px] w-[59.5px] rounded-[12px] object-cover"
      />
      <img
        src={artFront}
        alt=""
        className="absolute left-[5.3px] top-[4.6px] h-[72.5px] w-[59.5px] -rotate-[9.79deg] rounded-[5px] object-cover"
      />
    </span>
  );
}

function UploadTile({ label, onFile }: { label: string; onFile: (file: File) => void }) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="flex aspect-[249/281] flex-col items-center justify-center gap-2.5 rounded-[12px] border border-dashed border-[rgba(2,2,2,0.27)] bg-v2-surface night:border-v2-border">
      <UploadArt />
      <span className="flex flex-col items-center gap-1.5 text-center">
        <span className="font-archivo text-lg font-medium leading-archivo tracking-[-0.36px] text-v2-ink">
          Upload Your Own
        </span>
        <span className="font-inter-tight text-sm text-v2-muted">{label} Images</span>
      </span>
      <button
        type="button"
        onClick={() => input.current?.click()}
        className="flex items-center gap-1.5 rounded-[35px] border-[0.6px] border-[#a2a2a2] bg-v2-surface px-[14px] py-[7px] font-archivo text-[10.6px] leading-[1.4] text-black hover:bg-v2-canvas night:text-v2-ink"
      >
        <Upload className="size-3" />
        Upload Image
      </button>
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          if (!file.type.startsWith("image/")) {
            toast.error("Use a PNG, JPG or WEBP image.");
            return;
          }
          onFile(file);
        }}
      />
    </div>
  );
}

function SummarySlot({
  label,
  piece,
  extra,
  onClick,
  onRemove,
}: {
  label: string;
  piece: PieceOption | null;
  extra?: number;
  onClick: () => void;
  onRemove: () => void;
}) {
  if (!piece) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="flex h-[116px] w-full items-center justify-center gap-2 rounded-[12px] border-[1.2px] border-dashed border-black/20 bg-[#f5f5f5] font-archivo text-sm font-medium tracking-[-0.28px] text-black/50 hover:border-v2-blue night:border-v2-border night:bg-v2-surface-2 night:text-v2-ink-60"
      >
        <span
          aria-hidden
          className="v2-icon size-[11.15px]"
          style={{ maskImage: `url("${plusSmall}")`, WebkitMaskImage: `url("${plusSmall}")` }}
        />
        {label}
      </button>
    );
  }
  return (
    <div className="group relative h-[116px] w-full">
      <button
        type="button"
        onClick={onClick}
        aria-label={`Change ${label.toLowerCase()}: ${piece.name}`}
        className="size-full overflow-hidden rounded-[12px] border-2 border-white night:border-v2-surface-2"
        style={{ background: piece.background }}
      >
        <img
          src={piece.imageUrl}
          alt=""
          className={cn("size-full", piece.background ? "object-contain" : "object-cover")}
        />
      </button>
      {extra ? (
        <span className="absolute bottom-2 left-2 rounded-full bg-black/60 px-2 py-0.5 font-inter-tight text-[11px] text-white">
          +{extra} more
        </span>
      ) : null}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${label.toLowerCase()}`}
        className="absolute right-2 top-2 flex size-6 items-center justify-center rounded-full bg-white/90 text-black opacity-0 shadow transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}

export function PieceByPiece({
  step,
  onStep,
  selection,
  onChange,
  isFreePlan,
  onLocked,
}: {
  step: number;
  onStep: (index: number) => void;
  selection: PieceSelection;
  onChange: (next: PieceSelection) => void;
  isFreePlan: boolean;
  onLocked: (piece: PieceOption) => void;
}) {
  const current = STEPS[step];
  const { data: options = [] } = usePieceOptions(current.kind);
  const upload = useAddLibraryUpload();

  const isSelected = (piece: PieceOption) =>
    piece.kind === "prop"
      ? selection.props.some((p) => p.id === piece.id)
      : selection[piece.kind === "style" ? "pose" : piece.kind]?.id === piece.id;

  const toggle = (piece: PieceOption) => {
    if (piece.isPro && isFreePlan) {
      onLocked(piece);
      return;
    }
    if (piece.kind === "prop") {
      const has = selection.props.some((p) => p.id === piece.id);
      if (!has && selection.props.length >= MAX_PROPS) {
        toast(`You can add up to ${MAX_PROPS} props.`);
        return;
      }
      onChange({
        ...selection,
        props: has ? selection.props.filter((p) => p.id !== piece.id) : [...selection.props, piece],
      });
      return;
    }
    const slot = piece.kind === "style" ? "pose" : piece.kind;
    onChange({ ...selection, [slot]: isSelected(piece) ? null : piece });
  };

  const addUpload = (file: File) =>
    upload.mutate(
      { file, kind: current.kind },
      {
        onSuccess: toggle,
        onError: () => toast.error("Upload failed. Please try again."),
      },
    );

  return (
    <div className="flex flex-col gap-[29px] xl:flex-row xl:items-start">
      <div className="flex min-w-0 flex-1 flex-col gap-8">
        <Stepper step={step} onStep={onStep} />
        {current.kind === "style" && !selection.character ? (
          <p className="-mt-3 font-inter-tight text-sm text-v2-muted">
            Poses apply when your shot has a character.{" "}
            <button
              type="button"
              onClick={() => onStep(pieceStepIndex("character"))}
              className="text-v2-ink underline underline-offset-2"
            >
              Choose a character
            </button>
          </p>
        ) : null}
        <div className="grid grid-cols-2 gap-x-5 gap-y-6 md:grid-cols-3 xl:gap-y-10">
          <UploadTile label={current.label} onFile={addUpload} />
          {options.map((piece) => {
            const active = isSelected(piece);
            return (
              <button
                key={piece.id}
                type="button"
                onClick={() => toggle(piece)}
                aria-pressed={active}
                aria-label={`${piece.name}${piece.isPro ? " (Pro)" : ""}`}
                className={cn(
                  "group relative aspect-[249/281] overflow-hidden rounded-[12px] outline-none",
                  active && "ring-[1.7px] ring-[#124498]",
                )}
                style={{ background: piece.background }}
              >
                <img
                  src={piece.imageUrl}
                  alt=""
                  className={cn(
                    "size-full transition-transform duration-500 ease-out group-hover:scale-[1.04]",
                    piece.background ? "object-contain" : "object-cover",
                    active && "rounded-[12px] border-2 border-white",
                  )}
                />
                {piece.isPro ? (
                  <span className="absolute right-[14px] top-[14px] rounded-[18px] bg-gradient-to-b from-[#d0ffb6] to-[#ffebc9] px-[14px] py-[7px] font-archivo text-base font-medium leading-archivo tracking-[-0.64px] text-[#12213d]">
                    Pro
                  </span>
                ) : null}
                <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 to-transparent p-3 text-left font-inter-tight text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">
                  {piece.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <aside className="flex w-full shrink-0 flex-col gap-5 rounded-[14px] bg-v2-surface p-5 xl:sticky xl:top-6 xl:w-[226px]">
        <h3 className="type-label text-v2-ink">Your Shot</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-1 xl:gap-4">
          <SummarySlot
            label="Scene"
            piece={selection.scene}
            onClick={() => onStep(0)}
            onRemove={() => onChange({ ...selection, scene: null })}
          />
          <SummarySlot
            label="Props"
            piece={selection.props[0] ?? null}
            extra={selection.props.length - 1}
            onClick={() => onStep(1)}
            onRemove={() => onChange({ ...selection, props: [] })}
          />
          <SummarySlot
            label="Character"
            piece={selection.character}
            onClick={() => onStep(2)}
            onRemove={() => onChange({ ...selection, character: null })}
          />
          <SummarySlot
            label="Pose"
            piece={selection.pose}
            onClick={() => onStep(3)}
            onRemove={() => onChange({ ...selection, pose: null })}
          />
        </div>
        {step < STEPS.length - 1 ? (
          <PillButton variant="outline" className="w-full" onClick={() => onStep(step + 1)}>
            Next: {STEPS[step + 1].plural}
          </PillButton>
        ) : null}
      </aside>
    </div>
  );
}
