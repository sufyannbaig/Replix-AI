/**
 * Result feedback: thumbs up / down plus an optional short reason, so we can see where the
 * AI needs work. Pure, shared by the result screen and its tests.
 */
export type FeedbackKind = "photo" | "ad" | "video";
export type Rating = 1 | -1;

const DOWN: Record<FeedbackKind, string[]> = {
  photo: ["Product looks wrong", "Label or text wrong", "Background off", "Looks fake"],
  ad: ["Product looks wrong", "Words off", "Layout looks bad", "Colours off"],
  video: ["Product changes", "Motion looks odd", "Label or text wrong", "Too short or slow"],
};
const UP: Record<FeedbackKind, string[]> = {
  photo: ["Looks real", "Product spot on", "Ready to post"],
  ad: ["Ready to post", "Great words", "Looks premium"],
  video: ["Smooth motion", "Product spot on", "Ready to post"],
};

export const FEEDBACK_NOTE_MAX = 200;

/** The quick reasons offered for a rating. */
export function feedbackReasons(kind: FeedbackKind, rating: Rating): string[] {
  return (rating === 1 ? UP : DOWN)[kind];
}

/** What gets stored: only offered reasons, and a short, single-line note (or null). */
export function cleanFeedback(
  kind: FeedbackKind,
  input: { rating: Rating; reasons?: string[]; note?: string | null },
): { rating: Rating; reasons: string[]; note: string | null } {
  const offered = feedbackReasons(kind, input.rating);
  const reasons = [...new Set(input.reasons ?? [])].filter((r) => offered.includes(r));
  const note = (input.note ?? "").replace(/\s+/g, " ").trim().slice(0, FEEDBACK_NOTE_MAX) || null;
  return { rating: input.rating, reasons, note };
}
