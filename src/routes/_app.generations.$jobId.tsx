import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, Check, Download, Play, RefreshCw, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { useGenerationJob, useSaveGenerationOutput } from "@/v2/data/api";
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
import { cn } from "@/lib/utils";
import creditCoin from "@/assets/v2/credit-coin.png";

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
  const studio = STUDIOS[request.studio];
  const noun = NOUN[request.kind];
  const plural = request.count > 1;
  const { generate, pending } = useGenerate();
  const save = useSaveGenerationOutput(job.id);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = job.outputs.find((o) => o.id === selectedId) ?? job.outputs[0];

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
        : `Creating your ${plural ? noun[1] : noun[0]}…`;

  return (
    <AppShell
      title={title}
      subtitle={`${studio.label} · ${request.product.name}`}
      actions={
        <PillLink to={studio.to} variant="outline" className="h-11 px-4 text-sm">
          <ArrowLeft className="size-4" /> Back to {studio.label}
        </PillLink>
      }
    >
      <div className="mt-8 grid gap-6 lg:mt-10 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
        <section className="flex min-w-0 flex-col gap-4 rounded-[18px] bg-v2-surface p-3 sm:p-4">
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
                      {o.savedToAssets ? (
                        <span className="absolute right-1 top-1 flex size-4 items-center justify-center rounded-full bg-v2-pill text-white">
                          <Check className="size-2.5" strokeWidth={3} />
                        </span>
                      ) : null}
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
              <PillButton onClick={() => downloadOutput(job, selected)} className="w-full">
                <Download className="size-4" /> Download
              </PillButton>
              {request.count > 1 ? (
                <button
                  type="button"
                  onClick={() => job.outputs.forEach((o) => downloadOutput(job, o))}
                  className="font-archivo text-sm text-v2-ink-70 hover:text-v2-ink"
                >
                  Download all {request.count}
                </button>
              ) : null}
              {selected.savedToAssets ? (
                <div className="flex items-center justify-between gap-3 rounded-[60px] bg-v2-nav-active px-5 py-2.5 font-archivo text-base text-v2-ink">
                  <span className="flex items-center gap-2">
                    <Check className="size-4" /> Saved to Assets
                  </span>
                  <button
                    type="button"
                    onClick={() => save.mutate({ outputId: selected.id, saved: false })}
                    className="font-inter-tight text-xs text-v2-ink-60 hover:text-v2-ink"
                  >
                    Undo
                  </button>
                </div>
              ) : (
                <PillButton
                  variant="outline"
                  className="w-full"
                  disabled={save.isPending}
                  onClick={() =>
                    save.mutate(
                      { outputId: selected.id, saved: true },
                      { onSuccess: () => toast.success("Saved to Assets") },
                    )
                  }
                >
                  Save to Assets
                </PillButton>
              )}
              <PillButton
                variant="outline"
                className="w-full"
                disabled={pending}
                onClick={() => generate(request)}
              >
                <RefreshCw className={cn("size-4", pending && "animate-spin")} />
                Regenerate · {request.cost} credits
              </PillButton>
              <Link
                to={studio.to}
                className="text-center font-inter-tight text-sm text-v2-blue hover:underline"
              >
                Change settings in {studio.label}
              </Link>
            </section>
          ) : null}

          <Details job={job} />
        </aside>
      </div>
    </AppShell>
  );
}

function Viewer({ job, output }: { job: GenerationJob; output: GenerationOutput }) {
  const { request } = job;
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[10px] bg-v2-surface-2 shadow-[var(--v2-shadow-card)]",
        FRAME[request.aspect],
      )}
    >
      <img
        src={output.imageUrl}
        alt={`${NOUN[request.kind][0]} of ${request.product.name}`}
        className="size-full object-cover"
      />
      {request.kind === "video" ? (
        <>
          <button
            type="button"
            aria-label="Play video"
            onClick={() =>
              output.videoUrl
                ? window.open(output.videoUrl, "_blank", "noopener")
                : toast.info("Playback starts working once video generation is connected.")
            }
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
        Something went wrong on our side. Your {job.request.cost} credits have been refunded.
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

function downloadOutput(job: GenerationJob, output: GenerationOutput) {
  if (job.request.kind === "video" && !output.videoUrl) {
    toast.info("Video downloads start working once video generation is connected.");
    return;
  }
  const index = job.outputs.indexOf(output) + 1;
  const ext = output.videoUrl ? "mp4" : (output.imageUrl.split("?")[0].split(".").pop() ?? "png");
  const slug = job.request.product.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const link = document.createElement("a");
  link.href = output.videoUrl ?? output.imageUrl;
  link.download = `replix-${slug}-${index}.${ext.length <= 4 ? ext : "png"}`;
  document.body.appendChild(link);
  link.click();
  link.remove();
}
