/**
 * Piece By Piece art direction: each preset scene carries its own light and lens, and each
 * preset pose its own framing, instead of one generic "85mm, soft key light" line for every
 * shot. Looked up by the piece's name (the bundled presets and their catalog copies share
 * names); an upload or a name we don't know gets no extra direction and falls back to the
 * generic lines in photoPrompt. Pure, so it is tested on its own (piece-direction.test.ts).
 */

export type SceneDirection = { light: string; camera: string };

const SCENES: Record<string, SceneDirection> = {
  "white-seamless": {
    light:
      "large soft box overhead and to one side, white bounce fill, a soft contact shadow under the product.",
    camera: "100mm macro-style product lens at the product's mid-height, everything in focus.",
  },
  "sand-linen-studio": {
    light: "warm soft window light from the side, gentle falloff across the linen, soft shadows.",
    camera: "85mm lens slightly above the product, linen texture softly out of focus behind.",
  },
  "pastel-blue-sweep": {
    light: "bright even studio light with a soft gradient on the sweep, crisp short shadow.",
    camera: "70mm lens straight on at product height, clean seamless background.",
  },
  "black-gloss-with-rim-light": {
    light:
      "low-key: strong rim lights from behind on both sides outlining the product, a dark glossy reflection below, no front flood.",
    camera: "100mm lens just above the surface so the reflection shows, deep blacks.",
  },
  "marble-kitchen": {
    light: "bright morning daylight from a kitchen window, soft highlights on the marble.",
    camera: "50mm lens at counter height, kitchen softly blurred behind.",
  },
  "bathroom-vanity": {
    light:
      "soft diffused daylight, clean bright highlights on glass and ceramic, a calm spa feel; the mirror shows only the room, never a second person.",
    camera: "85mm lens at vanity height, background tiles and mirror softly out of focus.",
  },
  "cozy-bedroom": {
    light: "warm low afternoon light through sheer curtains, soft long shadows, cosy tones.",
    camera: "50mm lens at bed height, bedding softly blurred, intimate feel.",
  },
  "cafe-window-table": {
    light: "natural window light from one side, gentle contrast, warm cafe ambience behind.",
    camera: "50mm lens at table height, street and cafe interior in soft bokeh.",
  },
  "living-room-sofa": {
    light: "soft daylight filling the room, warm lamp glow in the background.",
    camera: "35mm lens at seated eye level, lived-in room softly out of focus.",
  },
  "home-office-desk": {
    light: "clean daylight from a window beside the desk, neutral colour, soft shadows.",
    camera: "50mm lens slightly above desk height, desk clutter kept minimal and soft.",
  },
  "gym-corner": {
    light: "punchy directional light with defined shadows, energetic contrast.",
    camera: "35mm lens a little low for an athletic, powerful feel.",
  },
  "sunny-balcony": {
    light: "bright outdoor sun with soft fill from the sky, crisp leafy shadows.",
    camera: "50mm lens at railing height, plants and sky softly blurred.",
  },
  "beach-at-golden-hour": {
    light: "low golden-hour sun behind or beside the product, warm rim glow, long soft shadows.",
    camera: "85mm lens low to the sand, sea and sky in creamy bokeh.",
  },
  "linen-tabletop": {
    light: "soft natural side light grazing the linen weave, gentle shadows.",
    camera: "top-down or high three-quarter 50mm view, an editorial flat-lay feel.",
  },
  "terrazzo-top": {
    light: "hard midday sun from above-side, crisp graphic shadows on the terrazzo.",
    camera: "high three-quarter 50mm view, terrazzo chips sharp near the product.",
  },
};

/**
 * Framing per pose, written so the person reads as ONE body: hands enter from where that
 * person's arms would be, and the head is either fully in frame or kept out of it.
 */
const POSES: Record<string, string> = {
  "hand-holding-product-close-up":
    "a tight close-up of the MODEL's own hand holding the product, wrist and forearm entering from the bottom of the frame towards the model's body; the face is out of focus behind with the whole head in frame, or out of frame entirely.",
  "two-hands-presenting":
    "the MODEL presents the product with both hands at chest height, both arms clearly attached to the model's shoulders, framed from the waist up with headroom.",
  "sitting-with-product-on-lap":
    "the MODEL sits with the product resting on their lap, framed from the knees up, whole head in frame.",
  "walking-with-product":
    "the MODEL walks towards the camera carrying the product, full or three-quarter body in frame with headroom.",
  "mirror-selfie":
    "the MODEL takes a mirror selfie holding the product, one reflection only, phone and product both visible, whole head in frame.",
  "over-the-shoulder-look":
    "the MODEL glances back over the shoulder holding the product, framed from the waist up, whole head in frame.",
  "product-at-face-level":
    "the MODEL holds the product beside their face at cheek height, framed head and shoulders with headroom, the face fully in frame.",
  "hand-reaching-into-a-flat-lay":
    "top-down flat lay; only the MODEL's hand and forearm reach in from one edge to the product, no face.",
  "chin-rest":
    "the MODEL rests their chin on one hand with the product close by, framed head and shoulders with headroom.",
  "back-glance":
    "the MODEL is turned away and glances back, product held at their side, framed from the waist up.",
  "phone-selfie":
    "the MODEL takes a phone selfie holding the product near their face, framed head and shoulders, whole head in frame.",
  "seated-on-chair":
    "the MODEL sits on a chair with the product in hand, full body in frame with headroom.",
  "reach-to-camera":
    "the MODEL reaches the product towards the camera, the arm clearly attached to their shoulder, framed from the waist up.",
  "side-turn":
    "the MODEL stands turned to the side holding the product, three-quarter body in frame with headroom.",
  "cuff-adjust":
    "the MODEL adjusts a cuff with the product in view, framed from the chest up, whole head in frame.",
  "seated-on-block":
    "the MODEL sits on a block with the product, full body in frame with headroom.",
  "laptop-on-stool":
    "the MODEL works at a laptop on a stool with the product beside it, full body in frame.",
};

const slug = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/** The light and lens for a preset scene, by its name; undefined for uploads. */
export function sceneDirection(name: string | undefined): SceneDirection | undefined {
  return name ? SCENES[slug(name)] : undefined;
}

/** The framing for a preset pose, by its name; undefined for uploads. */
export function poseFraming(name: string | undefined): string | undefined {
  return name ? POSES[slug(name)] : undefined;
}

/** Rules added whenever a person is in the shot (a MODEL or a POSE picked). */
export const PERSON_RULES = [
  "Exactly one person: every hand, arm and the face belong to the same MODEL, with arms visibly connected to their shoulders. No extra or disembodied hands.",
  "Five fingers per hand, natural grip on the product, fingers never covering the label.",
  "Never crop through the head: keep the whole head in frame with a little headroom, or keep the face out of frame entirely.",
];

/* Camera step (Phase 2): the user's own size, position, angle and light. */
type Shot = {
  size: "small" | "medium" | "large";
  position: string;
  angle: "eye" | "above" | "top-down" | "low";
  light: "scene" | "daylight" | "golden" | "studio" | "moody";
};

const SIZE_TEXT: Record<Shot["size"], string> = {
  small: "small in the frame, about a fifth of the frame height, with plenty of set around it",
  medium: "a clear hero, about two fifths of the frame height",
  large: "large and close, filling well over half of the frame height, details crisp",
};

const ANGLE_TEXT: Record<Shot["angle"], string> = {
  eye: "eye level with the product, straight on",
  above: "slightly above, a three-quarter view looking down about 30 degrees",
  "top-down": "directly overhead, a flat-lay view looking straight down",
  low: "low angle looking slightly up at the product, so it feels bold and heroic",
};

export const LIGHT_TEXT: Record<Exclude<Shot["light"], "scene">, string> = {
  daylight: "bright natural daylight from a window, soft and clean, true colours.",
  golden: "warm golden-hour sun low from one side, long soft shadows, a gentle glow.",
  studio: "clean studio lighting: a large soft box key, white fill, crisp product edges.",
  moody: "low-key moody light: one directional source, deep soft shadows, rich contrast.",
};

/** The prompt lines for the camera step; [] for the defaults the scene already covers. */
export function shotLines(shot: Shot | undefined): string[] {
  if (!shot) return [];
  const [row, col] = shot.position.split("-");
  const where =
    shot.position === "middle-center"
      ? "centred in the frame"
      : `in the ${row === "middle" ? "middle" : row} ${col === "center" ? "centre" : col} of the frame`;
  return [
    `- Placement: the product sits ${where}, ${SIZE_TEXT[shot.size] ?? SIZE_TEXT.medium}. Keep this placement exactly.`,
    `- Angle: ${ANGLE_TEXT[shot.angle] ?? ANGLE_TEXT.eye}.`,
  ];
}

/** The light the user picked; undefined keeps the scene's own light. */
export function shotLight(shot: Shot | undefined): string | undefined {
  return shot && shot.light !== "scene" ? LIGHT_TEXT[shot.light] : undefined;
}
