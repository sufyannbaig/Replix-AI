import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { reviewConceptFrames } from "@/lib/v2/generation.functions";
import { queryKeys } from "@/v2/data/api";
import type { AspectRatio, GenerationJob } from "@/v2/data/types";
import { PillButton } from "@/v2/components/primitives";
import { cn } from "@/lib/utils";

const FRAME: Record<AspectRatio, string> = {
  "1:1": "aspect-square",
  "4:5": "aspect-[4/5]",
  "9:16": "aspect-[9/16]",
  "16:9": "aspect-video",
};

type Action =
  | { action: "approve" }
  | { action: "plan" }
  | { action: "accept"; index: number }
  | { action: "redo"; index: number; note?: string }
  | { action: "move"; index: number; dir: -1 | 1 };

/**
 * Concept ads: check the stills before any video is made. Redo one (optionally saying what to
 * change), move one, then approve: only then are the clips animated and charged.
 */
export function ConceptFrames({ job }: { job: GenerationJob }) {
  const review = job.review!;
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const act = useMutation({
    mutationFn: (a: Action) => reviewConceptFrames({ data: { jobId: job.id, ...a } }),
    onSettled: () => {
      setBusy(null);
      void queryClient.invalidateQueries({ queryKey: queryKeys.job(job.id) });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "That didn't work. Try again."),
  });
  const run = (key: string, a: Action) => {
    if (act.isPending) return;
    setBusy(key);
    act.mutate(a);
  };
  const n = review.frames.length;
  const planned = review.shots.every((s) => s.motion);
  const blocked = (review.issues ?? []).flatMap((list, i) => (list.length ? [i + 1] : []));

  return (
    <div className="flex w-full flex-col gap-5">
      <div>
        <p className="type-label text-black night:text-v2-ink">Check your frames</p>
        <p className="mt-1 font-inter-tight text-sm text-v2-muted">
          These stills become your ad, in this order. Redo any that aren't right ({review.redosLeft}{" "}
          free {review.redosLeft === 1 ? "redo" : "redos"} left) or move them. Nothing is animated
          until you approve.
        </p>
      </div>
      <ol className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {review.frames.map((url, i) => (
          <li key={`${i}-${url}`} className="flex flex-col gap-2 rounded-[12px] bg-v2-canvas p-2">
            <div
              className={cn(
                "relative overflow-hidden rounded-[8px] bg-v2-surface-2",
                FRAME[job.request.aspect],
                busy === `redo-${i}` && "animate-pulse",
              )}
            >
              {url ? <img src={url} alt="" className="size-full object-cover" /> : null}
              <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 font-inter-tight text-[11px] font-semibold text-white">
                {i + 1} · {review.shots[i]?.beat}
              </span>
            </div>
            {review.issues?.[i]?.length ? (
              <p role="status" className="font-inter-tight text-xs text-[#b26b00]">
                Check this: {review.issues[i].join("; ")}{" "}
                <button
                  type="button"
                  disabled={act.isPending}
                  onClick={() => run(`accept-${i}`, { action: "accept", index: i })}
                  className="font-semibold underline disabled:opacity-40"
                >
                  Use this still
                </button>
              </p>
            ) : null}
            {review.shots[i]?.motion ? (
              <p className="font-inter-tight text-xs text-v2-muted">
                Movement: {review.shots[i].motion}
              </p>
            ) : null}
            <input
              value={notes[i] ?? ""}
              onChange={(e) => setNotes((m) => ({ ...m, [i]: e.target.value }))}
              maxLength={200}
              placeholder="What to change (optional)"
              aria-label={`What to change in frame ${i + 1}`}
              className="h-8 rounded-[6px] bg-v2-surface px-2 font-inter-tight text-xs text-v2-ink outline-none placeholder:text-v2-muted"
            />
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={act.isPending || review.redosLeft < 1}
                onClick={() => run(`redo-${i}`, { action: "redo", index: i, note: notes[i] })}
                className="flex h-8 flex-1 items-center justify-center gap-1 rounded-[6px] bg-v2-surface font-inter-tight text-xs font-semibold text-v2-ink disabled:opacity-40"
              >
                <RotateCcw className="size-3.5" /> Redo
              </button>
              <button
                type="button"
                aria-label={`Move frame ${i + 1} earlier`}
                disabled={act.isPending || i === 0}
                onClick={() => run(`move-${i}`, { action: "move", index: i, dir: -1 })}
                className="flex size-8 items-center justify-center rounded-[6px] bg-v2-surface text-v2-ink disabled:opacity-30"
              >
                <ArrowLeft className="size-3.5" />
              </button>
              <button
                type="button"
                aria-label={`Move frame ${i + 1} later`}
                disabled={act.isPending || i === n - 1}
                onClick={() => run(`move-${i}`, { action: "move", index: i, dir: 1 })}
                className="flex size-8 items-center justify-center rounded-[6px] bg-v2-surface text-v2-ink disabled:opacity-30"
              >
                <ArrowRight className="size-3.5" />
              </button>
            </div>
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap items-center gap-3">
        <PillButton
          disabled={act.isPending || blocked.length > 0}
          onClick={() => run("approve", { action: planned ? "approve" : "plan" })}
          className="h-11 px-6 text-sm"
        >
          {busy === "approve"
            ? planned
              ? "Starting the video…"
              : "Planning the movement…"
            : planned
              ? "Approve and make the video"
              : "Plan the movement"}
        </PillButton>
        <span className="font-inter-tight text-xs text-v2-muted">
          {blocked.length ? `Redo frame ${blocked.join(" and ")} or use it as it is. ` : ""}
          Not approved within 2 hours? Your credits come back.
        </span>
      </div>
    </div>
  );
}
