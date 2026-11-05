import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useCredits } from "@/hooks/use-credits";
import { useGenerate } from "@/v2/components/studio/useGenerate";
import { cn } from "@/lib/utils";
import { AppShell } from "@/v2/components/shell/AppShell";
import { FilterTabs, PillButton, PillLink } from "@/v2/components/primitives";
import { ModeSwitcher, type StudioMode } from "@/v2/components/studio/ModeSwitcher";
import { ComposerBar, missingHint, TemplateChip } from "@/v2/components/studio/ComposerBar";
import { ProductPicker } from "@/v2/components/studio/ProductPicker";
import {
  addPiece,
  EMPTY_SELECTION,
  PieceByPiece,
  pieceStepIndex,
  type PieceSelection,
} from "@/v2/components/studio/PieceByPiece";
import {
  BuildItYourself,
  EMPTY_DIY,
  type DiySelection,
} from "@/v2/components/studio/BuildItYourself";
import { photoGenerationCost, usePhotoTemplates, usePiece } from "@/v2/data/api";
import type { AspectRatio, PhotoTemplate, PhotoTemplateCategory, Product } from "@/v2/data/types";
import mocha from "@/assets/v2/catalog/photo/weekend-flat-lay.webp";
import sodaHand from "@/assets/v2/catalog/photo/hand-hero.webp";
import sodaCherry from "@/assets/v2/catalog/product/acme-charge.webp";
import truffle from "@/assets/v2/catalog/photo/linen-studio.webp";
import modeScene from "@/assets/v2/studio/mode-scene.svg";
import modeText from "@/assets/v2/studio/mode-text.svg";
import modePalette from "@/assets/v2/studio/mode-palette.svg";
import modeConnector from "@/assets/v2/studio/mode-connector.svg";
import modeWand from "@/assets/v2/studio/mode-wand.svg";
import modeSliders from "@/assets/v2/studio/mode-sliders.svg";
import modeCrop from "@/assets/v2/studio/mode-crop.svg";

type PhotoMode = "templates" | "piece" | "diy";

export const Route = createFileRoute("/_app/photo-studio")({
  validateSearch: (search: Record<string, unknown>): { mode?: PhotoMode; use?: string } => ({
    ...(search.mode === "piece" || search.mode === "diy" ? { mode: search.mode } : {}),
    ...(typeof search.use === "string" ? { use: search.use } : {}),
  }),
  head: () => ({ meta: [{ title: "Photo Studio · Replix AI" }] }),
  component: PhotoStudioPage,
});

/* ---------- Mode card illustrations (offsets from Figma 543:10152) ---------- */

function Thumb({ src, style, radius }: { src: string; style: CSSProperties; radius: number }) {
  return (
    <img
      src={src}
      alt=""
      className="absolute object-cover"
      style={{ ...style, borderRadius: radius }}
    />
  );
}

function Fade({ style, flip }: { style: CSSProperties; flip?: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "absolute bg-gradient-to-b from-transparent to-[var(--v2-surface)]",
        flip && "-scale-y-100",
      )}
      style={style}
    />
  );
}

function IconTile({
  bg,
  rotate,
  box,
  pos,
  icon,
  iconSize,
  shadow,
}: {
  bg: string;
  rotate: number;
  box: [number, number];
  pos: [number, number];
  icon: string;
  iconSize: [number, number];
  shadow: string;
}) {
  return (
    <span
      className="absolute flex items-center justify-center"
      style={{ left: pos[0], top: pos[1], width: box[0], height: box[1] }}
    >
      <span
        className="flex size-[37.59px] items-center justify-center rounded-[7.74px] border-[0.8px] border-white"
        style={{ background: bg, transform: `rotate(${rotate}deg)`, boxShadow: shadow }}
      >
        <img src={icon} alt="" style={{ width: iconSize[0], height: iconSize[1] }} />
      </span>
    </span>
  );
}

const TemplatesArt = (
  <span aria-hidden className="absolute left-[43px] top-[93px] h-[149px] w-[217px]">
    <Thumb
      src={mocha}
      radius={7.4}
      style={{ left: 125.66, top: 69.28, width: 73.68, height: 74.7 }}
    />
    <Thumb
      src={sodaHand}
      radius={12}
      style={{ left: 167.62, top: 13, width: 49.12, height: 50.14 }}
    />
    <Thumb
      src={sodaCherry}
      radius={12}
      style={{ left: 73.18, top: 23.38, width: 90.05, height: 91.08 }}
    />
    <Thumb
      src={truffle}
      radius={14.8}
      style={{ left: 9, top: 40.63, width: 90.05, height: 91.08 }}
    />
    <Fade style={{ left: 0, top: 104, width: 207, height: 45 }} />
    <Fade flip style={{ left: 0, top: 0, width: 217, height: 45 }} />
  </span>
);

const PieceArt = (
  <span aria-hidden className="absolute inset-0">
    <Thumb src={truffle} radius={12} style={{ left: 98, top: 108, width: 114, height: 115 }} />
    <Fade style={{ left: 46, top: 187, width: 207, height: 50 }} />
    <Fade flip style={{ left: 46, top: 88, width: 217, height: 45 }} />
    <span className="absolute left-[76px] top-[93px]">
      <IconTile
        bg="#ffe7bd"
        rotate={-8.17}
        box={[44.13, 42.78]}
        pos={[2.21, 0]}
        icon={modeScene}
        iconSize={[19.9, 17.44]}
        shadow="-5.95px 1.1px 27.4px rgba(0,0,0,0.1)"
      />
      <IconTile
        bg="#d9e7ff"
        rotate={13}
        box={[46.64, 45.44]}
        pos={[127.14, 19.9]}
        icon={modeText}
        iconSize={[14.93, 14.93]}
        shadow="5.53px 0 14px rgba(0,0,0,0.09)"
      />
      <IconTile
        bg="#d3ffba"
        rotate={-15.11}
        box={[46.09, 46.09]}
        pos={[0, 98.4]}
        icon={modePalette}
        iconSize={[18.65, 17.41]}
        shadow="none"
      />
    </span>
  </span>
);

const DiyArt = (
  <span aria-hidden className="absolute inset-0">
    <Thumb src={sodaCherry} radius={12} style={{ left: 38, top: 93, width: 114, height: 134 }} />
    <img
      src={modeConnector}
      alt=""
      className="absolute left-[153px] top-[76px] h-[78px] w-[96px]"
    />
    <img
      src={modeConnector}
      alt=""
      className="absolute left-[153px] top-[157px] h-[78px] w-[96px] -scale-y-100"
    />
    <span className="absolute left-[229px] top-[87px] flex w-10 flex-col gap-2.5">
      {[
        { src: modeWand, w: 19.37, h: 19.37, flip: true },
        { src: modeSliders, w: 14.51, h: 15, flip: false },
        { src: modeCrop, w: 14.75, h: 14.75, flip: true },
      ].map((tile) => (
        <span
          key={tile.src}
          className="flex size-10 items-center justify-center rounded-[7.74px] border-[0.8px] border-white bg-[#cdddff] shadow-[0_0_27.4px_rgba(0,0,0,0.1)]"
        >
          <img
            src={tile.src}
            alt=""
            className={cn(tile.flip && "-scale-y-100")}
            style={{ width: tile.w, height: tile.h }}
          />
        </span>
      ))}
    </span>
  </span>
);

const MODES: readonly StudioMode<PhotoMode>[] = [
  {
    value: "templates",
    title: "Build from templates",
    description: "Pick a ready shot, drop your product in",
    illustration: TemplatesArt,
  },
  {
    value: "piece",
    title: "Build Piece By Piece",
    description: "Choose scene, props and character",
    illustration: PieceArt,
  },
  {
    value: "diy",
    title: "Build It Yourself",
    description: "Upload everything, full control",
    illustration: DiyArt,
  },
];

const FILTERS: readonly { value: "all" | PhotoTemplateCategory; label: string }[] = [
  { value: "all", label: "All" },
  { value: "with-model", label: "With Model" },
  { value: "without-model", label: "Without Model" },
  { value: "studio", label: "Studio shots" },
  { value: "lifestyle", label: "Lifestyle" },
  { value: "flat-lay", label: "Flat lay" },
];

/* ---------- Page ---------- */

function PhotoStudioPage() {
  const { mode = "templates", use } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const { plan } = useCredits();
  const { generate, pending: generating } = useGenerate();
  const [product, setProduct] = useState<Product | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const [filter, setFilter] = useState<"all" | PhotoTemplateCategory>("all");
  const [selected, setSelected] = useState<PhotoTemplate | null>(null);
  const [upgradeFor, setUpgradeFor] = useState<{ name: string; imageUrl: string } | null>(null);
  const [pieceStep, setPieceStep] = useState(0);
  const [pieces, setPieces] = useState<PieceSelection>(EMPTY_SELECTION);
  const [diy, setDiy] = useState<DiySelection>(EMPTY_DIY);
  const [aspect, setAspect] = useState<AspectRatio>("1:1");
  const [count, setCount] = useState(1);
  const [note, setNote] = useState("");

  /* "Use in Photo Studio" from the Library: add the piece, then clean up the URL. */
  const { data: incoming } = usePiece(use);
  useEffect(() => {
    if (!incoming) return;
    if (incoming.isPro && plan === "free") setUpgradeFor(incoming);
    else setPieces((prev) => addPiece(prev, incoming));
    setPieceStep(pieceStepIndex(incoming.kind));
    void navigate({ search: { mode: "piece" }, replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once per incoming piece
  }, [incoming]);

  const { data: templates = [], isLoading } = usePhotoTemplates();
  const visible = useMemo(
    () => templates.filter((t) => filter === "all" || t.categories.includes(filter)),
    [templates, filter],
  );

  const choose = (template: PhotoTemplate) => {
    if (template.isPro && plan === "free") {
      setUpgradeFor(template);
      return;
    }
    setSelected(template);
  };

  /* What the composer shows and the result screen records for the current mode. */
  const style =
    mode === "piece"
      ? pieces.scene && {
          label: [
            pieces.scene.name,
            pieces.props.length &&
              `${pieces.props.length} prop${pieces.props.length > 1 ? "s" : ""}`,
            pieces.character?.name,
            pieces.pose?.name,
          ]
            .filter(Boolean)
            .join(" + "),
          imageUrl: pieces.scene.imageUrl,
        }
      : mode === "diy"
        ? diy.scene && {
            label: [
              "Your scene",
              diy.character && "your model",
              diy.pose && diy.pose.name,
              diy.props.length && `${diy.props.length} prop${diy.props.length > 1 ? "s" : ""}`,
            ]
              .filter(Boolean)
              .join(" + "),
            imageUrl: diy.scene.url,
          }
        : selected && { label: selected.name, imageUrl: selected.imageUrl };

  return (
    <AppShell title="Photo Studio" subtitle="Select how you want to create">
      <div className="mt-10 flex flex-col gap-10 pb-[250px] sm:pb-[160px]">
        <ModeSwitcher
          modes={MODES}
          value={mode}
          onChange={(next) => navigate({ search: next === "templates" ? {} : { mode: next } })}
        />

        {mode === "templates" ? (
          <div className="flex flex-col gap-[30px]">
            <FilterTabs
              label="Filter templates"
              options={FILTERS}
              value={filter}
              onChange={setFilter}
              className="self-start"
            />
            {isLoading ? null : visible.length ? (
              <div className="grid grid-cols-2 gap-x-5 gap-y-6 md:grid-cols-3 xl:grid-cols-4 xl:gap-y-10">
                {visible.map((template) => (
                  <TemplateCard
                    key={template.id}
                    template={template}
                    selected={selected?.id === template.id}
                    locked={template.isPro && plan === "free"}
                    onSelect={() => choose(template)}
                  />
                ))}
              </div>
            ) : (
              <p className="rounded-[18px] bg-v2-surface py-16 text-center font-inter-tight text-sm text-v2-muted">
                No templates in this category yet.
              </p>
            )}
          </div>
        ) : mode === "piece" ? (
          <PieceByPiece
            step={pieceStep}
            onStep={setPieceStep}
            selection={pieces}
            onChange={setPieces}
            isFreePlan={plan === "free"}
            onLocked={setUpgradeFor}
          />
        ) : (
          <BuildItYourself value={diy} onChange={setDiy} />
        )}
      </div>

      {/* Composer floats at the bottom of the content column. */}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-20 flex justify-center px-4 lg:left-[308px] lg:bottom-6">
        <div className="pointer-events-auto w-full max-w-[622px]">
          <ComposerBar
            product={product}
            onPickProduct={() => setPickerOpen(true)}
            chips={style ? <TemplateChip name={style.label} imageUrl={style.imageUrl} /> : null}
            aspect={aspect}
            onAspectChange={setAspect}
            count={count}
            onCountChange={setCount}
            note={note}
            onNoteChange={setNote}
            cost={photoGenerationCost(count)}
            canGenerate={!!product && !!style}
            generateHint={missingHint([
              !style && (mode === "templates" ? "a template" : "a scene"),
              !product && "a product",
            ])}
            onGenerate={() =>
              generate({
                studio: "photo",
                kind: "photo",
                product: product!,
                style: style || undefined,
                aspect,
                count,
                note: note.trim() || undefined,
                cost: photoGenerationCost(count),
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

      <Dialog open={!!upgradeFor} onOpenChange={(open) => !open && setUpgradeFor(null)}>
        <DialogContent className="max-w-[420px] rounded-[18px] border-none bg-v2-surface p-0 text-v2-ink">
          {upgradeFor ? (
            <img
              src={upgradeFor.imageUrl}
              alt=""
              className="h-[220px] w-full rounded-t-[18px] object-cover"
            />
          ) : null}
          <div className="flex flex-col gap-3 p-6">
            <DialogTitle className="font-archivo text-2xl font-medium leading-archivo tracking-[-0.96px]">
              {upgradeFor?.name} is a Pro {mode === "piece" ? "option" : "template"}
            </DialogTitle>
            <DialogDescription className="font-inter-tight text-sm leading-[1.41] text-v2-muted">
              Upgrade to use every premium photo and video template, Concept Ads and more credits
              each month.
            </DialogDescription>
            <div className="mt-2 flex gap-3">
              <PillLink to="/upgrade">See Plans</PillLink>
              <PillButton variant="outline" onClick={() => setUpgradeFor(null)}>
                Not now
              </PillButton>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function TemplateCard({
  template,
  selected,
  locked,
  onSelect,
}: {
  template: PhotoTemplate;
  selected: boolean;
  locked: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      aria-label={`${template.name}${template.isPro ? " (Pro)" : ""}`}
      className={cn(
        /* Delivered template art is 4:3; keep the card the same shape so nothing is cropped. */
        "group relative aspect-[4/3] overflow-hidden rounded-[12px] text-left outline-none",
        selected && "ring-[1.7px] ring-[#124498] ring-offset-0",
      )}
    >
      <img
        src={template.imageUrl}
        alt=""
        className={cn(
          "size-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]",
          selected && "rounded-[12px] border-2 border-white",
        )}
      />
      {template.isPro ? (
        <span className="absolute right-[14px] top-[14px] rounded-[18px] bg-gradient-to-b from-[#d0ffb6] to-[#ffebc9] px-[14px] py-[7px] font-archivo text-base font-medium leading-archivo tracking-[-0.64px] text-[#12213d]">
          Pro
        </span>
      ) : null}
      <span className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between bg-gradient-to-t from-black/55 to-transparent p-3 font-inter-tight text-xs text-white opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100">
        {template.name}
        {locked ? (
          <span className="rounded-full bg-white/20 px-2 py-0.5">Upgrade to use</span>
        ) : null}
      </span>
    </button>
  );
}
