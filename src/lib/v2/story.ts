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

/** What makes it a story: someone wants something, it goes wrong, the product turns it. */
export const STORY_RULES = [
  "Story engine: one person WANTS something small and specific, something gets in the way, and the product causes a turn nobody saw coming. Join the beats with 'but' or 'so', never 'and then'.",
  "Start from a true human habit or secret people recognise in themselves, then push it one step further than real life. Exaggeration must be obviously playful, never a believable claim about results.",
  "Swap test: if another product in the category could replace this one and the story still works, throw it away. The turn must come from this product's own use, shape, name or ritual.",
  "Mute test: a 12-year-old understands it with the sound off.",
  "Open in the middle of something odd, funny or tense, so the first second raises a question. The ending answers it with a surprise that makes sense in hindsight.",
  "Keep it filmable by today's video models: one person, one everyday place, one prop, small believable actions (a look, a pause, reaching, holding, turning, applying, opening). The surprise lives in the situation, the reaction or the cut between shots, never in an effect.",
  "Never needs: glowing, beams, magic, melting, cutting, breaking, pouring precisely, fast hands, food being eaten, animals acting, mirrors, crowds, screens or any words apart from the product label.",
  "Do not build it on the last drop, an empty bottle, a fight over the product, or a disaster with it.",
  `Never use: ${STORY_CLICHES.join("; ")}.`,
].join("\n");

/** Each clip starts from its still, so the still must be the moment before the motion. */
export const FRAME_MOTION_RULE =
  "The frame is the instant BEFORE the motion: whatever the motion changes has not happened yet (a bottle about to be set down is still in the hand). Both hands must be free for what the motion asks. Use the same shot size in frame and motion, and one simple action that finishes in 5 seconds.";
