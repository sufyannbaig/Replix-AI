import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { captionCues, toVtt } from "@/lib/v2/captions";
import {
  ArrowLeft,
  Check,
  Copy,
  Download,
  Eye,
  Play,
  RefreshCw,
  Trash2,
  TriangleAlert,
  Type,
  Wand2,
} from "lucide-react";
import { EditPhotoDialog } from "@/v2/components/studio/EditPhotoDialog";
import { EditAdDialog } from "@/v2/components/studio/EditAdDialog";
import { ConceptFrames } from "@/v2/components/studio/ConceptFrames";
import { FeedbackBar } from "@/v2/components/studio/FeedbackBar";
import { toast } from "sonner";
import { useBrandKits, useGenerationJob } from "@/v2/data/api";
import { useDeleteOutput } from "@/v2/data/account";
import { ChannelPreviewDialog } from "@/v2/components/studio/ChannelPreview";
import { brandLogo } from "@/v2/data/types";
import type {
  AspectRatio,
  GenerationJob,
  GenerationKind,
  GenerationOutput,
  StudioKey,
} from "@/v2/data/types";
import { AppShell } from "@/v2/components/shell/AppShell";
import { PillButton, PillLink, pillClass } from "@/v2/components/primitives";
import { ASPECT_OPTIONS } from "@/v2/components/studio/ComposerBar";
import { useGenerate } from "@/v2/components/studio/useGenerate";
import { markAi } from "@/v2/components/saveFile";
import { generationCost } from "@/v2/data/pricing";
import { cn } from "@/lib/utils";
import creditCoin from "@/assets/v2/credit-coin.png";

/* Sample-data results have made-up ids and nothing to delete. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const Route = createFileRoute("/_app/generations/$jobId")({
  head: () => ({ meta: [{ title: "Your generation · Replix AI" }] }),
  component: GenerationResultPage,
});

/*
 * Generate → Result. Not in Figma; designed in the 2.0 style (white 18px cards on the
 * dotted canvas, navy pill actions). Every studio's Generate lands here.
 */
const STUDIOS: Record<
  StudioKey,
  {
    label: string;
    to:
      | "/photo-studio"
      | "/ad-studio"
      | "/video-studio/ugc"
      | "/video-studio/shorts"
      | "/video-studio/concept";
  }
> = {
  photo: { label: "Photo Studio", to: "/photo-studio" },
  ad: { label: "Ad Studio", to: "/ad-studio" },
  ugc: { label: "AI UGC Ads", to: "/video-studio/ugc" },
  shorts: { label: "Product Shorts", to: "/video-studio/shorts" },
  concept: { label: "Concept Ads", to: "/video-studio/concept" },
};

const NOUN: Record<GenerationKind, [string, string]> = {
  photo: ["photo", "photos"],
  ad: ["ad", "ads"],
  video: ["video", "videos"],
};

const STAGES: Record<GenerationKind, string[]> = {
  photo: [
    "Reading your product",
    "Setting up the scene",
    "Lighting the shot",
    "Adding final touches",
  ],
  ad: ["Reading your product", "Writing the hook", "Laying out the ad", "Adding final touches"],
  video: [
    "Reading your product",
    "Casting and staging",
    "Rendering frames",
    "Adding sound and transitions",
  ],
};
/* Shorts, by the server's own steps: frame to 40%, fal to 95%, saving at 99%. No sound. */
function shortsStage(progress: number) {
  if (progress < 0.15) return "Reading your product";
  if (progress < 0.4) return "Making the first frame";
  if (progress < 0.99) return "Animating your product";
  return "Saving your video";
}

/* 16:9 is sized by width; the taller ratios by the stage height (from sm up). */
const FRAME: Record<AspectRatio, string> = {
  "1:1": "aspect-square w-full max-w-[420px] sm:h-full sm:w-auto sm:max-w-full",
  "4:5": "aspect-[4/5] w-full max-w-[340px] sm:h-full sm:w-auto sm:max-w-full",
  "9:16": "aspect-[9/16] w-full max-w-[260px] sm:h-full sm:w-auto sm:max-w-full",
  "16:9": "aspect-video w-full",
};

const THUMB: Record<AspectRatio, string> = {
  "1:1": "aspect-square",
  "4:5": "aspect-[4/5]",
  "9:16": "aspect-[9/16]",
  "16:9": "aspect-video",
};

function GenerationResultPage() {
  const { jobId } = Route.useParams();
  const { data: job, isLoading } = useGenerationJob(jobId);

  if (isLoading || job === undefined) {
    return (
      <AppShell title="Loading…">
        <div className="mt-10 h-[560px] animate-pulse rounded-[18px] bg-v2-surface" />
      </AppShell>
    );
  }
  if (job === null) return <NotFound />;
  return <Result key={job.id} job={job} />;
}

function Result({ job }: { job: GenerationJob }) {
  const { request, status } = job;
  /* Today's price, not the one stored with the job: the server charges today's price. */
  const regenerateCost = generationCost(
    request.kind,
    request.count,
    request.seconds,
    request.studio,
  );
  const studio = STUDIOS[request.studio];
  const noun = NOUN[request.kind];
  const plural = request.count > 1;
  const { generate, pending } = useGenerate();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = job.outputs.find((o) => o.id === selectedId) ?? job.outputs[0];
  const navigate = useNavigate();
  const remove = useDeleteOutput();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const deleteSelected = () => {
    if (!selected || !UUID_RE.test(selected.id)) return;
    if (!confirmDelete) return setConfirmDelete(true);
    remove.mutate(selected.id, {
      onSuccess: () => {
        toast.success("Deleted for good.");
        setConfirmDelete(false);
        const rest = job.outputs.filter((o) => o.id !== selected.id);
        if (rest.length) setSelectedId(rest[0].id);
        else void navigate({ to: "/assets" });
      },
      onError: (e) => toast.error(e instanceof Error ? e.message : "Couldn't delete it."),
    });
  };
  /* Fix after: real Photo Studio photos only (sample results have no stored photo). */
  const [editing, setEditing] = useState(false);
  /* Ads: change the words or layout over the same photo, for free. */
  const [editingText, setEditingText] = useState(false);
  const [downloading, setDownloading] = useState(false);
  /* Ads: see the ad in Facebook, Instagram, Stories, Reddit, X and LinkedIn feeds. */
  const [previewing, setPreviewing] = useState(false);
  const { data: kits = [] } = useBrandKits();
  const kit = kits.find((k) => k.id === request.brandKitId) ?? kits[0];
  const canPreview = request.kind === "ad" && !!selected;
  const canEdit = request.studio === "photo" && !!selected && /^[0-9a-f-]{36}$/i.test(selected.id);
  const canEditText = request.kind === "ad" && !!selected?.edit;

  /* Announce completion only when it happens here, not when reopening a finished result. */
  const previousStatus = useRef(status);
  useEffect(() => {
    if (status === "done" && previousStatus.current !== "done") {
      toast.success(`Your ${plural ? noun[1] : noun[0]} ${plural ? "are" : "is"} ready`);
    }
    previousStatus.current = status;
  }, [status, plural, noun]);

  const title =
    status === "done"
      ? `Your ${plural ? noun[1] : noun[0]} ${plural ? "are" : "is"} ready`
      : status === "failed"
        ? "Generation didn't finish"
        : job.review
          ? "Check your frames"
          : `Creating your ${plural ? noun[1] : noun[0]}…`;

  return (
    <AppShell
      title={title}
      subtitle={`${studio.label} · ${request.product.name}`}
      actions={
        <PillLink
          to={studio.to}
          variant="outline"
          className="h-11 px-4 text-sm lg:h-[57px] lg:px-6 lg:text-base"
        >
          <ArrowLeft className="size-4" /> Back to {studio.label}
        </PillLink>
      }
    >
      <div className="mt-8 grid gap-6 lg:mt-10 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
        <section className="flex min-w-0 flex-col gap-4 rounded-[18px] bg-v2-surface p-3 sm:p-4">
          {job.review && status === "running" ? (
            <ConceptFrames job={job} />
          ) : (
            <div className="flex items-center justify-center rounded-[12px] bg-v2-canvas p-4 sm:h-[520px] sm:p-6 lg:h-[560px]">
              {status === "done" && selected ? (
                <Viewer job={job} output={selected} />
              ) : status === "failed" ? (
                <Failed
                  job={job}
                  pending={pending}
                  onRetry={() => generate(request, { replace: true })}
                />
              ) : (
                <Progress job={job} />
              )}
            </div>
          )}

          {job.takeCheck ? <TakeCheck check={job.takeCheck} /> : null}

          {request.count > 1 ? (
            <div
              className="flex gap-3 overflow-x-auto px-1 pb-1"
              role="listbox"
              aria-label="Variations"
            >
              {status === "done"
                ? job.outputs.map((o, i) => (
                    <button
                      key={o.id}
                      type="button"
                      role="option"
                      aria-selected={o.id === selected?.id}
                      aria-label={`Variation ${i + 1}`}
                      onClick={() => setSelectedId(o.id)}
                      className={cn(
                        "relative h-[88px] shrink-0 overflow-hidden rounded-[10px] outline-none ring-offset-2 ring-offset-v2-surface focus-visible:ring-2 focus-visible:ring-v2-blue",
                        THUMB[request.aspect],
                        o.id === selected?.id
                          ? "ring-[1.7px] ring-[#124498] night:ring-v2-blue"
                          : "opacity-80 hover:opacity-100",
                      )}
                    >
                      <img src={o.imageUrl} alt="" className="size-full object-cover" />
                    </button>
                  ))
                : Array.from({ length: request.count }, (_, i) => (
                    <span
                      key={i}
                      className={cn(
                        "h-[88px] shrink-0 animate-pulse rounded-[10px] bg-v2-surface-2",
                        THUMB[request.aspect],
                      )}
                    />
                  ))}
            </div>
          ) : null}
        </section>

        <aside className="flex flex-col gap-4">
          {status === "done" && selected ? (
            <section className="flex flex-col gap-3 rounded-[18px] bg-v2-surface p-5">
              <PillButton
                onClick={() => void downloadOutput(job, selected)}
                disabled={downloading}
                className="w-full"
              >
                <Download className="size-4" /> Download
              </PillButton>
              {job.outputs.length > 1 ? (
                <button
                  type="button"
                  disabled={downloading}
                  onClick={async () => {
                    setDownloading(true);
                    try {
                      for (const o of job.outputs) await downloadOutput(job, o);
                    } finally {
                      setDownloading(false);
                    }
                  }}
                  className="font-archivo text-sm text-v2-ink-70 hover:text-v2-ink disabled:opacity-60"
                >
                  {downloading ? "Downloading…" : `Download all ${job.outputs.length}`}
                </button>
              ) : null}
              {UUID_RE.test(selected.id) ? (
                <button
                  type="button"
                  onClick={deleteSelected}
                  onBlur={() => setConfirmDelete(false)}
                  disabled={remove.isPending}
                  className={cn(
                    "flex items-center justify-center gap-2 rounded-[60px] px-4 py-2 font-archivo text-sm transition-colors disabled:opacity-60",
                    confirmDelete
                      ? "bg-red-600 text-white hover:bg-red-700"
                      : "text-v2-ink-60 hover:bg-red-50 hover:text-red-600 night:hover:bg-red-950/40",
                  )}
                >
                  <Trash2 className="size-4" />
                  {remove.isPending
                    ? "Deleting…"
                    : confirmDelete
                      ? "Click again to delete for good"
                      : plural
                        ? "Delete this one"
                        : "Delete"}
                </button>
              ) : null}
              {/* Every finished generation is listed in Assets (there's no separate history page). */}
              <div className="flex items-center justify-between gap-3 rounded-[60px] bg-v2-nav-active px-5 py-2.5 font-archivo text-base text-v2-ink">
                <span className="flex items-center gap-2">
                  <Check className="size-4" /> In your Assets
                </span>
                <Link
                  to="/assets"
                  className="font-inter-tight text-xs text-v2-ink-60 hover:text-v2-ink"
                >
                  Open
                </Link>
              </div>
              {selected && status === "done" ? (
                <FeedbackBar
                  jobId={job.id}
                  outputId={selected.id}
                  kind={request.kind === "ad" ? "ad" : request.kind === "video" ? "video" : "photo"}
                />
              ) : null}
              {canEditText ? (
                <PillButton
                  variant="outline"
                  className="w-full"
                  onClick={() => setEditingText(true)}
                >
                  <Type className="size-4" /> Edit text · free
                </PillButton>
              ) : null}
              {canPreview ? (
                <PillButton
                  variant="outline"
                  className="w-full"
                  onClick={() => setPreviewing(true)}
                >
                  <Eye className="size-4" /> Preview on Facebook, Instagram…
                </PillButton>
              ) : null}
              {canEdit ? (
                <PillButton variant="outline" className="w-full" onClick={() => setEditing(true)}>
                  <Wand2 className="size-4" /> Edit this photo
                </PillButton>
              ) : null}
              <PillButton
                variant="outline"
                className="w-full"
                disabled={pending}
                onClick={() => generate({ ...request, cost: regenerateCost })}
              >
                <RefreshCw className={cn("size-4", pending && "animate-spin")} />
                Regenerate · {regenerateCost} credits
              </PillButton>
              <Link
                to={studio.to}
                /* Back to the studio with the same product (and Photo template) picked. */
                {...(request.studio === "photo" || request.studio === "ad"
                  ? {
                      search: {
                        product: request.product.id,
                        ...(request.inputs?.studio === "photo" &&
                        request.inputs.mode === "templates"
                          ? { template: request.inputs.templateId }
                          : {}),
                      },
                    }
                  : {})}
                className="text-center font-inter-tight text-sm text-v2-blue hover:underline"
              >
                Change settings in {studio.label}
              </Link>
              <p className="text-center font-inter-tight text-xs text-v2-muted">
                Made with AI. Some platforms ask you to say so when you post.{" "}
                <Link to="/help" className="text-v2-blue hover:underline">
                  Learn more
                </Link>
              </p>
            </section>
          ) : null}

          {status === "done" && selected?.post ? (
            <PostCopy
              post={selected.post}
              b2b={request.inputs?.studio === "ad" && request.inputs.audience === "b2b"}
            />
          ) : null}
          {status === "done" && selected?.spoken ? (
            <SpokenScript
              text={selected.spoken}
              who={request.studio === "concept" ? "Voiceover" : "Script"}
            />
          ) : null}
          <Details job={job} />
        </aside>
      </div>
      {canPreview && selected ? (
        <ChannelPreviewDialog
          key={selected.id}
          open={previewing}
          onOpenChange={setPreviewing}
          image={selected.imageUrl}
          aspect={request.aspect}
          startOn={
            request.inputs?.studio === "ad" && request.inputs.audience === "b2b"
              ? "linkedin"
              : undefined
          }
          post={
            selected.post ?? {
              primary: "",
              headline: request.product.name,
              description: "",
              cta: "Shop now",
            }
          }
          brand={{
            name: kit?.name || request.product.name,
            logo: kit ? brandLogo(kit) : null,
            website: kit?.website,
          }}
        />
      ) : null}
      {canEditText && selected ? (
        <EditAdDialog
          key={`${selected.id}-${editingText}`}
          job={job}
          output={selected}
          open={editingText}
          onOpenChange={setEditingText}
        />
      ) : null}
      {canEdit && selected ? (
        <EditPhotoDialog
          key={selected.id}
          job={job}
          output={selected}
          open={editing}
          onOpenChange={setEditing}
        />
      ) : null}
    </AppShell>
  );
}

function Viewer({ job, output }: { job: GenerationJob; output: GenerationOutput }) {
  const { request } = job;
  /* Captions from the spoken words, drawn by the browser (nothing re-rendered). */
  const captions = useMemo(() => {
    if (!output.spoken || typeof URL === "undefined") return null;
    const cues = captionCues(output.spoken, {
      startMs: request.studio === "concept" ? 400 : 300,
      endMs: request.seconds ? request.seconds * 1000 : undefined,
    });
    return URL.createObjectURL(new Blob([toVtt(cues)], { type: "text/vtt" }));
  }, [output.spoken, request.studio, request.seconds]);
  useEffect(() => () => (captions ? URL.revokeObjectURL(captions) : undefined), [captions]);
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[10px] bg-v2-surface-2 shadow-[var(--v2-shadow-card)]",
        FRAME[request.aspect],
      )}
    >
      {output.videoUrl ? (
        <video
          key={output.id}
          src={output.videoUrl}
          poster={output.imageUrl || undefined}
          controls
          autoPlay
          muted
          loop
          playsInline
          aria-label={`Video of ${request.product.name}`}
          className="size-full bg-black object-cover"
        >
          {captions ? (
            <track kind="captions" src={captions} srcLang="en" label="English" default />
          ) : null}
        </video>
      ) : (
        <img
          src={output.imageUrl}
          alt={`${NOUN[request.kind][0]} of ${request.product.name}`}
          className="size-full object-cover"
        />
      )}
      {request.kind === "video" && !output.videoUrl ? (
        <>
          <button
            type="button"
            aria-label="Play video"
            onClick={() => toast.info("This video isn't ready to play.")}
            className="absolute left-1/2 top-1/2 flex size-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-[#12213d] shadow-lg backdrop-blur transition-transform hover:scale-105"
          >
            <Play className="ml-0.5 size-6 fill-current" />
          </button>
          <span className="absolute bottom-3 right-3 rounded-full bg-black/55 px-2.5 py-1 font-inter-tight text-xs text-white tabular-nums">
            0:{String(request.seconds ?? 0).padStart(2, "0")}
          </span>
        </>
      ) : null}
    </div>
  );
}

function Progress({ job }: { job: GenerationJob }) {
  const { request, status, progress } = job;
  const stages = STAGES[request.kind];
  const stage =
    status === "queued"
      ? "In the queue"
      : request.studio === "shorts"
        ? shortsStage(progress)
        : stages[Math.min(stages.length - 1, Math.floor(progress * stages.length))];
  const percent = Math.round(progress * 100);
  return (
    <div
      className={cn(
        "relative flex flex-col items-center justify-center gap-5 overflow-hidden rounded-[10px] bg-v2-surface",
        FRAME[request.aspect],
      )}
    >
      <div aria-hidden className="v2-shimmer absolute inset-0" />
      <img
        src={request.product.imageUrl}
        alt=""
        className="relative size-[38%] min-h-16 min-w-16 animate-pulse rounded-[12px] object-cover opacity-80"
      />
      <div
        className="relative flex w-[70%] max-w-[260px] flex-col items-center gap-2.5"
        role="status"
        aria-live="polite"
      >
        <span className="font-archivo text-base font-medium leading-archivo text-v2-ink">
          {stage}…
        </span>
        <span className="h-1.5 w-full overflow-hidden rounded-full bg-v2-line">
          <span
            className="v2-brand-fill block h-full rounded-full transition-[width] duration-500 ease-out"
            style={{ width: `${Math.max(4, percent)}%` }}
          />
        </span>
        <span className="font-inter-tight text-xs tabular-nums text-v2-muted">{percent}%</span>
      </div>
    </div>
  );
}

function Failed({
  job,
  pending,
  onRetry,
}: {
  job: GenerationJob;
  pending: boolean;
  onRetry: () => void;
}) {
  return (
    <div className="flex max-w-[340px] flex-col items-center gap-4 py-10 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-v2-cream text-[#b26b00]">
        <TriangleAlert className="size-5" />
      </span>
      <h2 className="type-card-title text-v2-ink">We couldn't finish this one</h2>
      <p className="font-inter-tight text-sm text-v2-muted">
        {job.error && /credits are back/i.test(job.error)
          ? job.error
          : `Something went wrong on our side. Your ${job.request.cost} credits have been refunded.`}
      </p>
      <PillButton onClick={onRetry} disabled={pending}>
        <RefreshCw className="size-4" /> Try again
      </PillButton>
    </div>
  );
}

function Details({ job }: { job: GenerationJob }) {
  const { request } = job;
  const rows: [string, ReactNode][] = [
    ["Studio", STUDIOS[request.studio].label],
    ...(request.style
      ? ([
          [
            "Style",
            <span key="style" className="flex min-w-0 items-center gap-2">
              {request.style.imageUrl ? (
                <img
                  src={request.style.imageUrl}
                  alt=""
                  className="size-6 shrink-0 rounded-[4px] object-cover"
                />
              ) : null}
              <span className="truncate">{request.style.label}</span>
            </span>,
          ],
        ] as [string, ReactNode][])
      : []),
    ["Size", ASPECT_OPTIONS.find((o) => o.value === request.aspect)?.label ?? request.aspect],
    request.kind === "video"
      ? ["Length", `${request.seconds ?? 0} sec`]
      : [
          NOUN[request.kind][1][0].toUpperCase() + NOUN[request.kind][1].slice(1),
          String(request.count),
        ],
    [
      "Credits",
      <span key="credits" className="flex items-center gap-1.5">
        <img src={creditCoin} alt="" className="size-4" />
        {request.cost}
      </span>,
    ],
  ];
  return (
    <section className="flex flex-col gap-4 rounded-[18px] bg-v2-surface p-5">
      <div className="flex items-center gap-3">
        <img
          src={request.product.imageUrl}
          alt=""
          className="size-11 shrink-0 rounded-[8px] bg-[#f5f5f5] object-cover night:bg-v2-surface-2"
        />
        <div className="min-w-0">
          <p className="truncate font-archivo text-base font-medium leading-archivo text-v2-ink">
            {request.product.name}
          </p>
          <p className="font-inter-tight text-xs text-v2-muted">Product</p>
        </div>
      </div>
      <dl className="flex flex-col divide-y divide-v2-line border-t border-v2-line">
        {rows.map(([label, value]) => (
          <div
            key={label}
            className="flex items-center justify-between gap-4 py-2.5 font-inter-tight text-sm"
          >
            <dt className="shrink-0 text-v2-muted">{label}</dt>
            <dd className="min-w-0 text-right text-v2-ink">{value}</dd>
          </div>
        ))}
      </dl>
      {request.note ? (
        <p className="rounded-[10px] bg-v2-canvas px-3 py-2.5 font-inter-tight text-xs leading-[1.4] text-v2-ink-70">
          “{request.note}”
        </p>
      ) : null}
    </section>
  );
}

function NotFound() {
  return (
    <AppShell title="Result not found">
      <div className="mt-10 flex flex-col items-start gap-4 rounded-[18px] bg-v2-surface p-8">
        <p className="max-w-[460px] font-inter-tight text-sm text-v2-muted">
          This result isn't available any more. Anything you saved is in Assets, or start a new
          generation from one of the studios.
        </p>
        <div className="flex flex-wrap gap-3">
          <PillLink to="/assets">Open Assets</PillLink>
          <Link to="/dashboard" className={pillClass("outline")}>
            Go home
          </Link>
        </div>
      </div>
    </AppShell>
  );
}

/** The words to post with an ad (Meta's Ads Manager fields), each one copyable. */
/** What the creator or narrator says, to read, copy or reuse as captions elsewhere. */
function SpokenScript({ text, who }: { text: string; who: string }) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${who} copied`);
    } catch {
      toast.error("Couldn't copy. Select the text and copy it instead.");
    }
  };
  return (
    <section className="flex flex-col gap-3 rounded-[18px] bg-v2-surface p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="type-label text-v2-ink">{who}</h2>
        <button
          type="button"
          onClick={copy}
          className="font-inter-tight text-xs text-v2-blue hover:underline"
        >
          Copy
        </button>
      </div>
      <p className="whitespace-pre-line font-inter-tight text-sm leading-[1.5] text-v2-ink">
        {text}
      </p>
      <p className="font-inter-tight text-xs text-v2-muted">
        Shown as captions on the video. Turn them off with the CC button in the player.
      </p>
    </section>
  );
}

function PostCopy({ post, b2b }: { post: NonNullable<GenerationOutput["post"]>; b2b?: boolean }) {
  const fields: [string, string][] = [
    ["Primary text", post.primary],
    ["Headline", post.headline],
    ["Description", post.description],
    ["Button", post.cta],
  ];
  const copy = async (label: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied`);
    } catch {
      toast.error("Couldn't copy. Select the text and copy it instead.");
    }
  };
  return (
    <section className="flex flex-col gap-4 rounded-[18px] bg-v2-surface p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="type-label text-v2-ink">Post copy</h2>
        <button
          type="button"
          onClick={() =>
            copy(
              "Post copy",
              fields
                .filter(([, t]) => t)
                .map(([l, t]) => `${l}:\n${t}`)
                .join("\n\n"),
            )
          }
          className="font-inter-tight text-xs text-v2-blue hover:underline"
        >
          Copy all
        </button>
      </div>
      <p className="-mt-2 font-inter-tight text-xs text-v2-muted">
        {b2b
          ? "Paste these into LinkedIn Campaign Manager or Meta Ads Manager with this ad."
          : "Paste these into Meta Ads Manager, Instagram or TikTok with this ad."}
      </p>
      <dl className="flex flex-col gap-3">
        {fields
          .filter(([, text]) => text)
          .map(([label, text]) => (
            <div key={label} className="flex flex-col gap-1.5">
              <dt className="flex items-center justify-between gap-3 font-inter-tight text-xs text-v2-muted">
                {label}
                <button
                  type="button"
                  aria-label={`Copy ${label.toLowerCase()}`}
                  onClick={() => copy(label, text)}
                  className="flex size-6 items-center justify-center rounded-full text-v2-ink-60 hover:bg-v2-canvas hover:text-v2-ink"
                >
                  <Copy className="size-3.5" />
                </button>
              </dt>
              <dd className="whitespace-pre-line rounded-[10px] bg-v2-canvas px-3 py-2.5 font-inter-tight text-sm leading-[1.45] text-v2-ink">
                {text}
              </dd>
            </div>
          ))}
      </dl>
    </section>
  );
}

/**
 * Save one result as a file. The images live on the storage domain, where the browser
 * ignores `download` and opens the picture instead, so the file is fetched first and saved
 * from a local blob.
 */
async function downloadOutput(job: GenerationJob, output: GenerationOutput) {
  if (job.request.kind === "video" && !output.videoUrl) {
    toast.info("This video isn't ready to download.");
    return;
  }
  const index = job.outputs.indexOf(output) + 1;
  const slug = job.request.product.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const url = output.videoUrl ?? output.imageUrl;
  try {
    const fetched = await fetch(url).then((r) => {
      if (!r.ok) throw new Error(String(r.status));
      return r.blob();
    });
    /* Every generated picture is saved with the "made with AI" mark in the file. */
    const blob = await markAi(fetched, job.request.kind === "ad" ? "composite" : "generated");
    const ext = blob.type.includes("jpeg")
      ? "jpg"
      : blob.type.includes("webp")
        ? "webp"
        : blob.type.includes("mp4")
          ? "mp4"
          : "png";
    const href = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = href;
    link.download = `replix-${slug}-${index}.${ext}`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(href), 10_000);
  } catch {
    /* Last resort: open it, so it can be saved from the new tab. */
    window.open(url, "_blank", "noopener");
  }
}

/** What a one-take dry run planned (preview only). */
function TakeCheck({ check }: { check: NonNullable<GenerationJob["takeCheck"]> }) {
  return (
    <div className="flex w-full max-w-[420px] flex-col gap-2 pb-8 font-inter-tight text-sm text-v2-muted">
      {check.still ? <img src={check.still} alt="" className="w-full rounded-[12px]" /> : null}
      {check.faults.length ? (
        <p className="text-[#b26b00]">Check this: {check.faults.join("; ")}</p>
      ) : (
        <p className="text-v2-ink">No faults found.</p>
      )}
      {check.shots.map((shot, i) => (
        <p key={i}>
          <span className="font-semibold text-v2-ink">
            Shot {i + 1}, {shot.seconds} s.
          </span>{" "}
          {shot.action}
        </p>
      ))}
      <p>Voice: {check.line}</p>
      <p>Wardrobe: {check.wardrobe}</p>
    </div>
  );
}
