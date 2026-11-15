import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  AspectRatio,
  Product,
  ShotAngle,
  ShotColumn,
  ShotLight,
  ShotRow,
  ShotSettings,
  ShotSize,
} from "@/v2/data/types";

export const DEFAULT_SHOT: ShotSettings = {
  size: "medium",
  position: "middle-center",
  angle: "eye",
  light: "scene",
};

const SIZES: { value: ShotSize; label: string }[] = [
  { value: "small", label: "Small" },
  { value: "medium", label: "Medium" },
  { value: "large", label: "Large" },
];
const ANGLES: { value: ShotAngle; label: string }[] = [
  { value: "eye", label: "Eye level" },
  { value: "above", label: "From above" },
  { value: "top-down", label: "Top-down" },
  { value: "low", label: "Low angle" },
];
const LIGHTS: { value: ShotLight; label: string }[] = [
  { value: "scene", label: "Match scene" },
  { value: "daylight", label: "Daylight" },
  { value: "golden", label: "Golden hour" },
  { value: "studio", label: "Studio" },
  { value: "moody", label: "Moody" },
];
const ROWS: ShotRow[] = ["top", "middle", "bottom"];
const COLS: ShotColumn[] = ["left", "center", "right"];

/** Where the product sits in the free preview, as % of the frame. */
const AT = { left: 22, center: 50, right: 78, top: 28, middle: 50, bottom: 70 } as const;
const HEIGHT: Record<ShotSize, number> = { small: 22, medium: 40, large: 62 };
const FRAME: Record<AspectRatio, string> = {
  "1:1": "aspect-square",
  "4:5": "aspect-[4/5]",
  "9:16": "aspect-[9/16] max-h-[420px]",
  "16:9": "aspect-video",
};

/** "ACME GLOW / 30 ml" ⇄ ["ACME GLOW", "30 ml"]. */
export function labelLines(text: string) {
  return text
    .split("/")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(0, 8)
    .map((l) => l.slice(0, 60));
}

function Choices<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex flex-col gap-2.5">
      <span className="type-label text-v2-ink">{label}</span>
      <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
        {options.map((o) => {
          const active = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(o.value)}
              className={cn(
                "h-9 rounded-[74px] px-4 font-archivo text-sm font-medium tracking-[-0.28px] transition-colors",
                active
                  ? "bg-v2-pill text-v2-pill-ink"
                  : "bg-v2-canvas text-v2-ink-70 hover:text-v2-ink night:bg-v2-surface-2",
              )}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Photo Studio camera step (Piece By Piece step 5, and a section in Build It Yourself):
 * where the product sits, how big, the angle and the light, plus the words on the product
 * so the AI copies them exactly. The preview is a free rough layout, not the AI result.
 */
export function ShotStep({
  shot,
  onShot,
  aspect,
  sceneUrl,
  product,
  labelText,
  labelLoading,
  onLabelText,
  onReread,
}: {
  shot: ShotSettings;
  onShot: (shot: ShotSettings) => void;
  aspect: AspectRatio;
  sceneUrl?: string;
  product: Product | null;
  labelText: string;
  labelLoading: boolean;
  onLabelText: (text: string) => void;
  onReread: () => void;
}) {
  const [row, col] = shot.position.split("-") as [ShotRow, ShotColumn];
  const h = HEIGHT[shot.size];
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)] lg:items-start">
      <figure className="flex flex-col gap-2">
        <div
          className={cn(
            "relative w-full overflow-hidden rounded-[12px] bg-v2-canvas",
            FRAME[aspect],
          )}
        >
          {sceneUrl ? (
            <img src={sceneUrl} alt="" className="absolute inset-0 size-full object-cover" />
          ) : null}
          {product ? (
            <img
              src={product.imageUrl}
              alt=""
              className="absolute w-auto max-w-[70%] -translate-x-1/2 -translate-y-1/2 rounded-[6px] object-contain shadow-[0_8px_24px_rgba(0,0,0,0.25)] transition-all duration-300"
              style={{ left: `${AT[col]}%`, top: `${AT[row]}%`, height: `${h}%` }}
            />
          ) : (
            <span
              className="absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-[8px] border-2 border-dashed border-white/80 bg-black/20 px-2 text-center font-inter-tight text-[11px] text-white transition-all duration-300"
              style={{
                left: `${AT[col]}%`,
                top: `${AT[row]}%`,
                height: `${h}%`,
                width: `${h * 0.7}%`,
              }}
            >
              Your product
            </span>
          )}
        </div>
        <figcaption className="font-inter-tight text-xs text-v2-muted">
          Rough layout, free. The AI builds the real shot from your pieces.
        </figcaption>
      </figure>

      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap gap-8">
          <div className="flex flex-col gap-2.5">
            <span className="type-label text-v2-ink">Position</span>
            <div
              role="radiogroup"
              aria-label="Position"
              className="grid w-[120px] grid-cols-3 gap-1.5"
            >
              {ROWS.flatMap((r) =>
                COLS.map((c) => {
                  const value = `${r}-${c}` as ShotSettings["position"];
                  const active = value === shot.position;
                  return (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      aria-label={`${r} ${c}`}
                      onClick={() => onShot({ ...shot, position: value })}
                      className={cn(
                        "flex aspect-square items-center justify-center rounded-[8px] transition-colors",
                        active
                          ? "bg-v2-pill"
                          : "bg-v2-canvas hover:bg-v2-nav-active night:bg-v2-surface-2",
                      )}
                    >
                      <span
                        className={cn(
                          "size-2 rounded-full",
                          active ? "bg-v2-pill-ink" : "bg-v2-ink-60/40",
                        )}
                      />
                    </button>
                  );
                }),
              )}
            </div>
          </div>
          <Choices
            label="Product size"
            options={SIZES}
            value={shot.size}
            onChange={(size) => onShot({ ...shot, size })}
          />
        </div>
        <Choices
          label="Camera angle"
          options={ANGLES}
          value={shot.angle}
          onChange={(angle) => onShot({ ...shot, angle })}
        />
        <Choices
          label="Light"
          options={LIGHTS}
          value={shot.light}
          onChange={(light) => onShot({ ...shot, light })}
        />
        <label className="flex flex-col gap-2.5">
          <span className="flex items-center justify-between gap-3">
            <span className="type-label text-v2-ink">Text on your product</span>
            {product ? (
              <button
                type="button"
                onClick={onReread}
                className="flex items-center gap-1.5 font-inter-tight text-xs text-v2-ink-60 hover:text-v2-ink"
              >
                <RefreshCw className={cn("size-3", labelLoading && "animate-spin")} />
                Read again
              </button>
            ) : null}
          </span>
          <input
            value={labelText}
            onChange={(e) => onLabelText(e.target.value)}
            disabled={!product}
            placeholder={
              !product
                ? "Pick a product first"
                : labelLoading
                  ? "Reading your product…"
                  : "e.g. ACME GLOW SERUM / 30 ml"
            }
            className="h-11 rounded-[10px] border border-v2-line bg-v2-canvas px-3.5 font-inter-tight text-sm text-v2-ink outline-none placeholder:text-v2-muted focus:border-v2-blue disabled:opacity-60"
          />
          <span className="font-inter-tight text-xs text-v2-muted">
            We read this from your photo so the AI spells it exactly. Fix it if it’s wrong; separate
            lines with “/”.
          </span>
        </label>
      </div>
    </div>
  );
}
