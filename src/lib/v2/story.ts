/**
 * The story rules shared by "Write with AI" (writer.ts) and the Concept shot writer
 * (concept.ts). Pure text, no imports.
 */

/** Openings and endings every product ad already uses. */
export const STORY_CLICHES = [
  "a tired person waking up to a beautiful morning",
  "someone admiring their own glow in a mirror or window",
  "closed eyes and a content sigh",
  "a smile at the camera as the ending",
  "friends laughing for no reason",
  "a slow push-in on the product as the only event",
];

/**
 * What makes it an ad people get (the course method: skills daily-ad-ideas, ad-ending-variants).
 * Rewritten 2026-11-26: the old rules asked for "a turn nobody saw coming" and pushed stories
 * past real life, which gave odd gags (serum dropped on glasses) that never sold the product.
 */
export const STORY_RULES = [
  "Insight first: build it on ONE true, everyday thing the buyer of this product recognises in themselves, about the moment they need it or the small problem it solves. Take it from the product details: who uses it, when, and why.",
  "One-read test: the whole ad fits in one plain sentence a 12-year-old understands, with the sound off, on the first viewing. Simple beats clever.",
  "The product is the payoff: the ending shows what this product really does for the person (its benefit from the details) as a visible change in their moment or their face. Never a joke at the product's expense, never the product misused, spilled, dropped or used by accident.",
  "Shape: hook (the first 2 seconds show the recognisable moment, so the viewer thinks 'that's me'), then the product in natural use (its texture, ritual or detail), then the ending that lands ONE emotion with the product as hero.",
  "Humor comes from recognition (how true the moment is), not from absurd situations. Exaggerate at most a little, once, and never into a believable claim about results.",
  "Swap test: the moment and the payoff should fit this product's own use, look or ritual, not any product in any category.",
  "One human touch: a small real detail (a habit, a glance, a sound) that makes it feel lived in.",
  "Keep it filmable by today's video models: one person, one everyday place, the product as the one prop, small believable actions (a look, a pause, reaching, holding, turning, applying, opening). No effect carries the story.",
  "Never needs: glowing, beams, magic, melting, cutting, breaking, pouring precisely, fast hands, food being eaten, animals acting, mirrors, crowds, screens or any words apart from the product label.",
  "Do not build it on the last drop, an empty bottle, a fight over the product, or a disaster with it.",
  `Never use: ${STORY_CLICHES.join("; ")}.`,
].join("\n");

/** Each clip starts from its still, so the still must be the moment before the motion. */
export const FRAME_MOTION_RULE =
  "The frame is the instant BEFORE the motion: whatever the motion changes has not happened yet (a bottle about to be set down is still in the hand). Both hands must be free for what the motion asks. Never say left or right. Keep the whole head in frame when the face is shown. Use the same shot size in frame and motion, and one simple action that finishes in 5 seconds.";
