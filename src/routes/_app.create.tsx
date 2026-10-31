import { useCallback, useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { notifyCreditsChanged } from "@/hooks/use-credits";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  ChevronRight,
  ImagePlus,
  LayoutGrid,
  Link2,
  Loader2,
  Package,
  Pencil,
  Plus,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { ProductCardBody, productCardClasses } from "@/components/ProductCard";
import { AdCard, type AdRecord } from "@/components/AdCard";
import { AdCardSkeleton } from "@/components/AdCardSkeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  analyzeProductImage,
  generateAdCopy,
  renderAdImage,
  type ProductAnalysis,
} from "@/lib/ai.functions";
import { fetchRecentAds, saveGeneratedAd } from "@/lib/ads-repo";
import { fileToDataUrl, urlToDataUrl } from "@/lib/image-utils";
import { resolveProductUrl } from "@/lib/ai.functions";
import { takeProductIntake } from "@/lib/product-intake";
import { getShopifyProducts, getShopifyProductByHandle } from "@/lib/shopify.functions";
import { formatPrice } from "@/lib/shopify";
import {
  formats,
  themes,
  understandingSteps,
  type AdFormat,
  type Platform,
  type ThemeId,
} from "@/data/studio";
import themeShowcase from "@/assets/theme-showcase.jpg";
import themeBoldClaim from "@/assets/theme-bold-claim.jpg";
import themeFeatureBenefit from "@/assets/theme-feature-benefit.jpg";
import themeHeadline from "@/assets/theme-headline.jpg";
import themeOfferSale from "@/assets/theme-offer-sale.jpg";
import themeProblemSolution from "@/assets/theme-problem-solution.jpg";
import themeBeforeAfter from "@/assets/theme-before-after.jpg";
import themeStats from "@/assets/theme-stats.jpg";
import themeTestimonial from "@/assets/theme-testimonial.jpg";
import themeUsVsThem from "@/assets/theme-us-vs-them.jpg";

const THEME_IMAGES: Record<ThemeId, string> = {
  showcase: themeShowcase,
  "bold-claim": themeBoldClaim,
  "feature-benefit": themeFeatureBenefit,
  headline: themeHeadline,
  "offer-sale": themeOfferSale,
  "problem-solution": themeProblemSolution,
  "before-after": themeBeforeAfter,
  stats: themeStats,
  testimonial: themeTestimonial,
  "us-vs-them": themeUsVsThem,
};
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/create")({
  head: () => ({
    meta: [
      { title: "Create Ad — Replix AI Ad Studio" },
      {
        name: "description",
        content:
          "Pick a product, upload a photo or paste a product link, let Replix study it, choose your creative themes, then generate a batch of finished ad concepts.",
      },
      { property: "og:title", content: "Create Ad — Replix AI Ad Studio" },
      {
        property: "og:description",
        content: "Study the product, choose an angle, generate a batch of ad concepts.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CreateAd,
});

const DEFAULT_OBJECTIVE = "awareness";

type Subject = {
  id: string;
  name: string;
  price?: number;
  displayImage: string;
  dataUrl: string;
  source: "shopify" | "upload" | "url";
};

/* ---------- Editable summary field ---------- */

function SummaryField({
  label,
  value,
  list,
  onSave,
}: {
  label: string;
  value: string;
  list?: boolean;
  onSave: (next: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  const lines = value
    .split("\n")
    .map((l) => l.replace(/^[-•\s]+/, "").trim())
    .filter(Boolean);

  return (
    <div className="rounded-2xl border border-border bg-muted/50 p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-semibold tracking-[0.14em] text-navy uppercase">{label}</p>
        {editing ? null : (
          <button
            onClick={() => {
              setDraft(value);
              setEditing(true);
            }}
            aria-label={`Edit ${label}`}
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-gold-soft hover:text-navy"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {editing ? (
        <div className="mt-2 space-y-2">
          <Textarea
            value={draft}
            rows={list ? 6 : 3}
            onChange={(e) => setDraft(e.target.value)}
            aria-label={`${label} text`}
          />
          {list ? <p className="text-xs text-muted-foreground">One selling point per line.</p> : null}
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => {
                onSave(draft);
                setEditing(false);
              }}
            >
              Save
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : list ? (
        <ul className="mt-2 space-y-2">
          {lines.length ? (
            lines.map((line) => (
              <li key={line} className="flex gap-2">
                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-navy" />
                <span className="text-sm leading-relaxed">{line}</span>
              </li>
            ))
          ) : (
            <li className="text-sm text-muted-foreground">Nothing yet — add your own.</li>
          )}
        </ul>
      ) : (
        <p className="mt-2 text-sm leading-relaxed">
          {value || <span className="text-muted-foreground">Nothing yet — add your own.</span>}
        </p>
      )}
    </div>
  );
}

/* ---------- Product analysis panel ---------- */

function ProductPanel({
  subject,
  analysis,
  onAnalysed,
  onChangeProduct,
  onDeleteProduct,
}: {
  subject: Subject;
  analysis: ProductAnalysis | null;
  onAnalysed: (analysis: ProductAnalysis) => void;
  onChangeProduct: () => void;
  onDeleteProduct: () => void;
}) {
  const analyze = useServerFn(analyzeProductImage);
  const [completed, setCompleted] = useState(analysis ? understandingSteps.length : 0);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (analysis) {
      setCompleted(understandingSteps.length);
      return;
    }
    let active = true;
    setError(null);
    setCompleted(0);

    const timers = [
      setTimeout(() => active && setCompleted((c) => Math.max(c, 1)), 1100),
      setTimeout(() => active && setCompleted((c) => Math.max(c, 2)), 2300),
    ];
    const started = Date.now();

    void analyze({
      data: {
        imageDataUrl: subject.dataUrl,
        productName: subject.name,
        ...(subject.price !== undefined ? { price: subject.price } : {}),
      },
    })
      .then((result) => {
        const wait = Math.max(0, 3600 - (Date.now() - started));
        timers.push(
          setTimeout(() => {
            if (!active) return;
            setCompleted(understandingSteps.length);
            onAnalysed(result);
          }, wait),
        );
      })
      .catch((err: unknown) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : "We could not read that photo.");
      });

    return () => {
      active = false;
      timers.forEach(clearTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subject.dataUrl, attempt]);

  return (
    <div className="rounded-3xl border border-border bg-card p-5 shadow-soft">
      <div className="flex flex-col gap-6 sm:flex-row">
        <div className="w-full shrink-0 sm:w-40">
          <img
            src={subject.displayImage}
            alt={subject.name}
            className="aspect-square w-full rounded-2xl border border-border object-cover"
            loading="lazy"
          />
          <p className="mt-2 text-sm font-semibold">{subject.name}</p>
          {subject.price !== undefined ? (
            <p className="text-xs text-muted-foreground">${subject.price.toFixed(2)}</p>
          ) : null}
          <div className="mt-3 flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="rounded-full border-navy px-4 text-navy"
              onClick={onChangeProduct}
            >
              Change
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="rounded-full border-destructive bg-card px-4 text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={onDeleteProduct}
            >
              Remove
            </Button>
          </div>
        </div>

        <div className="min-w-0 flex-1">
          {error ? (
            <div>
              <div className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-4 w-4" />
                <h3 className="text-base font-semibold">We couldn't read that photo</h3>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{error}</p>
              <Button className="mt-4" onClick={() => setAttempt((a) => a + 1)}>
                Try again
              </Button>
            </div>
          ) : analysis ? (
            <div className="space-y-3">
              <SummaryField
                label="Product highlights"
                list
                value={(analysis.highlights?.length ? analysis.highlights : analysis.insights).join(
                  "\n",
                )}
                onSave={(next) =>
                  onAnalysed({
                    ...analysis,
                    highlights: next
                      .split("\n")
                      .map((l) => l.replace(/^[-•\s]+/, "").trim())
                      .filter(Boolean),
                  })
                }
              />
              <SummaryField
                label="Ideal customer"
                value={analysis.idealCustomer || analysis.audiences[0] || ""}
                onSave={(next) => onAnalysed({ ...analysis, idealCustomer: next.trim() })}
              />
              <div className="grid gap-3 md:grid-cols-2">
                <SummaryField
                  label="Pain point"
                  value={analysis.painPoint}
                  onSave={(next) => onAnalysed({ ...analysis, painPoint: next.trim() })}
                />
                <SummaryField
                  label="Customer need"
                  value={analysis.customerNeed || analysis.sellingAngle}
                  onSave={(next) => onAnalysed({ ...analysis, customerNeed: next.trim() })}
                />
              </div>
            </div>
          ) : (
            <div>
              <div className="rounded-2xl bg-navy p-4 text-navy-foreground">
                <p className="text-xs tracking-[0.16em] text-navy-foreground/50 uppercase">
                  Studying your product
                </p>
                <ul className="mt-3 space-y-2.5">
                  {understandingSteps.map((label, i) => {
                    const isDone = completed > i;
                    const isActive = completed === i;
                    return (
                      <li key={label} className="flex items-center gap-3">
                        <span
                          className={cn(
                            "flex h-6 w-6 items-center justify-center rounded-full transition-all duration-500",
                            isDone
                              ? "bg-gold text-navy"
                              : "bg-navy-bright text-navy-foreground/60",
                          )}
                        >
                          {isDone ? (
                            <Check className="h-3.5 w-3.5" />
                          ) : isActive ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <span className="h-1.5 w-1.5 rounded-full bg-current" />
                          )}
                        </span>
                        <span
                          className={cn(
                            "text-sm",
                            isDone
                              ? "text-navy-foreground"
                              : isActive
                                ? "text-navy-foreground/90"
                                : "text-navy-foreground/45",
                          )}
                        >
                          {label}
                          {isActive ? "…" : ""}
                        </span>
                      </li>
                    );
                  })}
                </ul>
                <Progress
                  value={(completed / understandingSteps.length) * 100}
                  className="mt-4 h-1.5 bg-navy-foreground/15"
                />
              </div>
              <div className="mt-3 space-y-3">
                {[0, 1].map((i) => (
                  <div key={i} className="space-y-2 rounded-2xl bg-muted/70 p-3">
                    <Skeleton className="h-3.5 w-full" />
                    <Skeleton className="h-3.5 w-4/5" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- Generation progress ---------- */

function GenerationProgress({
  count,
  copyDone,
  imagesDone,
}: {
  count: number;
  copyDone: boolean;
  imagesDone: number;
}) {
  const stages = [
    { label: "Writing hooks, captions and calls to action", done: copyDone },
    {
      label: `Building ad scenes around your real product (${imagesDone} of ${count})`,
      done: imagesDone >= count,
    },
  ];
  const progress = ((copyDone ? 1 : 0) + imagesDone / count) / 2;

  return (
    <div className="mx-auto max-w-xl rounded-3xl border border-border bg-card p-8 text-center shadow-soft">
      <Loader2 className="mx-auto h-7 w-7 animate-spin text-gold" />
      <h3 className="mt-4 text-lg font-semibold">Generating {count} concepts for you</h3>
      <ul className="mt-6 space-y-2.5 text-left">
        {stages.map((stage) => (
          <li key={stage.label} className="flex items-center gap-3 text-sm">
            <span
              className={cn(
                "flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
                stage.done ? "bg-gold text-navy" : "bg-muted text-muted-foreground",
              )}
            >
              {stage.done ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <Loader2 className="h-3 w-3 animate-spin" />
              )}
            </span>
            <span className={stage.done ? "text-foreground" : "text-muted-foreground"}>
              {stage.label}
            </span>
          </li>
        ))}
      </ul>
      <Progress value={progress * 100} className="mt-6 h-2" />
      <p className="mt-4 text-xs text-muted-foreground">
        Real image generation takes a little while — cards fill in as each one lands.
      </p>
    </div>
  );
}

/* ---------- Creative theme picker ---------- */

function ThemeThumb({ id, className }: { id: ThemeId; className?: string }) {
  const theme = themes.find((t) => t.id === id)!;
  return (
    <div className={cn("relative overflow-hidden bg-navy", className)}>
      <img
        src={THEME_IMAGES[id]}
        alt={theme.label}
        className="absolute inset-0 h-full w-full object-cover"
        loading="lazy"
      />
    </div>
  );
}

function ThemePicker({
  themeIds,
  onToggle,
  onClear,
}: {
  themeIds: ThemeId[];
  onToggle: (id: ThemeId) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const chosen = themes.filter((t) => themeIds.includes(t.id));
  const preview = chosen.length ? chosen : themes.slice(0, 3);

  return (
    <div>
      <div className="flex flex-col items-center gap-4 rounded-3xl border border-border bg-card p-6 text-center shadow-soft">
        <div className="flex h-28 items-center justify-center pt-2">
          {preview.map((t, i) => (
            <ThemeThumb
              key={t.id}
              id={t.id}
              className={cn(
                "h-24 w-24 rounded-2xl border-2 border-card shadow-soft",
                i > 0 && "-ml-10",
                i === 0 && "-rotate-6",
                i === 1 && "z-10 rotate-1",
                i === 2 && "z-20 rotate-6",
              )}
            />
          ))}
        </div>

        <p className="text-base font-semibold text-foreground">Select Creative Theme</p>

        {chosen.length ? (
          <div className="flex flex-wrap justify-center gap-2">
            {chosen.map((t) => (
              <Badge
                key={t.id}
                className="cursor-pointer bg-gold-soft text-navy hover:bg-gold-soft"
                onClick={() => onToggle(t.id)}
              >
                {t.label}
                <X className="ml-1 h-3 w-3" />
              </Badge>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Ten ad styles — from a plain bold claim to a before-and-after.
          </p>
        )}

        <div className="flex w-full flex-col gap-2">
          <Button
            className="w-full rounded-full bg-navy text-navy-foreground hover:bg-navy-bright"
            onClick={() => setOpen(true)}
          >
            <LayoutGrid className="mr-1 h-4 w-4" /> Select Creative Theme
          </Button>
          {chosen.length ? (
            <Button variant="ghost" size="sm" onClick={onClear}>
              Clear
            </Button>
          ) : null}
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <div className="flex items-center justify-between gap-4 pr-6">
              <DialogTitle>Creative themes</DialogTitle>
              <span className="text-xs font-medium text-muted-foreground">
                {themeIds.length} of 3 chosen
              </span>
            </div>
            <DialogDescription>
              Choose up to three. Each concept is written and art-directed in one of these styles.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-3">
            {themes.map((t) => {
              const selected = themeIds.includes(t.id);
              return (
                <button
                  key={t.id}
                  onClick={() => onToggle(t.id)}
                  className={cn(
                    "overflow-hidden rounded-2xl border border-border bg-card text-left shadow-soft transition-all",
                    selected && "ring-2 ring-gold",
                  )}
                >
                  <div className="relative">
                    <ThemeThumb id={t.id} className="aspect-square w-full" />
                    <span
                      className={cn(
                        "absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-full",
                        selected ? "bg-gold text-navy" : "bg-card/90 text-muted-foreground",
                      )}
                    >
                      {selected ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                    </span>
                  </div>
                  <div className="p-3">
                    <p className="text-sm font-semibold">{t.label}</p>
                    <p className="text-xs text-muted-foreground">{t.logic}</p>
                  </div>
                </button>
              );
            })}
          </div>
          <div className="flex justify-end">
            <Button onClick={() => setOpen(false)}>Done</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ---------- Step 1 panels ---------- */

function UploadPanel({ onReady }: { onReady: (subject: Subject) => void }) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [busy, setBusy] = useState(false);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      setDataUrl(await fileToDataUrl(file));
      if (!name) setName(file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " "));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "We couldn't read that image file.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-6 rounded-3xl border border-border bg-card p-6 shadow-soft lg:grid-cols-[320px_1fr]">
      <button
        onClick={() => inputRef.current?.click()}
        className={cn(
          "flex aspect-square w-full flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl border border-dashed border-border bg-muted/50 transition-colors hover:border-gold",
          dataUrl && "border-solid",
        )}
      >
        {dataUrl ? (
          <img src={dataUrl} alt="Your uploaded product" className="h-full w-full object-cover" />
        ) : busy ? (
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        ) : (
          <>
            <ImagePlus className="h-7 w-7 text-muted-foreground" />
            <span className="text-sm font-semibold">Choose a photo</span>
            <span className="text-xs text-muted-foreground">JPG or PNG, up to 10MB</span>
          </>
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => void handleFile(e.target.files?.[0])}
      />

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="upload-name">Product name (optional)</Label>
          <Input
            id="upload-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Sea Salt Caramel Cold Brew"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="upload-price">Price (optional)</Label>
          <Input
            id="upload-price"
            value={price}
            inputMode="decimal"
            onChange={(e) => setPrice(e.target.value)}
            placeholder="35.99"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Your photo is the real reference for the insights and every generated scene, so the
          product stays recognisable.
        </p>
        <Button
          disabled={!dataUrl}
          onClick={() => {
            if (!dataUrl) return;
            const parsed = Number.parseFloat(price);
            onReady({
              id: `upload-${Date.now()}`,
              name: name.trim() || "Your product",
              ...(Number.isFinite(parsed) ? { price: parsed } : {}),
              displayImage: dataUrl,
              dataUrl,
              source: "upload",
            });
          }}
        >
          Study this photo <ArrowRight className="ml-1 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function ProductUrlPanel({
  onReady,
  initialUrl = "",
}: {
  onReady: (subject: Subject) => void;
  initialUrl?: string;
}) {
  const resolve = useServerFn(resolveProductUrl);
  const [url, setUrl] = useState(initialUrl);
  const [busy, setBusy] = useState(false);
  const autoRanRef = useRef(false);

  const analyze = async (value = url) => {
    if (!value.trim()) {
      toast.error("Enter a product URL first.");
      return;
    }
    setBusy(true);
    try {
      const resolved = await resolve({ data: { url: value.trim() } });
      const dataUrl = await urlToDataUrl(resolved.dataUrl);
      onReady({
        id: `url-${Date.now()}`,
        name: resolved.name,
        displayImage: dataUrl,
        dataUrl,
        source: "url",
      });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "We could not analyse that product URL.",
      );
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!initialUrl || autoRanRef.current) return;
    autoRanRef.current = true;
    setUrl(initialUrl);
    void analyze(initialUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialUrl]);

  return (
    <div className="flex flex-col items-center rounded-3xl border border-border bg-card px-8 py-16 text-center shadow-soft">
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gold-soft text-navy">
        <Link2 className="h-7 w-7" />
      </span>
      <h3 className="mt-6 text-xl font-semibold">Enter Your Product URL</h3>
      <p className="mt-2 text-sm text-muted-foreground">
        Paste a public product page and we’ll use its main photo.
      </p>
      <div className="mt-6 flex w-full max-w-lg rounded-full border border-input bg-background p-1.5 pl-4">
        <Input
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="https://yourstore.com/products/..."
          className="h-9 flex-1 border-0 bg-transparent px-0 shadow-none"
        />
        <Button className="rounded-full" disabled={busy} onClick={() => void analyze()}>
          {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1 h-4 w-4" />}
          Analyse
        </Button>
      </div>
    </div>
  );
}

/* ---------- Page ---------- */

type WizardCache = {
  step: number;
  mode: "product" | "upload" | "url";
  subject: Subject | null;
  analysis: ProductAnalysis | null;
  themeIds: ThemeId[];
  format: AdFormat;
  batch: number;
  results: AdRecord[];
  batchIndex: number;
};

const wizardCache: WizardCache = {
  step: 1,
  mode: "product",
  subject: null,
  analysis: null,
  themeIds: [],
  format: "1:1",
  batch: 3,
  results: [],
  batchIndex: 0,
};

function CreateAd() {
  const loadProducts = useServerFn(getShopifyProducts);
  const loadProduct = useServerFn(getShopifyProductByHandle);
  const writeCopy = useServerFn(generateAdCopy);
  const renderImage = useServerFn(renderAdImage);

  const [step, setStep] = useState(wizardCache.step);
  const [mode, setMode] = useState<"product" | "upload" | "url">(wizardCache.mode);
  const [subject, setSubject] = useState<Subject | null>(wizardCache.subject);
  const [preparing, setPreparing] = useState<string | null>(null);
  const [intakeUrl, setIntakeUrl] = useState("");
  const [analysis, setAnalysis] = useState<ProductAnalysis | null>(wizardCache.analysis);
  const [themeIds, setThemeIds] = useState<ThemeId[]>(wizardCache.themeIds);
  const [format, setFormat] = useState<AdFormat>(wizardCache.format);
  const [batch, setBatch] = useState(wizardCache.batch);
  const [generating, setGenerating] = useState(false);
  const [copyDone, setCopyDone] = useState(false);
  const [imagesDone, setImagesDone] = useState(0);
  const [pending, setPending] = useState(0);
  const [results, setResults] = useState<AdRecord[]>(wizardCache.results);
  const [genError, setGenError] = useState<string | null>(null);
  const batchIndex = useRef(wizardCache.batchIndex);

  const [productSearch, setProductSearch] = useState("");
  const [productsShown, setProductsShown] = useState(12);

  const productsQuery = useQuery({
    queryKey: ["shopify-products", "create"],
    queryFn: () => loadProducts({ data: { first: 100 } }),
    staleTime: 60_000,
  });
  const allProducts = (productsQuery.data?.products ?? []).map((edge) => edge.node);
  const term = productSearch.trim().toLowerCase();
  const filteredProducts = term
    ? allProducts.filter((p) => p.title.toLowerCase().includes(term))
    : allProducts;
  const products = filteredProducts.slice(0, productsShown);

  const recentQuery = useQuery({
    queryKey: ["recent-ads"],
    queryFn: () => fetchRecentAds(12),
    staleTime: 30_000,
  });

  useEffect(() => {
    wizardCache.step = step;
    wizardCache.mode = mode;
    wizardCache.subject = subject;
    wizardCache.analysis = analysis;
    wizardCache.themeIds = themeIds;
    wizardCache.format = format;
    wizardCache.batch = batch;
    wizardCache.results = results;
    wizardCache.batchIndex = batchIndex.current;
  }, [step, mode, subject, analysis, themeIds, format, batch, results]);

  useEffect(() => {
    if (step > 1 && !subject) setStep(1);
  }, [step, subject]);

  useEffect(() => {
    const intake = takeProductIntake();
    if (!intake) return;
    if (intake.kind === "upload") {
      setSubject({
        id: `upload-${Date.now()}`,
        name: intake.name || "Your product",
        displayImage: intake.dataUrl,
        dataUrl: intake.dataUrl,
        source: "upload",
      });
      setAnalysis(null);
      setStep(2);
      return;
    }
    if (intake.kind === "shopify") {
      const handle = intake.handle;
      setPreparing(handle);
      void (async () => {
        try {
          const res = await loadProduct({ data: { handle } });
          const product = res.product;
          const image = product?.images.edges[0]?.node.url;
          if (!product || !image) {
            toast.error("That product has no photo to work from.");
            return;
          }
          const dataUrl = await urlToDataUrl(image);
          const price = Number.parseFloat(product.priceRange.minVariantPrice.amount);
          setSubject({
            id: product.handle,
            name: product.title,
            ...(Number.isFinite(price) ? { price } : {}),
            displayImage: image,
            dataUrl,
            source: "shopify",
          });
          setAnalysis(null);
          setStep(2);
        } catch {
          toast.error("Could not open that product photo.");
        } finally {
          setPreparing(null);
        }
      })();
      return;
    }
    setMode("url");
    setIntakeUrl(intake.url);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startWith = (next: Subject) => {
    setSubject(next);
    setAnalysis(null);
    setStep(2);
  };

  const pickProduct = async (handle: string) => {
    const product = products.find((p) => p.handle === handle);
    const image = product?.images.edges[0]?.node.url;
    if (!product || !image) {
      toast.error("That product has no photo to work from.");
      return;
    }
    setPreparing(handle);
    try {
      const dataUrl = await urlToDataUrl(image);
      const price = Number.parseFloat(product.priceRange.minVariantPrice.amount);
      startWith({
        id: product.handle,
        name: product.title,
        ...(Number.isFinite(price) ? { price } : {}),
        displayImage: image,
        dataUrl,
        source: "shopify",
      });
    } catch {
      toast.error("Could not open that product photo.");
    } finally {
      setPreparing(null);
    }
  };

  const toggleTheme = (id: ThemeId) =>
    setThemeIds((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : prev.length >= 3 ? prev : [...prev, id],
    );

  const platformFor = (index: number): Platform => (index % 2 === 0 ? "instagram" : "facebook");

  const renderAndSave = useCallback(
    async (
      draftId: string,
      concept: {
        theme: ThemeId;
        audience: string;
        coreIdea: string;
        headline: string;
        caption: string;
        cta: string;
        imageBrief: string;
        overlay?: { hero: string; support?: string; attribution?: string; badge?: string };
      },
      platform: Platform,
      subj: Subject,
      chosenFormat: AdFormat,
    ) => {
      try {
        const { path, signedUrl } = await renderImage({
          data: {
            imageDataUrl: subj.dataUrl,
            imageBrief: concept.imageBrief,
            productName: subj.name,
            format: chosenFormat,
            theme: concept.theme,
            ...(concept.overlay?.hero ? { overlay: concept.overlay } : {}),
          },
        });
        const saved = await saveGeneratedAd({
          productId: subj.source === "shopify" ? subj.id : null,
          productName: subj.name,
          platform,
          format: chosenFormat,
          theme: concept.theme,
          objective: DEFAULT_OBJECTIVE,
          source: subj.source,
          audience: concept.audience,
          coreIdea: concept.coreIdea,
          headline: concept.headline,
          caption: concept.caption,
          cta: concept.cta,
          ...(concept.overlay?.hero ? { overlay: concept.overlay } : {}),
          imageUrl: signedUrl,
          imagePath: path,
        });
        setResults((prev) => prev.map((r) => (r.id === draftId ? saved : r)));
        void recentQuery.refetch();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Image generation failed.");
        setResults((prev) => prev.filter((r) => r.id !== draftId));
      } finally {
        // One rendered image = one credit (refunded on failure) — refresh the counter either way.
        notifyCreditsChanged();
        setImagesDone((n) => n + 1);
        setPending((n) => Math.max(0, n - 1));
      }
    },
    [renderImage, recentQuery],
  );

  const runGeneration = async (count: number) => {
    if (!subject) {
      setStep(1);
      toast.error("Choose a product, upload a photo, or paste a product URL first.");
      return;
    }
    if (!analysis) {
      toast.error("We are still reading your product details — try again in a moment.");
      return;
    }
    if (themeIds.length === 0) {
      toast.error("Pick at least one creative theme (up to 3) before generating.");
      return;
    }
    const chosenThemes = themes.filter((t) => themeIds.includes(t.id));

    setGenerating(true);
    setGenError(null);
    setCopyDone(false);
    setImagesDone(0);
    setPending(count);

    try {
      const concepts = await writeCopy({
        data: {
          analysis,
          productName: subject.name,
          ...(subject.price !== undefined ? { price: subject.price } : {}),
          themes: chosenThemes,
          format,
          count,
          variantSeed: batchIndex.current,
        },
      });
      batchIndex.current += 1;
      setCopyDone(true);

      const drafts = concepts.map((concept, i) => {
        const theme = (chosenThemes.find((t) => t.id === concept.theme)?.id ??
          chosenThemes[i % chosenThemes.length]!.id) as ThemeId;
        const draft: AdRecord = {
          id: `draft-${Date.now()}-${i}`,
          title: subject.name,
          hook: concept.headline,
          caption: concept.caption,
          cta: concept.cta,
          platform: platformFor(i),
          image_url: null,
          image_path: null,
          style: theme,
          favorite: false,
        };
        return { draft, concept: { ...concept, theme } };
      });

      setResults((prev) => [...prev, ...drafts.map((d) => d.draft)]);
      setPending(drafts.length);
      setGenerating(false);

      await Promise.all(
        drafts.map((d, i) =>
          renderAndSave(
            d.draft.id,
            {
              ...d.concept,
              theme: d.concept.theme as ThemeId,
            },
            platformFor(i),
            subject,
            format,
          ),
        ),
      );
    } catch (err) {
      setGenError(err instanceof Error ? err.message : "Generation failed.");
      setGenerating(false);
      setPending(0);
    }
  };

  const todo: string[] = [];
  if (!subject) todo.push("Choose a product, upload a photo, or paste a product URL.");
  else if (!analysis) todo.push("Wait a moment while we finish reading your product details.");
  if (themeIds.length === 0) todo.push("Pick at least one creative theme (up to 3).");

  return (
    <AppShell
      title={step === 1 ? "Generate ads that stop the scroll" : "Generate Ad"}
      subtitle="From product to ready-to-run creatives in a couple of minutes."
    >
      <div className="space-y-7">
        {step === 1 ? (
          <section className="space-y-8">
            <div className="flex justify-center">
              <div
                className="grid w-full max-w-[540px] grid-cols-3 rounded-full border border-border bg-card p-1 shadow-soft"
                role="tablist"
                aria-label="Choose product source"
              >
                {(
                  [
                    { id: "product", label: "Shopify Product", icon: Package },
                    { id: "upload", label: "Upload Image", icon: Upload },
                    { id: "url", label: "Product URL", icon: Link2 },
                  ] as const
                ).map(({ id, label, icon: Icon }) => (
                  <Button
                    key={id}
                    type="button"
                    variant="ghost"
                    size="sm"
                    role="tab"
                    aria-selected={mode === id}
                    onClick={() => setMode(id)}
                    className={cn(
                      "h-10 min-w-0 gap-2 rounded-full px-2 text-xs font-medium transition-all sm:px-4 sm:text-sm",
                      mode === id
                        ? "bg-navy text-navy-foreground hover:bg-navy-bright hover:text-navy-foreground"
                        : "text-foreground hover:bg-muted",
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{label}</span>
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <h2 className="text-xl font-medium text-foreground">Choose Any Product</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Select your Shopify product, upload image or paste product URL and generate ads.
              </p>
            </div>

            {mode === "product" ? (
              productsQuery.isLoading ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {Array.from({ length: 4 }, (_, i) => (
                    <Skeleton key={i} className="aspect-square w-full rounded-2xl" />
                  ))}
                </div>
               ) : allProducts.length ? (
                 <div className="space-y-4">
                   {allProducts.length > 8 ? (
                     <Input
                       value={productSearch}
                       onChange={(e) => {
                         setProductSearch(e.target.value);
                         setProductsShown(12);
                       }}
                       placeholder="Search your products…"
                       className="h-11 max-w-sm rounded-full"
                       aria-label="Search your products"
                     />
                   ) : null}
                   {products.length === 0 ? (
                     <p className="text-sm text-muted-foreground">
                       No products match “{productSearch}”.
                     </p>
                   ) : null}
                 <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {products.map((product, index) => {
                    const image = product.images.edges[0]?.node.url;
                    return (
                      <button
                        key={product.handle}
                        disabled={preparing !== null}
                        onClick={() => void pickProduct(product.handle)}
                        className={productCardClasses(
                          subject?.id === product.handle,
                          "w-full disabled:opacity-100",
                        )}
                      >
                        <ProductCardBody
                          image={image}
                          imageAlt={product.title}
                          name={product.title}
                          price={formatPrice(
                            product.priceRange.minVariantPrice.amount,
                            product.priceRange.minVariantPrice.currencyCode,
                          )}
                          badge={index < 3 ? `#${index + 1} Best Seller` : undefined}
                          imageOverlay={
                            preparing === product.handle ? (
                              <span className="absolute inset-0 flex items-center justify-center bg-navy/40">
                                <Loader2 className="h-6 w-6 animate-spin text-navy-foreground" />
                              </span>
                            ) : null
                          }
                        />
                      </button>
                    );
                  })}
                 </div>
                   {filteredProducts.length > products.length ? (
                     <div className="text-center">
                       <Button
                         type="button"
                         variant="outline"
                         className="rounded-full"
                         onClick={() => setProductsShown((n) => n + 12)}
                       >
                         Load more products
                       </Button>
                     </div>
                   ) : null}
                 </div>
               ) : (

                <div className="rounded-3xl border border-border bg-card p-8 text-center shadow-soft">
                  <p className="text-sm font-semibold">No store products to show yet</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Connect your store from the dashboard, or upload a photo / paste a product link
                    above.
                  </p>
                  <Button asChild variant="outline" className="mt-4 rounded-full">
                    <Link to="/dashboard">Go to dashboard</Link>
                  </Button>
                </div>
              )
            ) : mode === "upload" ? (
              <UploadPanel onReady={startWith} />
            ) : (
              <ProductUrlPanel onReady={startWith} initialUrl={intakeUrl} />
            )}
          </section>
        ) : null}

        {step === 2 && subject ? (
          <section className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_auto_minmax(280px,1fr)]">
              <div className="space-y-3">
                <h3 className="text-xl font-medium text-foreground">Product</h3>
                <ProductPanel
                  subject={subject}
                  analysis={analysis}
                  onAnalysed={setAnalysis}
                  onChangeProduct={() => setStep(1)}
                  onDeleteProduct={() => {
                    setSubject(null);
                    setAnalysis(null);
                    setStep(1);
                  }}
                />
              </div>

              <div className="hidden items-center justify-center pt-16 lg:flex">
                <span className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-card shadow-soft">
                  <Plus className="h-5 w-5 text-navy" />
                </span>
              </div>

              <div className="space-y-3">
                <div className="flex items-baseline justify-between">
                  <h3 className="text-xl font-medium text-foreground">Creative themes</h3>
                  <span className="text-xs text-muted-foreground">{themeIds.length} of 3 chosen</span>
                </div>
                <ThemePicker
                  themeIds={themeIds}
                  onToggle={toggleTheme}
                  onClear={() => setThemeIds([])}
                />
              </div>
            </div>

            {todo.length ? (
              <div className="rounded-2xl border border-gold/40 bg-gold-soft/50 p-4">
                <p className="flex items-center gap-2 text-sm font-semibold text-navy">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  Finish these to generate your ads
                </p>
                <ul className="mt-2 space-y-1 pl-6 text-sm text-navy/80">
                  {todo.map((item) => (
                    <li key={item} className="list-disc">
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="flex flex-col gap-4 rounded-3xl border border-border bg-card p-4 shadow-soft lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground">Format:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {formats.map((f) => (
                      <button
                        key={f.id}
                        onClick={() => setFormat(f.id)}
                        className={cn(
                          "rounded-full border px-3 py-1 text-xs transition-colors",
                          format === f.id
                            ? "border-gold bg-gold-soft font-semibold text-navy"
                            : "border-border bg-card text-muted-foreground hover:border-gold/50",
                        )}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground">Concepts:</span>
                  <div className="flex gap-1.5">
                    {[1, 3, 5].map((n) => (
                      <button
                        key={n}
                        onClick={() => setBatch(n)}
                        className={cn(
                          "h-8 w-9 rounded-full border text-xs font-semibold transition-colors",
                          batch === n
                            ? "border-gold bg-gold-soft text-navy"
                            : "border-border bg-card text-muted-foreground hover:border-gold/50",
                        )}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {batch} credit{batch === 1 ? "" : "s"}
                  </span>
                </div>
              </div>

              <Button
                size="lg"
                className="rounded-full bg-navy px-7 text-navy-foreground hover:bg-navy-bright"
                disabled={generating}
                onClick={() => void runGeneration(batch)}
              >
                <Sparkles className="mr-1 h-4 w-4" />
                {generating ? "Generating…" : "Generate Ads"}
              </Button>
            </div>

            {genError ? (
              <p className="flex items-start gap-2 rounded-2xl bg-destructive/10 p-3 text-sm text-destructive">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {genError}
              </p>
            ) : null}

            {generating ? (
              <>
                <GenerationProgress count={batch} copyDone={copyDone} imagesDone={imagesDone} />
                <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                  {Array.from({ length: batch }, (_, i) => (
                    <AdCardSkeleton key={i} />
                  ))}
                </div>
              </>
            ) : null}

            {results.length > 0 && !generating ? (
              <div className="space-y-5">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <h3 className="text-xl font-semibold">{results.length} concepts ready</h3>
                    <p className="text-sm text-muted-foreground">
                      {pending > 0
                        ? `Still painting ${pending} scene${pending === 1 ? "" : "s"} around your product…`
                        : "Star the ones worth running — they're saved to your gallery either way."}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    className="rounded-full"
                    disabled={pending > 0}
                    onClick={() => void runGeneration(5)}
                  >
                    <Plus className="mr-1 h-4 w-4" /> Generate 5 more
                  </Button>
                </div>
                <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                  {results.map((ad) => (
                    <AdCard
                      key={ad.id}
                      ad={ad}
                      onChange={(next) =>
                        setResults((prev) => prev.map((r) => (r.id === next.id ? next : r)))
                      }
                    />
                  ))}
                </div>
              </div>
            ) : null}

            <RecentGenerations ads={recentQuery.data ?? []} />
          </section>
        ) : null}
      </div>
    </AppShell>
  );
}

function RecentGenerations({ ads }: { ads: AdRecord[] }) {
  const scroller = useRef<HTMLDivElement | null>(null);
  const recent = ads.filter((a) => a.image_url).slice(0, 12);
  if (!recent.length) return null;

  return (
    <section className="space-y-4 pt-2">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h3 className="text-xl font-medium text-foreground">Recent generated ads</h3>
        <Button variant="outline" size="sm" className="rounded-full px-5" asChild>
          <Link to="/gallery">View all</Link>
        </Button>
      </div>

      <div className="relative">
        <div
          ref={scroller}
          className="flex gap-4 overflow-x-auto scroll-smooth pb-2"
          role="list"
          aria-label="Recent ad generations"
        >
          {recent.map((ad) => (
            <div key={ad.id} role="listitem" className="w-[300px] shrink-0">
              <AdCard ad={ad} compact />
            </div>
          ))}
        </div>

        <div className="pointer-events-none absolute top-0 right-0 bottom-2 w-20 bg-gradient-to-l from-background to-transparent" />
        <button
          aria-label="Scroll right"
          onClick={() => scroller.current?.scrollBy({ left: 400, behavior: "smooth" })}
          className="absolute top-1/2 right-2 -translate-y-1/2 rounded-full bg-navy p-2 text-navy-foreground shadow-soft transition-colors hover:bg-navy-bright"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </section>
  );
}
