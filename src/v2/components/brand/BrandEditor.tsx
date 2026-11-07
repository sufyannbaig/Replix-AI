import { ChevronLeft, ChevronRight, Loader2, Plus, Upload, X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { PillButton } from "@/v2/components/primitives";
import { BrandLimitError, useSaveBrandKit, useUploadBrandFile } from "@/v2/data/api";
import type { BrandKit } from "@/v2/data/types";
import { FontPicker, type FontChoice } from "./FontPicker";

const MAX_COLORS = 5;
const MAX_TAGS = 6;
const HEX = /^#[0-9a-f]{6}$/i;

const fieldClass =
  "h-11 w-full rounded-[250px] border border-[rgba(11,15,25,0.2)] bg-transparent px-4 font-inter-tight text-sm text-v2-ink outline-none transition-colors placeholder:text-v2-ink-60 focus:border-v2-blue night:border-v2-border";
const areaClass =
  "min-h-[88px] w-full resize-y rounded-[14px] border border-[rgba(11,15,25,0.2)] bg-transparent px-4 py-3 font-inter-tight text-sm leading-relaxed text-v2-ink outline-none transition-colors placeholder:text-v2-ink-60 focus:border-v2-blue night:border-v2-border";

type LogoSlot = { ref: string; url: string } | null;

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 border-t border-v2-line pt-5 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="type-card-title text-v2-ink">{title}</h3>
        {hint ? <p className="font-inter-tight text-xs text-v2-ink-60">{hint}</p> : null}
      </div>
      {children}
    </section>
  );
}

function normaliseHex(input: string) {
  const v = input.trim().replace(/^#?/, "#");
  if (/^#[0-9a-f]{3}$/i.test(v)) {
    return `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`.toUpperCase();
  }
  return HEX.test(v) ? v.toUpperCase() : null;
}

function LogoPicker({
  label,
  hint,
  dark,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  dark?: boolean;
  value: LogoSlot;
  onChange: (value: LogoSlot) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const upload = useUploadBrandFile();
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <span className="font-inter-tight text-sm font-medium text-v2-ink">{label}</span>
      <div
        className={cn(
          "relative flex h-[132px] items-center justify-center overflow-hidden rounded-[14px] border border-dashed",
          dark
            ? "border-white/20 bg-[#12213d]"
            : "border-[rgba(2,2,2,0.2)] bg-[repeating-conic-gradient(#f2f2f2_0_25%,#fff_0_50%)] bg-[length:16px_16px] night:border-v2-border",
        )}
      >
        {value ? (
          <>
            <img src={value.url} alt={label} className="max-h-[88px] max-w-[80%] object-contain" />
            <button
              type="button"
              aria-label={`Remove ${label.toLowerCase()}`}
              onClick={() => onChange(null)}
              className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-full bg-white/90 text-[#12213d] shadow-sm hover:bg-white"
            >
              <X className="size-4" />
            </button>
          </>
        ) : (
          <span
            className={cn("font-inter-tight text-xs", dark ? "text-white/60" : "text-v2-ink-60")}
          >
            {hint}
          </span>
        )}
      </div>
      <button
        type="button"
        disabled={upload.isPending}
        onClick={() => input.current?.click()}
        className="flex h-9 items-center justify-center gap-2 rounded-full border border-[#a2a2a2] font-inter-tight text-sm text-v2-ink hover:bg-v2-surface-2 disabled:opacity-50 night:border-v2-border"
      >
        {upload.isPending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Upload className="size-4" />
        )}
        {value ? "Replace" : "Upload"}
      </button>
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          upload.mutate(
            { file, kind: "logo" },
            {
              onSuccess: ({ ref, url }) => onChange({ ref, url }),
              onError: (error) => toast.error(error.message),
            },
          );
        }}
      />
    </div>
  );
}

function ColorRow({
  value,
  index,
  count,
  onChange,
  onMove,
  onRemove,
}: {
  value: string;
  index: number;
  count: number;
  onChange: (hex: string) => void;
  onMove: (to: number) => void;
  onRemove: () => void;
}) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  return (
    <li className="flex items-center gap-2">
      <label className="relative size-11 shrink-0 cursor-pointer overflow-hidden rounded-[10px] border border-black/10">
        <span className="absolute inset-0" style={{ background: value }} />
        <span className="sr-only">Colour {index + 1}</span>
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          className="absolute inset-0 cursor-pointer opacity-0"
        />
      </label>
      <input
        value={text}
        aria-label={`Colour ${index + 1} hex`}
        onChange={(e) => {
          setText(e.target.value);
          const hex = normaliseHex(e.target.value);
          if (hex) onChange(hex);
        }}
        onBlur={() => setText(value)}
        className={cn(fieldClass, "w-[120px] font-mono uppercase")}
      />
      {index === 0 ? (
        <span className="font-inter-tight text-xs text-v2-ink-60">Primary</span>
      ) : null}
      <span className="ml-auto flex items-center gap-1">
        <button
          type="button"
          aria-label="Move left"
          disabled={index === 0}
          onClick={() => onMove(index - 1)}
          className="flex size-8 items-center justify-center rounded-full text-v2-ink-60 hover:bg-v2-surface-2 disabled:opacity-30"
        >
          <ChevronLeft className="size-4" />
        </button>
        <button
          type="button"
          aria-label="Move right"
          disabled={index === count - 1}
          onClick={() => onMove(index + 1)}
          className="flex size-8 items-center justify-center rounded-full text-v2-ink-60 hover:bg-v2-surface-2 disabled:opacity-30"
        >
          <ChevronRight className="size-4" />
        </button>
        <button
          type="button"
          aria-label={`Remove colour ${value}`}
          onClick={onRemove}
          className="flex size-8 items-center justify-center rounded-full text-v2-ink-60 hover:bg-v2-surface-2"
        >
          <X className="size-4" />
        </button>
      </span>
    </li>
  );
}

function fontChoice(kit: BrandKit | undefined, role: "heading" | "body"): FontChoice | null {
  const family = kit?.fonts?.[role];
  if (!family) return null;
  const ref = kit?.stored?.fontFiles?.[role];
  const url = kit?.fontFiles?.[role];
  return ref && url ? { family, file: { ref, url } } : { family };
}

/**
 * Create or edit a brand kit by hand: name, logos, colours, fonts and tone. Website
 * extraction fills the same fields; this is where people correct or complete them.
 */
export function BrandEditor({
  open,
  onOpenChange,
  kit,
  onSaved,
  onLimit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Missing (or the blank kit) = create a new brand. */
  kit?: BrandKit;
  onSaved?: (kit: BrandKit) => void;
  /** Called when the plan's brand limit stops a new brand. */
  onLimit?: (message: string) => void;
}) {
  const save = useSaveBrandKit();
  const [name, setName] = useState("");
  const [website, setWebsite] = useState("");
  const [logo, setLogo] = useState<LogoSlot>(null);
  const [lightLogo, setLightLogo] = useState<LogoSlot>(null);
  const [colors, setColors] = useState<string[]>([]);
  const [heading, setHeading] = useState<FontChoice | null>(null);
  const [body, setBody] = useState<FontChoice | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [tagDraft, setTagDraft] = useState("");
  const [tone, setTone] = useState("");
  const [audience, setAudience] = useState("");

  /* Reset from the kit each time the editor opens. */
  useEffect(() => {
    if (!open) return;
    const refs = kit?.stored?.logos ?? kit?.logos ?? [];
    const slot = (i: number): LogoSlot =>
      refs[i] && kit?.logos[i] ? { ref: refs[i], url: kit.logos[i] } : null;
    setName(kit && kit.id !== "new" ? kit.name : "");
    setWebsite(kit?.website ?? "");
    setLogo(slot(0));
    setLightLogo(slot(1));
    setColors(kit?.colors.slice(0, MAX_COLORS) ?? []);
    setHeading(fontChoice(kit, "heading"));
    setBody(fontChoice(kit, "body"));
    setTags(kit?.toneTags.slice(0, MAX_TAGS) ?? []);
    setTagDraft("");
    setTone(kit?.tone ?? "");
    setAudience(kit?.audience ?? "");
  }, [open, kit]);

  const creating = !kit || kit.id === "new";

  const addTag = () => {
    const parts = tagDraft
      .split(",")
      .map((t) => t.trim().slice(0, 30))
      .filter(Boolean);
    if (!parts.length) return;
    setTags((prev) => [...new Set([...prev, ...parts])].slice(0, MAX_TAGS));
    setTagDraft("");
  };

  const submit = () => {
    if (!name.trim()) {
      toast.error("Give your brand a name.");
      return;
    }
    const headingFont = heading ?? body;
    const bodyFont = body ?? heading;
    const files =
      headingFont?.file || bodyFont?.file
        ? { heading: headingFont?.file?.ref, body: bodyFont?.file?.ref }
        : undefined;
    save.mutate(
      {
        id: creating ? undefined : kit?.id,
        name,
        website: website.trim() || null,
        logos: [logo, lightLogo].flatMap((l) => (l ? [l.ref] : [])),
        colors,
        fonts:
          headingFont && bodyFont
            ? { heading: headingFont.family, body: bodyFont.family, ...(files ? { files } : {}) }
            : null,
        toneTags: tags,
        tone: tone.trim() || null,
        audience: audience.trim() || null,
      },
      {
        onSuccess: (saved) => {
          toast.success(creating ? `${saved.name} added` : "Brand saved");
          onSaved?.(saved);
          onOpenChange(false);
        },
        onError: (error) => {
          if (error instanceof BrandLimitError) onLimit?.(error.message);
          else toast.error(error.message || "We couldn't save that brand. Try again.");
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] w-[calc(100vw-32px)] max-w-[760px] flex-col gap-0 overflow-hidden rounded-[18px] border-none bg-v2-surface p-0 text-v2-ink">
        <div className="border-b border-v2-line px-5 pb-4 pt-5 sm:px-7">
          <DialogTitle className="font-archivo text-xl font-medium leading-archivo tracking-[-0.4px]">
            {creating ? "New brand" : `Edit ${kit?.name}`}
          </DialogTitle>
          <DialogDescription className="mt-1 font-inter-tight text-sm text-v2-ink-70">
            Logo, colours, fonts and tone used in every ad for this brand&apos;s products.
          </DialogDescription>
        </div>

        <form
          id="brand-editor"
          className="flex flex-1 flex-col gap-5 overflow-y-auto px-5 py-5 sm:px-7"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <Section title="Brand">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-2">
                <span className="font-inter-tight text-sm font-medium">Name</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={120}
                  placeholder="Acme"
                  className={fieldClass}
                />
              </label>
              <label className="flex flex-col gap-2">
                <span className="font-inter-tight text-sm font-medium">
                  Website <span className="font-normal text-v2-ink-60">(optional)</span>
                </span>
                <input
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  maxLength={300}
                  inputMode="url"
                  placeholder="acme.com"
                  className={fieldClass}
                />
              </label>
            </div>
          </Section>

          <Section title="Logo" hint="PNG, JPG, WebP or SVG, up to 2 MB">
            <div className="grid gap-4 sm:grid-cols-2">
              <LogoPicker
                label="Main logo"
                hint="Used on light backgrounds"
                value={logo}
                onChange={setLogo}
              />
              <LogoPicker
                label="Light version (optional)"
                hint="Used on dark backgrounds"
                dark
                value={lightLogo}
                onChange={setLightLogo}
              />
            </div>
          </Section>

          <Section title="Colours" hint={`Up to ${MAX_COLORS}, primary first`}>
            {colors.length ? (
              <ul className="flex flex-col gap-2">
                {colors.map((hex, i) => (
                  <ColorRow
                    key={`${i}-${colors.length}`}
                    value={hex}
                    index={i}
                    count={colors.length}
                    onChange={(next) =>
                      setColors((prev) => prev.map((c, j) => (j === i ? next : c)))
                    }
                    onMove={(to) =>
                      setColors((prev) => {
                        const next = [...prev];
                        [next[i], next[to]] = [next[to], next[i]];
                        return next;
                      })
                    }
                    onRemove={() => setColors((prev) => prev.filter((_, j) => j !== i))}
                  />
                ))}
              </ul>
            ) : (
              <p className="font-inter-tight text-sm text-v2-ink-60">
                No colours yet. Ads use a colour from the product photo until you add some.
              </p>
            )}
            {colors.length < MAX_COLORS ? (
              <button
                type="button"
                onClick={() => setColors((prev) => [...prev, prev.length ? "#FFFFFF" : "#12213D"])}
                className="flex h-9 items-center gap-2 self-start rounded-full border border-dashed border-[#a2a2a2] px-4 font-inter-tight text-sm text-v2-ink hover:border-v2-blue hover:text-v2-blue night:border-v2-border"
              >
                <Plus className="size-4" /> Add colour
              </button>
            ) : null}
          </Section>

          <Section title="Fonts" hint="Search Google Fonts or upload your own">
            <div className="grid gap-4 sm:grid-cols-2">
              <FontPicker label="Headlines" value={heading} onChange={setHeading} weight={700} />
              <FontPicker label="Body and buttons" value={body} onChange={setBody} weight={400} />
            </div>
          </Section>

          <Section title="Tone of voice" hint={`Up to ${MAX_TAGS} tags`}>
            <div className="flex flex-wrap items-center gap-2">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="flex items-center gap-1 rounded-full border-[0.7px] border-black/60 py-1 pl-3 pr-1.5 font-inter-tight text-xs text-[#616161] night:border-v2-border night:text-v2-ink-70"
                >
                  {tag}
                  <button
                    type="button"
                    aria-label={`Remove ${tag}`}
                    onClick={() => setTags((prev) => prev.filter((t) => t !== tag))}
                    className="flex size-5 items-center justify-center rounded-full hover:bg-v2-surface-2"
                  >
                    <X className="size-3" />
                  </button>
                </span>
              ))}
              {tags.length < MAX_TAGS ? (
                <input
                  value={tagDraft}
                  onChange={(e) => setTagDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === ",") {
                      e.preventDefault();
                      addTag();
                    }
                  }}
                  onBlur={addTag}
                  aria-label="Add a tone tag"
                  placeholder="Add a tag, e.g. Friendly"
                  className="h-8 min-w-[160px] flex-1 bg-transparent font-inter-tight text-sm outline-none placeholder:text-v2-ink-60"
                />
              ) : null}
            </div>
            <textarea
              value={tone}
              onChange={(e) => setTone(e.target.value)}
              maxLength={3000}
              aria-label="How the brand sounds"
              placeholder="How the brand sounds, in a sentence or two."
              className={areaClass}
            />
          </Section>

          <Section title="About & audience">
            <textarea
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
              maxLength={3000}
              aria-label="Who the brand sells to"
              placeholder="Who the brand sells to."
              className={areaClass}
            />
          </Section>
        </form>

        <div className="flex justify-end gap-2 border-t border-v2-line px-5 py-4 sm:px-7">
          <PillButton variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </PillButton>
          <PillButton type="submit" form="brand-editor" disabled={save.isPending}>
            {save.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            {creating ? "Add brand" : "Save brand"}
          </PillButton>
        </div>
      </DialogContent>
    </Dialog>
  );
}
