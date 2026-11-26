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
 * What makes a Concept ad (the course method: daily-ad-ideas, mind-travel-shot-list,
 * ai-ad-master-shot, ai-ad-storyboard, ad-ending-variants). Rewritten 2026-11-26 from Sufyan's
 * reference ads: a burnt-out office worker meets a tiger ("the wild is calling" for a safari),
 * lightning sets a tree ablaze as a couple open an energy drink, oranges burst around a juice.
 * The earlier rules banned exactly these moves and gave flat, everyday clips.
 */
export const STORY_RULES = [
  "Big idea: dramatise what the product does as ONE bold visual idea the camera can show: a visual metaphor (the benefit made literal), a borrowed genre (horror creep, action, romance, western) or one heightened impossible moment that still feels grounded. The idea can be said in one sentence and nobody would scroll past it.",
  "Insight underneath: the idea grows from a true feeling the buyer knows (stuck, tired, bored, craving, proud, nervous), so it lands as 'that's me', however big the image.",
  "One-read test: a viewer gets it on the first watch with the sound off.",
  "The product turns it: the product is what causes or answers the big moment, and the film gives it a hero beat (styled, label exact) before the brand ending. Never a joke at the product's expense, never the product spilled, broken or misused.",
  "Shape: hook in the first second (an image that raises a question), the build, the turn (the big idea lands), the product hero, the payoff on the person's face and the brand line.",
  "Direction: cinematic and art-directed. A deliberate palette of 2-3 colours, motivated dramatic light, real depth, and shots a director would choose (foreground, other POV, low angles, macro), never flat stock daylight.",
  "One human touch: a small real detail (a habit, a glance, a sound) that makes it feel lived in.",
  "Filmable by today's video models: at most two people in a shot, simple clear actions, one move per shot. Avoid readable text other than the product label, fiddly hand work (tying, typing, precise pouring), eating and drinking in close-up, and fast complex choreography.",
  "Do not build it on the last drop, an empty bottle, a fight over the product, or a disaster with it.",
  `Never use: ${STORY_CLICHES.join("; ")}.`,
].join("\n");

/** Each clip starts from its still, so the still must be the moment before the motion. */
export const FRAME_MOTION_RULE =
  "The frame is the instant BEFORE the motion: whatever the motion changes has not happened yet (a bottle about to be set down is still in the hand). Both hands must be free for what the motion asks. Never say left or right. Keep the whole head in frame when the face is shown. Use the same shot size in frame and motion, and one clear action that lands within the first 3 seconds (the ad keeps about 3.5 seconds of each clip).";
