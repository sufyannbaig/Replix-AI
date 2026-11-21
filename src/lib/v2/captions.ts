/**
 * Captions for a UGC or Concept video, drawn by the browser from the spoken words (WebVTT),
 * so nothing is re-rendered. Timing is an even spread at speaking pace, starting when the
 * voice comes in and squeezed to end before the video does.
 */
export type Cue = { start: number; end: number; text: string };

export function captionCues(
  text: string,
  opts: { startMs?: number; endMs?: number; wordsPerSecond?: number; maxWords?: number } = {},
): Cue[] {
  const words = text.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  if (!words.length) return [];
  const maxWords = opts.maxWords ?? 6;
  const start = opts.startMs ?? 300;
  let perWord = 1000 / (opts.wordsPerSecond ?? 2.5);
  if (opts.endMs && start + perWord * words.length > opts.endMs - 200) {
    perWord = Math.max(120, (opts.endMs - 200 - start) / words.length);
  }
  const cues: Cue[] = [];
  let i = 0;
  while (i < words.length) {
    let n = Math.min(maxWords, words.length - i);
    /* Break after a sentence end when one falls inside the chunk. */
    const stop = words.slice(i, i + n).findIndex((w) => /[.!?]$/.test(w));
    if (stop >= 1 && stop < n - 1) n = stop + 1;
    cues.push({
      start: Math.round(start + i * perWord),
      end: Math.round(start + (i + n) * perWord),
      text: words.slice(i, i + n).join(" "),
    });
    i += n;
  }
  return cues;
}

const stamp = (ms: number) => {
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  const pad = (v: number, l = 2) => String(v).padStart(l, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}.${pad(ms % 1000, 3)}`;
};

export function toVtt(cues: Cue[]) {
  return [
    "WEBVTT",
    "",
    ...cues.flatMap((c) => [`${stamp(c.start)} --> ${stamp(c.end)}`, c.text, ""]),
  ].join("\n");
}
