import { useEffect, useState } from "react";
import { ThumbsDown, ThumbsUp } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  FEEDBACK_NOTE_MAX,
  feedbackReasons,
  type FeedbackKind,
  type Rating,
} from "@/lib/v2/feedback";
import { useOutputFeedback, useSaveFeedback } from "@/v2/data/api";

/**
 * Quick feedback on one result: thumbs up or down, then optional reasons and a short note.
 * A thumb saves straight away; the reasons are an extra tap.
 */
export function FeedbackBar({
  jobId,
  outputId,
  kind,
}: {
  jobId: string;
  outputId: string;
  kind: FeedbackKind;
}) {
  const saved = useOutputFeedback(outputId);
  const save = useSaveFeedback(jobId);
  const [rating, setRating] = useState<Rating | null>(null);
  const [reasons, setReasons] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    const s = saved.data;
    setRating(s ? (s.rating as Rating) : null);
    setReasons(s?.reasons ?? []);
    setNote(s?.note ?? "");
    setOpen(false);
    setSent(!!s);
  }, [outputId, saved.data]);

  const send = (next: { rating: Rating; reasons: string[]; note: string }, done?: () => void) =>
    save.mutate(
      { outputId, kind, ...next },
      {
        onSuccess: done,
        onError: (e) => toast.error(e instanceof Error ? e.message : "Couldn't send feedback."),
      },
    );

  const pick = (r: Rating) => {
    const keep = r === rating ? reasons : [];
    setRating(r);
    setReasons(keep);
    setOpen(true);
    setSent(false);
    send({ rating: r, reasons: keep, note });
  };

  const thumb = (r: Rating) => {
    const Icon = r === 1 ? ThumbsUp : ThumbsDown;
    return (
      <button
        type="button"
        aria-label={r === 1 ? "Good result" : "Bad result"}
        aria-pressed={rating === r}
        onClick={() => pick(r)}
        className={cn(
          "flex size-9 items-center justify-center rounded-full transition-colors",
          rating === r
            ? "bg-v2-pill text-v2-pill-ink"
            : "bg-v2-canvas text-v2-ink-70 hover:text-v2-ink night:bg-v2-surface-2",
        )}
      >
        <Icon className="size-4" />
      </button>
    );
  };

  return (
    <div className="flex flex-col gap-2.5 rounded-[12px] bg-v2-canvas/60 p-3 night:bg-v2-surface-2/60">
      <div className="flex items-center justify-between gap-2">
        <span className="font-inter-tight text-xs text-v2-ink-70">
          {sent && !open ? "Thanks for the feedback" : "How's this result?"}
        </span>
        <div className="flex gap-1.5">
          {thumb(1)}
          {thumb(-1)}
        </div>
      </div>
      {open && rating ? (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-1.5">
            {feedbackReasons(kind, rating).map((r) => {
              const on = reasons.includes(r);
              return (
                <button
                  key={r}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setReasons(on ? reasons.filter((x) => x !== r) : [...reasons, r])}
                  className={cn(
                    "rounded-[74px] px-3 py-1 font-inter-tight text-xs transition-colors",
                    on
                      ? "bg-v2-pill text-v2-pill-ink"
                      : "bg-v2-surface text-v2-ink-70 hover:text-v2-ink",
                  )}
                >
                  {r}
                </button>
              );
            })}
          </div>
          <div className="flex gap-1.5">
            <input
              value={note}
              maxLength={FEEDBACK_NOTE_MAX}
              placeholder="Anything else? (optional)"
              onChange={(e) => setNote(e.target.value)}
              className="min-w-0 flex-1 rounded-[10px] border border-v2-line bg-v2-surface px-3 py-1.5 font-inter-tight text-xs text-v2-ink outline-none placeholder:text-v2-muted focus:border-v2-blue"
            />
            <button
              type="button"
              disabled={save.isPending}
              onClick={() =>
                send({ rating, reasons, note }, () => {
                  setOpen(false);
                  setSent(true);
                })
              }
              className="rounded-[74px] bg-v2-pill px-3.5 py-1.5 font-inter-tight text-xs text-v2-pill-ink disabled:opacity-60"
            >
              Send
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
