import { Link } from "@tanstack/react-router";
import { Check, ChevronDown, Loader2, Search, Upload } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useCredits } from "@/hooks/use-credits";
import { cn } from "@/lib/utils";
import { useGoogleFonts, useUploadBrandFile } from "@/v2/data/api";
import { loadFontFace, nearestWeight, searchFonts, type GoogleFont } from "@/v2/data/fonts";
import { canUploadFonts } from "@/v2/data/pricing";

/** A chosen font: a Google family, or an uploaded file (`file` set). */
export type FontChoice = { family: string; file?: { ref: string; url: string } };

/** Shows a family in its own face once loaded; system font until then. */
function FontSample({
  family,
  url,
  weight = 400,
  className,
  children,
}: {
  family: string;
  url?: string;
  weight?: number;
  className?: string;
  children?: React.ReactNode;
}) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let live = true;
    setReady(false);
    void loadFontFace(family, { url, weight }).then((ok) => live && setReady(ok));
    return () => {
      live = false;
    };
  }, [family, url, weight]);
  return (
    <span
      className={className}
      style={ready ? { fontFamily: `"${family}", system-ui`, fontWeight: weight } : undefined}
    >
      {children ?? family}
    </span>
  );
}

export { FontSample };

/**
 * Pick a brand font: search every Google font (rows render in their own face), or upload a
 * TTF, OTF or WOFF file after confirming the licence.
 */
export function FontPicker({
  label,
  value,
  onChange,
  weight,
}: {
  label: string;
  value: FontChoice | null;
  onChange: (value: FontChoice | null) => void;
  /** Preview weight: heavier for headings. */
  weight: number;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [licensed, setLicensed] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const { data: fonts = [], isLoading } = useGoogleFonts();
  const upload = useUploadBrandFile();
  const { plan, loading: planLoading } = useCredits();
  /* Free uses Google Fonts only; uploads are for paid plans. */
  const uploads = !planLoading && canUploadFonts(plan);
  const freePlan = !planLoading && !uploads;
  const results = useMemo(() => searchFonts(fonts, query, 30), [fonts, query]);

  const pick = (font: GoogleFont) => {
    onChange({ family: font.family });
    setOpen(false);
  };

  const onFile = (file: File | undefined) => {
    if (!file) return;
    upload.mutate(
      { file, kind: "font" },
      {
        onSuccess: ({ ref, url, name }) => {
          onChange({ family: name, file: { ref, url } });
          setOpen(false);
        },
        onError: (error) => toast.error(error.message),
      },
    );
  };

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <span className="font-inter-tight text-sm font-medium text-v2-ink">{label}</span>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="flex h-[56px] w-full items-center justify-between gap-3 rounded-[14px] border border-[rgba(11,15,25,0.2)] bg-transparent px-4 text-left transition-colors hover:border-v2-blue focus-visible:border-v2-blue focus-visible:outline-none night:border-v2-border"
          >
            {value ? (
              <span className="flex min-w-0 flex-col">
                <FontSample
                  family={value.family}
                  url={value.file?.url}
                  weight={weight}
                  className="truncate font-inter-tight text-lg leading-tight text-v2-ink"
                />
                <span className="font-inter-tight text-xs text-v2-ink-60">
                  {value.file
                    ? freePlan
                      ? "Uploaded font · not used on Free"
                      : "Uploaded font"
                    : "Google Font"}
                </span>
              </span>
            ) : (
              <span className="font-inter-tight text-sm text-v2-ink-60">Choose a font</span>
            )}
            <ChevronDown className="size-4 shrink-0 text-v2-ink-60" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-[var(--radix-popover-trigger-width)] min-w-[280px] rounded-[14px] border-v2-line bg-v2-surface p-0 text-v2-ink"
        >
          <label className="flex items-center gap-2 border-b border-v2-line px-3">
            <Search className="size-4 shrink-0 text-v2-ink-60" />
            <span className="sr-only">Search Google Fonts</span>
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search Google Fonts"
              className="h-11 min-w-0 flex-1 bg-transparent font-inter-tight text-sm outline-none placeholder:text-v2-ink-60"
            />
          </label>
          <ul className="max-h-[260px] overflow-y-auto py-1" role="listbox" aria-label={label}>
            {isLoading ? (
              <li className="flex items-center gap-2 px-3 py-3 font-inter-tight text-sm text-v2-ink-60">
                <Loader2 className="size-4 animate-spin" /> Loading fonts…
              </li>
            ) : results.length === 0 ? (
              <li className="px-3 py-3 font-inter-tight text-sm text-v2-ink-60">
                No Google font called “{query}”.
                {uploads ? " Upload it below if you have the file." : null}
              </li>
            ) : (
              results.map((font) => {
                const selected = !value?.file && value?.family === font.family;
                return (
                  <li key={font.id} role="option" aria-selected={selected}>
                    <button
                      type="button"
                      onClick={() => pick(font)}
                      className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-v2-surface-2"
                    >
                      <FontSample
                        family={font.family}
                        weight={nearestWeight(font.weights, weight)}
                        className="truncate font-inter-tight text-base"
                      />
                      <span className="flex shrink-0 items-center gap-2 font-inter-tight text-xs capitalize text-v2-ink-60">
                        {font.category}
                        {selected ? <Check className="size-4 text-v2-blue" /> : null}
                      </span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
          <div className="flex flex-col gap-2 border-t border-v2-line p-3">
            {uploads ? (
              <>
                <label className="flex items-start gap-2 font-inter-tight text-xs leading-snug text-v2-ink-70">
                  <input
                    type="checkbox"
                    checked={licensed}
                    onChange={(e) => setLicensed(e.target.checked)}
                    className="mt-0.5 size-3.5 accent-v2-blue"
                  />
                  I have the licence to use my uploaded font in ads.
                </label>
                <button
                  type="button"
                  disabled={!licensed || upload.isPending}
                  onClick={() => fileInput.current?.click()}
                  className="flex h-9 items-center justify-center gap-2 rounded-full border border-[#a2a2a2] font-inter-tight text-sm text-v2-ink transition-opacity hover:bg-v2-surface-2 disabled:opacity-40 night:border-v2-border"
                >
                  {upload.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Upload className="size-4" />
                  )}
                  Upload font file (TTF, OTF, WOFF)
                </button>
                <input
                  ref={fileInput}
                  type="file"
                  accept=".ttf,.otf,.woff"
                  className="hidden"
                  onChange={(e) => {
                    onFile(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
              </>
            ) : (
              <p className="font-inter-tight text-xs leading-snug text-v2-ink-70">
                Your own font files are on paid plans.{" "}
                <Link to="/upgrade" className="text-v2-blue underline-offset-2 hover:underline">
                  See plans
                </Link>
              </p>
            )}
            {value ? (
              <button
                type="button"
                onClick={() => {
                  onChange(null);
                  setOpen(false);
                }}
                className={cn(
                  "font-inter-tight text-xs text-v2-ink-60 underline-offset-2",
                  "hover:underline",
                )}
              >
                Clear font
              </button>
            ) : null}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
