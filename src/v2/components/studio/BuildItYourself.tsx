import { Plus, X } from "lucide-react";
import { useRef } from "react";
import { UploadCard, type UploadedImage } from "@/v2/components/studio/UploadCard";
import sceneBack from "@/assets/v2/pieces/scene-02.png";
import sceneMiddle from "@/assets/v2/pieces/scene-01.png";
import sceneFront from "@/assets/v2/pieces/scene-03.png";
import castBack from "@/assets/v2/pieces/character-03.png";
import castMiddle from "@/assets/v2/pieces/character-02.png";
import castFront from "@/assets/v2/pieces/character-01.png";

export type DiySelection = {
  scene: UploadedImage | null;
  character: UploadedImage | null;
  props: UploadedImage[];
};

export const EMPTY_DIY: DiySelection = { scene: null, character: null, props: [] };

export const MAX_DIY_PROPS = 5;

const SceneArt = (
  <span aria-hidden className="absolute left-[calc(50%-96px)] top-[55px] h-[134px] w-[202px]">
    <img
      src={sceneBack}
      alt=""
      className="absolute left-[102.7px] top-[14.7px] h-[113.4px] w-[92.9px] rotate-[7.6deg] rounded-[6px] object-cover"
    />
    <img
      src={sceneMiddle}
      alt=""
      className="absolute left-[54.25px] top-[8.1px] h-[114.4px] w-[93px] rounded-[6px] object-cover"
    />
    <img
      src={sceneFront}
      alt=""
      className="absolute left-[8.3px] top-[7.2px] h-[113.4px] w-[93px] -rotate-[9.79deg] rounded-[6px] object-cover"
    />
    <span className="absolute left-[-11px] top-[84px] h-[50px] w-[207px] bg-gradient-to-b from-transparent to-[var(--v2-surface)]" />
  </span>
);

const CastArt = (
  <span aria-hidden className="absolute left-[calc(50%-103px)] top-[52px] h-[146px] w-[235px]">
    <img
      src={castBack}
      alt=""
      className="absolute left-[140.6px] top-[32px] h-[113.4px] w-[93px] rounded-[6px] object-cover"
    />
    <img
      src={castMiddle}
      alt=""
      className="absolute left-[72.6px] top-[18px] h-[113.4px] w-[93px] rounded-[6px] object-cover"
    />
    <img
      src={castFront}
      alt=""
      className="absolute left-[0.6px] top-0 h-[113.4px] w-[93px] rounded-[6px] border border-white object-cover"
    />
  </span>
);

/**
 * Photo Studio mode 3 (wireframe 544:170493; no final Figma screen): the user uploads
 * their own scene and, optionally, a character and up to five props. Same big upload
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
          />
          <Tip>A well-lit photo with a clear, empty spot where the product can sit.</Tip>
        </div>
        <div className="flex flex-col gap-3">
          <UploadCard
            title="Upload Your Character"
            subtitle="Optional: the model who holds your product"
            button="Upload Character"
            art={CastArt}
            value={value.character}
            onChange={(character) => onChange({ ...value, character })}
          />
          <Tip>One person, face and hands visible, on a plain background.</Tip>
        </div>
      </div>

      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-archivo text-xl font-medium leading-archivo tracking-[-0.4px] text-v2-ink">
            Props <span className="text-v2-muted">(optional)</span>
          </h2>
          <p className="font-inter-tight text-sm text-v2-muted">
            Up to {MAX_DIY_PROPS} items placed next to your product
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
    </div>
  );
}

function Tip({ children }: { children: string }) {
  return (
    <p className="px-1 font-inter-tight text-xs leading-[1.4] text-v2-muted">
      <span className="font-medium text-v2-ink-70">Tip:</span> {children}
    </p>
  );
}
