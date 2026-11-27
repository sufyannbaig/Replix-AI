import { cn } from "@/lib/utils";

const CHEVRON = "polygon(0 0, calc(100% - 27px) 0, 100% 50%, calc(100% - 27px) 100%, 0 100%)";

/**
 * The chevron step bar from Build Piece By Piece (Figma 543:134077), shared by every studio.
 * Steps up to the current one are navy, the next one is light blue, later ones stay on the
 * white track. A step with a handler is a button; the rest are plain labels.
 */
export function StepBar({
  labels,
  current,
  onSelect,
  clickable = () => true,
  tabs = false,
  label,
}: {
  labels: readonly string[];
  current: number;
  onSelect?: (index: number) => void;
  clickable?: (index: number) => boolean;
  /** Render as a tab list (Piece By Piece, where every step is a free tab). */
  tabs?: boolean;
  label: string;
}) {
  return (
    <div
      className="relative flex h-[71px] overflow-hidden rounded-[14px] bg-v2-surface night:bg-white"
      role={tabs ? "tablist" : "list"}
      aria-label={label}
    >
      {labels.map((text, i) => {
        const tone =
          i <= current
            ? "bg-[#162544] text-white"
            : i === current + 1
              ? "bg-[#7c95c9] text-white"
              : "text-black/40";
        const className = cn(
          "relative flex min-w-0 flex-1 items-center justify-center px-1 text-center type-label max-sm:text-sm max-sm:leading-tight",
          i > 0 && "-ml-[27px] pl-[27px]",
          tone,
        );
        const style = {
          clipPath: i < labels.length - 1 ? CHEVRON : undefined,
          zIndex: labels.length - i,
        };
        const content = `${i + 1}. ${text}`;
        return onSelect && clickable(i) ? (
          <button
            key={text}
            type="button"
            role={tabs ? "tab" : undefined}
            aria-selected={tabs ? i === current : undefined}
            aria-current={!tabs && i === current ? "step" : undefined}
            onClick={() => onSelect(i)}
            className={className}
            style={style}
          >
            {content}
          </button>
        ) : (
          <div
            key={text}
            role={tabs ? "tab" : "listitem"}
            aria-current={i === current ? "step" : undefined}
            className={className}
            style={style}
          >
            {content}
          </div>
        );
      })}
    </div>
  );
}

export type StudioStep = {
  /** Short, like the Piece By Piece steps: "Template", "Product". */
  label: string;
  /** Done once the user has made that choice. The last step (Generate) is never done. */
  done: boolean;
  /** Optional shortcut, e.g. open the product picker. */
  onClick?: () => void;
};

/** "What to do next" in a studio: the current step is the first one not done yet. */
export function StudioSteps({ steps }: { steps: StudioStep[] }) {
  const first = steps.findIndex((s) => !s.done);
  return (
    <StepBar
      label="Steps"
      labels={steps.map((s) => s.label)}
      current={first === -1 ? steps.length - 1 : first}
      onSelect={(i) => steps[i].onClick?.()}
      clickable={(i) => !!steps[i].onClick}
    />
  );
}
