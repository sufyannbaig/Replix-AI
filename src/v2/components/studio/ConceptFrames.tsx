import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { reviewConceptFrames } from "@/lib/v2/generation.functions";
import { makeConceptEndCard, queryKeys } from "@/v2/data/api";
import type { AspectRatio, GenerationJob } from "@/v2/data/types";
import { PillButton } from "@/v2/components/primitives";
import { cn } from "@/lib/utils";

/** How long a line takes to say, at the pace the server cuts voiceovers to. */
function readSeconds(text: string) {
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  return Math.round(words / 2.3);
}

const FRAME: Record<AspectRatio, string> = {
  "1:1": "aspect-square",
  "4:5": "aspect-[4/5]",
  "9:16": "aspect-[9/16]",
  "16:9": "aspect-video",
};

type Action =
  | { action: "approve" }
  | { action: "sound"; voiceover: string; music: string; tagline?: string }
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
  const sound = review.sound;
  const [vo, setVo] = useState<string | null>(null);
  const [music, setMusic] = useState<string | null>(null);
  const [tagline, setTagline] = useState<string | null>(null);
  const soundEdited =
    !!sound &&
    ((vo !== null && vo.trim() !== sound.voiceover) ||
      (music !== null && music.trim() !== sound.music) ||
      (tagline !== null && tagline.trim() !== (sound.tagline ?? "")));
  const currentTagline = (tagline ?? sound?.tagline ?? "").trim();

  /* The designed end card, previewed as the user edits the tagline and uploaded on approval. */
  const [card, setCard] = useState<{ tagline: string; blob: Blob; url: string } | null>(null);
  const cardRef = useRef(card);
  cardRef.current = card;
  const heroStill = review.frames[review.heroFrame ?? 0] ?? "";
  useEffect(() => {
    if (!heroStill) return;
    let live = true;
    const timer = setTimeout(() => {
      makeConceptEndCard(job, currentTagline)
        .then((blob) => {
          if (!live || !blob) return;
          setCard((old) => {
            if (old) URL.revokeObjectURL(old.url);
            return { tagline: currentTagline, blob, url: URL.createObjectURL(blob) };
          });
        })
        .catch((e) => console.warn("[v2 concept] end card preview failed", e));
    }, 500);
    return () => {
      live = false;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [heroStill, currentTagline]);
  useEffect(
    () => () => {
      if (cardRef.current) URL.revokeObjectURL(cardRef.current.url);
    },
    [],
  );
  const act = useMutation({
    mutationFn: async (a: Action) => {
      /* Unsaved sound edits go in first, so the approved ad says what the user wrote. */
      if (a.action === "approve" && soundEdited && sound) {
        await reviewConceptFrames({
          data: {
            jobId: job.id,
            action: "sound",
            voiceover: (vo ?? sound.voiceover).trim(),
            music: (music ?? sound.music).trim(),
            tagline: currentTagline,
          },
        });
      }
      /* The end card is made here, with the brand's fonts, and closes the ad. If it can't be
         made the ad still goes ahead without it. */
      if (a.action === "approve") {
        try {
          const ready = cardRef.current?.tagline === currentTagline ? cardRef.current.blob : null;
          const blob = ready ?? (await makeConceptEndCard(job, currentTagline));
          if (blob) {
            const { blobToBase64 } = await import("@/v2/data/compose-ad");
            await reviewConceptFrames({
              data: { jobId: job.id, action: "endcard", image: await blobToBase64(blob) },
            });
          }
        } catch (e) {
          console.warn("[v2 concept] end card skipped", e);
        }
      }
      return reviewConceptFrames({ data: { jobId: job.id, ...a } });
    },
    onSuccess: (_r, a) => {
      if (a.action === "sound" || a.action === "approve") {
        setVo(null);
        setMusic(null);
        setTagline(null);
      }
    },
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
              {url ? (
                /* Opens full size in a new tab: the grid tile is small. */
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`Open still ${i + 1} large`}
                >
                  <img
                    src={url}
                    alt={`Still ${i + 1}: ${review.shots[i]?.beat ?? ""}`}
                    loading="lazy"
                    decoding="async"
                    className="size-full object-cover"
                  />
                </a>
              ) : null}
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
                aria-label={`Redo frame ${i + 1}`}
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
      {sound ? (
        <div className="flex flex-col gap-3 rounded-[12px] bg-v2-canvas p-3">
          <div>
            <p className="font-inter-tight text-sm font-semibold text-v2-ink">
              Voiceover and music
            </p>
            <p className="mt-0.5 font-inter-tight text-xs text-v2-muted">
              This is exactly what your ad will say and play. Change it now: once approved, it can't
              be changed.
            </p>
          </div>
          <label className="flex flex-col gap-1">
            <span className="font-inter-tight text-xs font-semibold text-v2-ink">
              Narrator ({sound.voice})
            </span>
            <textarea
              value={vo ?? sound.voiceover}
              onChange={(e) => setVo(e.target.value)}
              maxLength={600}
              rows={3}
              aria-label="What the narrator says"
              className="rounded-[6px] bg-v2-surface px-2 py-1.5 font-inter-tight text-xs text-v2-ink outline-none"
            />
            <span
              className={cn(
                "font-inter-tight text-[11px]",
                readSeconds(vo ?? sound.voiceover) > sound.seconds - 2
                  ? "text-[#b26b00]"
                  : "text-v2-muted",
              )}
            >
              About {readSeconds(vo ?? sound.voiceover)} s to say, in a {sound.seconds} s ad.
              {readSeconds(vo ?? sound.voiceover) > sound.seconds - 2
                ? " Too long for the ad: shorten it to save."
                : ""}
            </span>
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-inter-tight text-xs font-semibold text-v2-ink">Music</span>
            <input
              value={music ?? sound.music}
              onChange={(e) => setMusic(e.target.value)}
              maxLength={300}
              aria-label="What the music sounds like"
              className="h-8 rounded-[6px] bg-v2-surface px-2 font-inter-tight text-xs text-v2-ink outline-none"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-inter-tight text-xs font-semibold text-v2-ink">
              Tagline on the end card
            </span>
            <input
              value={tagline ?? sound.tagline ?? ""}
              onChange={(e) => setTagline(e.target.value)}
              maxLength={60}
              placeholder="A few words, e.g. Become the light."
              aria-label="Tagline on the end card"
              className="h-8 rounded-[6px] bg-v2-surface px-2 font-inter-tight text-xs text-v2-ink outline-none placeholder:text-v2-muted"
            />
          </label>
          {card ? (
            <div className="flex items-start gap-3">
              <img
                src={card.url}
                alt="End card preview"
                className={cn("w-28 rounded-[6px] object-cover", FRAME[job.request.aspect])}
              />
              <p className="font-inter-tight text-xs text-v2-muted">
                Your ad ends on this card for 2.5 seconds, in your brand&apos;s fonts and colours.
              </p>
            </div>
          ) : null}
          {soundEdited ? (
            <button
              type="button"
              /* A voiceover too long for the ad would be cut mid-thought: shorten it first. */
              disabled={
                act.isPending ||
                !(vo ?? sound.voiceover).trim() ||
                !(music ?? sound.music).trim() ||
                readSeconds(vo ?? sound.voiceover) > sound.seconds - 2
              }
              onClick={() =>
                run("sound", {
                  action: "sound",
                  voiceover: (vo ?? sound.voiceover).trim(),
                  music: (music ?? sound.music).trim(),
                  tagline: currentTagline,
                })
              }
              className="self-start rounded-[6px] bg-v2-surface px-3 py-1.5 font-inter-tight text-xs font-semibold text-v2-ink disabled:opacity-40"
            >
              {busy === "sound"
                ? "Saving…"
                : readSeconds(vo ?? sound.voiceover) > sound.seconds - 2
                  ? "Shorten the voiceover to save"
                  : "Save voiceover and music"}
            </button>
          ) : null}
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        <PillButton
          disabled={act.isPending || (planned && blocked.length > 0)}
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
