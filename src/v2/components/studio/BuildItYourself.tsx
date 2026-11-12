import { Plus, X } from "lucide-react";
import { useRef, useState } from "react";
import { LibraryPicker } from "@/v2/components/studio/LibraryPicker";
import {
  StackArt,
  UploadCard,
  UploadTip,
  type UploadedImage,
} from "@/v2/components/studio/UploadCard";
import sceneBack from "@/assets/v2/catalog/scene/sunny-balcony.webp";
import sceneMiddle from "@/assets/v2/catalog/scene/marble-kitchen.webp";
import sceneFront from "@/assets/v2/catalog/scene/cafe-window-table.webp";
import castBack from "@/assets/v2/catalog/character/alliea.webp";
import castMiddle from "@/assets/v2/catalog/character/robert.webp";
import castFront from "@/assets/v2/catalog/character/sara.webp";

export type DiySelection = {
  scene: UploadedImage | null;
  character: UploadedImage | null;
  pose: UploadedImage | null;
  props: UploadedImage[];
};

export const EMPTY_DIY: DiySelection = { scene: null, character: null, pose: null, props: [] };

export const MAX_DIY_PROPS = 5;

const SceneArt = <StackArt images={[sceneBack, sceneMiddle, sceneFront]} />;
const CastArt = <StackArt images={[castBack, castMiddle, castFront]} />;

/**
 * Photo Studio mode 3 (wireframe 544:170493; no final Figma screen): the user uploads
 * their own scene and, optionally, a character, a pose and up to five props. Same big upload
 * cards as UGC custom mode, plus a short tip under each (wireframe "upload guidance").
 */
export function BuildItYourself({
  value,
  onChange,
}: {
  value: DiySelection;
  onChange: (value: DiySelection) => void;
}) {
  const propInput = useRef<HTMLInputElement>(null);
  const [picking, setPicking] = useState<"style" | "prop" | null>(null);
  const freeSlots = MAX_DIY_PROPS - value.props.length;

  return (
    <div className="flex flex-col gap-10">
      <div className="grid grid-cols-1 gap-10 md:grid-cols-2 md:gap-5 xl:gap-10">
        <div className="flex flex-col gap-3">
          <UploadCard
            title="Upload Your Scene"
            subtitle="Where your product is photographed"
            button="Upload Scene"
            art={SceneArt}
            value={value.scene}
            onChange={(scene) => onChange({ ...value, scene })}
            libraryKind="scene"
          />
          <UploadTip>
            A well-lit photo with a clear, empty spot where the product can sit.
          </UploadTip>
        </div>
        <div className="flex flex-col gap-3">
          <UploadCard
            title="Upload Your Character"
            subtitle="Optional: the model who holds your product"
            button="Upload Character"
            art={CastArt}
            value={value.character}
            onChange={(character) => onChange({ ...value, character })}
            libraryKind="character"
          />
          <UploadTip>One person, face and hands visible, on a plain background.</UploadTip>
        </div>
      </div>

      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="type-card-title text-v2-ink">
            Pose <span className="text-v2-muted">(optional)</span>
          </h2>
          <p className="font-inter-tight text-sm text-v2-muted">
            How your character holds or shows the product
          </p>
        </div>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-[repeat(5,120px)] sm:gap-4">
          {value.pose ? (
            <div className="group relative aspect-square overflow-hidden rounded-[12px] bg-v2-surface">
              <img src={value.pose.url} alt={value.pose.name} className="size-full object-cover" />
              <button
                type="button"
                aria-label={`Remove ${value.pose.name}`}
                onClick={() => onChange({ ...value, pose: null })}
                className="absolute right-1.5 top-1.5 flex size-6 items-center justify-center rounded-full bg-white/90 text-[#12213d] shadow-sm transition-opacity hover:bg-white sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
              >
                <X className="size-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setPicking("style")}
              aria-label="Choose a pose"
              className="flex aspect-square items-center justify-center rounded-[12px] border border-dashed border-[rgba(2,2,2,0.27)] bg-v2-surface text-v2-ink-60 transition-colors hover:border-v2-blue hover:text-v2-blue night:border-v2-border"
            >
              <Plus className="size-5" />
            </button>
          )}
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="type-card-title text-v2-ink">
            Props <span className="text-v2-muted">(optional)</span>
          </h2>
          <p className="font-inter-tight text-sm text-v2-muted">
            Up to {MAX_DIY_PROPS} items placed next to your product
            {freeSlots > 0 ? (
              <>
                {" · "}
                <button
                  type="button"
                  onClick={() => setPicking("prop")}
                  className="underline underline-offset-2 hover:text-v2-ink"
                >
                  pick from Library
                </button>
              </>
            ) : null}
          </p>
        </div>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-[repeat(5,120px)] sm:gap-4">
          {value.props.map((prop, i) => (
            <div
              key={prop.url}
              className="group relative aspect-square overflow-hidden rounded-[12px] bg-v2-surface"
            >
              <img src={prop.url} alt={prop.name} className="size-full object-cover" />
              <button
                type="button"
                aria-label={`Remove ${prop.name}`}
                onClick={() => onChange({ ...value, props: value.props.filter((_, j) => j !== i) })}
                className="absolute right-1.5 top-1.5 flex size-6 items-center justify-center rounded-full bg-white/90 text-[#12213d] shadow-sm transition-opacity hover:bg-white sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
              >
                <X className="size-3.5" />
              </button>
            </div>
          ))}
          {Array.from({ length: freeSlots }, (_, i) => (
            <button
              key={`empty-${i}`}
              type="button"
              onClick={() => propInput.current?.click()}
              aria-label="Add a prop"
              className="flex aspect-square items-center justify-center rounded-[12px] border border-dashed border-[rgba(2,2,2,0.27)] bg-v2-surface text-v2-ink-60 transition-colors hover:border-v2-blue hover:text-v2-blue night:border-v2-border"
            >
              <Plus className="size-5" />
            </button>
          ))}
        </div>
        <input
          ref={propInput}
          type="file"
          multiple
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => {
            const files = [...(e.target.files ?? [])].slice(0, freeSlots);
            e.target.value = "";
            if (!files.length) return;
            onChange({
              ...value,
              props: [
                ...value.props,
                ...files.map((file) => ({ name: file.name, url: URL.createObjectURL(file) })),
              ],
            });
          }}
        />
      </section>

      {picking ? (
        <LibraryPicker
          kind={picking}
          open
          onOpenChange={(open) => !open && setPicking(null)}
          onSelect={(piece) => {
            const picked = { name: piece.name, url: piece.imageUrl };
            if (piece.kind === "style") onChange({ ...value, pose: picked });
            else if (!value.props.some((p) => p.url === picked.url))
              onChange({ ...value, props: [...value.props, picked] });
          }}
        />
      ) : null}
    </div>
  );
}
