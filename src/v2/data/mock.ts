/**
 * Front-end fixtures for Replix 2.0. Every value here is placeholder data that the
 * backend will replace through ./api.ts; nothing outside the data folder imports it.
 */
import type {
  BrandKit,
  CommunityCreation,
  CreationKind,
  PhotoTemplate,
  PhotoTemplateCategory,
  AdTheme,
  Generation,
  HelpFaq,
  PieceKind,
  PieceOption,
  Product,
  ProductInsights,
  ShortStyle,
  ShortTemplate,
  UgcTemplate,
} from "./types";
import ugc1 from "@/assets/v2/ugc/template-01.png";
import ugc2 from "@/assets/v2/ugc/template-02.png";
import ugc3 from "@/assets/v2/ugc/template-03.png";
import ugc4 from "@/assets/v2/ugc/template-04.png";
import themeBeforeAfter from "@/assets/v2/themes/before-after.png";
import themeBoldOffer from "@/assets/v2/themes/bold-offer.png";
import cookieDough from "@/assets/v2/gallery/d1471.png";
import mercuryLogo from "@/assets/v2/home/mercury-logo.svg";
import brandLogoPrimary from "@/assets/v2/brand/logo-primary.png";
import brandLogoLight from "@/assets/v2/brand/logo-light.png";
import vanilla from "@/assets/v2/gallery/d1a08.png";
import mocha from "@/assets/v2/gallery/d726d.png";
import truffle from "@/assets/v2/gallery/908f4.png";
import cleanser from "@/assets/v2/gallery/b6106.png";
import sodaSip from "@/assets/v2/gallery/a52d4.png";
import sodaHand from "@/assets/v2/gallery/35540.png";
import serum from "@/assets/v2/gallery/0b20a.png";
import sodaCan from "@/assets/v2/gallery/44dcb.png";
import sodaCherry from "@/assets/v2/gallery/e9c3b.png";

export const brandKits: BrandKit[] = [
  {
    id: "bk_mercury",
    name: "Mercury",
    website: null,
    logos: [mercuryLogo],
    colors: [],
    fonts: null,
    toneTags: [],
    tone: null,
    audience: null,
    images: [],
    isComplete: false,
  },
];

const brandImages = import.meta.glob<string>("@/assets/v2/brand/image-*.png", {
  eager: true,
  import: "default",
});

/** What the website extraction returns for the demo (Figma "Brand Kit - Filled"). */
export function sampleExtractedKit(base: BrandKit, website: string): BrandKit {
  return {
    ...base,
    website,
    logos: [brandLogoPrimary, brandLogoLight],
    colors: ["#0A0B00", "#FFAA01", "#FFFDFB", "#333333"],
    fonts: { heading: "Archivo", body: "Inter Tight" },
    toneTags: ["Friendly", "Premium", "Playful", "Gift"],
    tone: "Afrimode's voice is warm, welcoming, and deeply rooted in cultural heritage. It fosters a vibrant and friendly connection with modern creators and brands, beautifully balancing traditional authenticity with contemporary digital style.",
    audience:
      "Modern digital creators, ethnic fashion brands, cultural entrepreneurs, and e-commerce businesses looking to integrate African and ethnic patterns with bold, modern aesthetics into their brand identity.",
    images: Object.keys(brandImages)
      .sort()
      .map((k) => brandImages[k]),
    isComplete: true,
  };
}

function creation(
  id: string,
  kind: CreationKind,
  imageUrl: string,
  width: number,
  height: number,
  title: string,
): CommunityCreation {
  return { id, kind, imageUrl, aspect: width / height, title };
}

/**
 * Community feed in row order. Dealt round-robin into 5 columns it reproduces the Figma
 * masonry exactly; card sizes are the design's (width x height).
 */
export const communityCreations: CommunityCreation[] = [
  creation("c01", "photoshoot", vanilla, 183, 231, "Vanilla cream bottle"),
  creation("c02", "product-short", mocha, 183, 298, "Chocolate mocha tub"),
  creation("c03", "ad", truffle, 181, 298, "Truffle sauce bottle"),
  creation("c04", "photoshoot", cleanser, 183, 183, "Botanical cleanser"),
  creation("c05", "ugc", sodaSip, 183, 310, "Berry soda first sip"),
  creation("c06", "ugc", sodaHand, 183, 298, "Berry soda in hand"),
  creation("c07", "ad", cleanser, 183, 231, "Botanical cleanser, podium"),
  creation("c08", "concept", serum, 181, 231, "Green serum spotlight"),
  creation("c09", "product-short", sodaCan, 183, 346, "Berry soda can"),
  creation("c10", "concept", sodaCherry, 183, 219, "Berry soda with cherry"),
  creation("c11", "photoshoot", vanilla, 183, 231, "Vanilla cream still life"),
  creation("c12", "ad", mocha, 183, 298, "Mocha tub, warm light"),
  creation("c13", "photoshoot", truffle, 181, 298, "Truffle sauce, berries"),
  creation("c14", "ad", cleanser, 183, 183, "Cleanser, square crop"),
  creation("c15", "ugc", sodaSip, 183, 310, "Berry soda selfie"),
  creation("c16", "ugc", sodaHand, 183, 298, "Berry soda grip"),
  creation("c17", "photoshoot", cleanser, 183, 231, "Cleanser on plinth"),
  creation("c18", "concept", serum, 181, 231, "Serum in the dark"),
  creation("c19", "product-short", sodaCan, 183, 346, "Soda can, sunset"),
  creation("c20", "concept", sodaCherry, 183, 219, "Cherry on top"),
];

const photoTemplateImages = import.meta.glob<string>("@/assets/v2/templates/photo-*.png", {
  eager: true,
  import: "default",
});

const PHOTO_TEMPLATE_META: [string, PhotoTemplateCategory[], boolean][] = [
  ["Sunlit Denim", ["with-model", "lifestyle"], false],
  ["Cocoa Gloss", ["without-model", "studio"], false],
  ["Blush Studio", ["with-model", "studio"], false],
  ["Poolside Shade", ["with-model", "lifestyle"], true],
  ["Sky Blue Serum", ["with-model", "studio"], false],
  ["Golden Hour Glow", ["with-model", "lifestyle"], false],
  ["Rose Light", ["with-model", "studio"], false],
  ["Street Edge", ["with-model", "lifestyle"], true],
  ["Clean White", ["with-model", "studio"], false],
  ["Salon Shine", ["with-model", "lifestyle"], false],
  ["Monochrome Muse", ["with-model", "flat-lay"], false],
  ["Statement Bag", ["with-model", "flat-lay"], true],
];

export const photoTemplates: PhotoTemplate[] = PHOTO_TEMPLATE_META.map(
  ([name, categories, isPro], i) => {
    const n = String(i + 1).padStart(2, "0");
    const key = Object.keys(photoTemplateImages).find((k) => k.endsWith(`photo-${n}.png`));
    return {
      id: `pt_${n}`,
      name,
      imageUrl: key ? photoTemplateImages[key] : "",
      categories,
      isPro,
    };
  },
);

/** Credits charged per generated photo; the backend will own this value. */
export const PHOTO_CREDITS_PER_IMAGE = 2;

/* Figma labels every product "Chocolate Truffle"; each fixture gets its own name. */
export const products: Product[] = [
  {
    id: "p_truffle",
    name: "Chocolate Truffle Sauce",
    imageUrl: truffle,
    source: "shopify",
    createdAt: "2026-10-01T10:00:00Z",
  },
  {
    id: "p_vanilla",
    name: "Vanilla Coffee Creamer",
    imageUrl: vanilla,
    source: "shopify",
    createdAt: "2026-10-02T10:00:00Z",
  },
  {
    id: "p_cookie",
    name: "Cookie Dough Spread",
    imageUrl: cookieDough,
    source: "upload",
    createdAt: "2026-10-20T10:00:00Z",
  },
  {
    id: "p_mocha",
    name: "Chocolate Mocha Mix",
    imageUrl: mocha,
    source: "upload",
    createdAt: "2026-10-25T10:00:00Z",
  },
];

const pieceImages = import.meta.glob<string>("@/assets/v2/pieces/*.png", {
  eager: true,
  import: "default",
});

function piece(
  kind: PieceKind,
  file: string,
  name: string,
  isPro = false,
  background?: string,
): PieceOption {
  const key = Object.keys(pieceImages).find((k) => k.endsWith(`/${file}.png`));
  return {
    id: `${kind}_${file}`,
    kind,
    name,
    imageUrl: key ? pieceImages[key] : "",
    isPro,
    background,
  };
}

/* Grid order and Pro flags follow the Figma piece-by-piece screens. */
export const pieceOptions: PieceOption[] = [
  piece("scene", "scene-01", "Sky Plinth"),
  piece("scene", "scene-02", "Violet Grip"),
  piece("scene", "scene-03", "Torn Paper Peach"),
  piece("scene", "scene-04", "Lemon Burst", true),
  piece("scene", "scene-05", "Lilac Balloons", true),
  piece("scene", "scene-06", "Periwinkle Arch"),
  piece("scene", "scene-07", "Ribbon Mint"),
  piece("scene", "scene-08", "Satin Ribbons", true),
  piece("prop", "prop-01", "Tropical Leaves", false, "#5dc966"),
  piece("prop", "prop-02", "Stone Plinth"),
  piece("prop", "prop-03", "Dried Florals"),
  piece("prop", "prop-04", "Glass Orbs", true),
  piece("prop", "prop-05", "Linen Drape"),
  piece("prop", "prop-06", "Citrus Slices"),
  piece("prop", "prop-07", "Water Ripple"),
  piece("character", "character-01", "Maya"),
  piece("character", "character-02", "Jonah"),
  piece("character", "character-03", "Aisha"),
  piece("character", "character-04", "Leo", true),
  piece("character", "character-05", "Sofia"),
  piece("character", "character-06", "Kenji"),
  piece("character", "character-07", "Noor", true),
];

/* Figma's "pain points" listed packaging traits; these are customer problems instead. */
export const sampleInsights: ProductInsights = {
  painPoints: [
    "Store-bought sauces taste artificial or overly sweet",
    "Hard to make café-style drinks and desserts at home",
    "Most chocolate sauces skip real fruit flavour",
    "Premium toppings feel too expensive for everyday use",
  ],
  adAngles: ["Indulgence", "Café at home", "Real ingredients", "Gift"],
};

/* Figma pairs images with the wrong themes; each theme now gets a matching visual. */
export const adThemes: AdTheme[] = [
  {
    id: "problem-fix",
    name: "Problem → Fix",
    description: "Name the pain, then show the product solving it",
    imageUrl: themeBeforeAfter,
  },
  {
    id: "before-after",
    name: "Before / After",
    description: "Side-by-side proof of the difference it makes",
    imageUrl: themeBeforeAfter,
  },
  {
    id: "testimonial",
    name: "Testimonials",
    description: "Real-feeling customer quotes around the product",
    imageUrl: themeBeforeAfter,
  },
  {
    id: "bold-offer",
    name: "Bold offer",
    description: "Big type, one clear deal, impossible to scroll past",
    imageUrl: themeBoldOffer,
  },
  {
    id: "lifestyle",
    name: "Lifestyle",
    description: "The product in a real moment of everyday use",
    imageUrl: themeBoldOffer,
  },
];

/** Credits charged per static ad; the backend will own this value. */
export const AD_CREDITS_PER_IMAGE = 2;

const recentVideoImages = import.meta.glob<string>("@/assets/v2/video/recent-*.png", {
  eager: true,
  import: "default",
});

const RECENT_VIDEO_TITLES = [
  "Skincare set reveal",
  "Travel pouch unboxing",
  "Sunny bath duck short",
  "Greens powder sky pan",
  "Kiwi juice float",
  "Citrus soda splash",
  "Blackberry serum orbit",
  "Night serum glow",
  "Sneaker turntable",
  "Runner color burst",
];

export const recentGenerations: Generation[] = RECENT_VIDEO_TITLES.map((title, i) => {
  const n = String(i + 1).padStart(2, "0");
  const key = Object.keys(recentVideoImages).find((k) => k.endsWith(`recent-${n}.png`));
  return {
    id: `gen_video_${n}`,
    kind: "video",
    title,
    thumbnailUrl: key ? recentVideoImages[key] : "",
    createdAt: new Date(Date.UTC(2026, 9, 30 - i)).toISOString(),
  };
});

export const ugcTemplates: UgcTemplate[] = [
  {
    id: "ugc_app_walkthrough",
    name: "App Walkthrough",
    style: "tutorial",
    posterUrl: ugc1,
    isPro: false,
  },
  { id: "ugc_food_review", name: "Honest Review", style: "review", posterUrl: ugc2, isPro: true },
  {
    id: "ugc_asmr_unboxing",
    name: "ASMR Unboxing",
    style: "unboxing",
    posterUrl: ugc3,
    isPro: false,
  },
  { id: "ugc_case_reveal", name: "Colour Reveal", style: "reveal", posterUrl: ugc4, isPro: true },
];

/** Video pricing placeholder: credits per started 15 seconds. The backend owns this. */
export const VIDEO_CREDITS_PER_15S = 10;

const shortImages = import.meta.glob<string>("@/assets/v2/shorts/template-*.png", {
  eager: true,
  import: "default",
});

const SHORT_META: [string, ShortStyle[], boolean, string][] = [
  ["Desert Drift", ["lifestyle", "dramatic"], false, "01"],
  ["Garden Glow", ["studio", "dramatic"], true, "02"],
  ["Creator Close-up", ["lifestyle"], false, "03"],
  ["Case Float", ["floating", "spin"], true, "04"],
  ["Couch Levitation", ["floating", "lifestyle"], false, "05"],
  ["Hand Reveal", ["lifestyle"], true, "06"],
  ["Clean Unpack", ["studio"], false, "07"],
  ["Case Spin", ["spin", "studio"], true, "04"],
];

export const shortTemplates: ShortTemplate[] = SHORT_META.map(([name, styles, isPro, n], i) => {
  const key = Object.keys(shortImages).find((k) => k.endsWith(`template-${n}.png`));
  return { id: `short_${i + 1}`, name, styles, isPro, posterUrl: key ? shortImages[key] : "" };
});

/** Support inbox, same address as the v1 help page. */
export const SUPPORT_EMAIL = "benjamin@replixai.co.uk";

/*
 * Help answers rewritten for 2.0 (the v1 list in src/lib/faqs.ts talks about the old
 * gallery and collections). Credit numbers mirror the constants above and the Free plan.
 */
export const helpFaqs: HelpFaq[] = [
  {
    id: "start",
    category: "getting-started",
    question: "How do I get started with Replix AI?",
    answer:
      "Sign up free, add a product (connect Shopify or upload a photo), pick a studio and generate. New accounts get 10 free credits, no card required.",
  },
  {
    id: "shopify",
    category: "getting-started",
    question: "Do I need a Shopify store?",
    answer:
      "No. Connecting Shopify imports your catalogue in one click, but you can upload product photos or import a product URL from the Products page instead.",
  },
  {
    id: "brand-kit",
    category: "getting-started",
    question: "What is the Brand Kit for?",
    answer:
      "Paste your website and we pull your logo, colours, fonts and tone of voice. Every studio uses it so photos, ads and videos stay on brand.",
  },
  {
    id: "credits",
    category: "credits-billing",
    question: "How do credits work?",
    answer: `Each generation shows its cost on the Generate button before you commit: ${PHOTO_CREDITS_PER_IMAGE} credits per photo or ad, and ${VIDEO_CREDITS_PER_15S} credits per started 15 seconds of video. If a generation fails, the credits come back automatically.`,
  },
  {
    id: "plans",
    category: "credits-billing",
    question: "How do I upgrade or cancel?",
    answer:
      "Open Upgrade from the top of any page to compare plans. To change your payment method or cancel, go to Settings → Billing and open the billing portal.",
  },
  {
    id: "studios",
    category: "studios",
    question: "Which studio should I use?",
    answer:
      "Photo Studio for product shots, Ad Studio for ready-to-post static ads with copy, and Video Studio for UGC ads, Product Shorts and concept ads.",
  },
  {
    id: "sizes",
    category: "studios",
    question: "Which sizes can I export?",
    answer:
      "Pick the size before you generate: 1:1 Square, 4:5 Portrait, 9:16 Story or 16:9 Landscape. Downloads keep the size you chose.",
  },
  {
    id: "saved",
    category: "studios",
    question: "Where do my generations go?",
    answer:
      "Everything you generate is saved to Assets, where you can filter, download or reuse it. Characters and scenes you upload live in the Library.",
  },
];
