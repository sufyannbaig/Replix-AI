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
  GenerationKind,
  HelpFaq,
  PieceKind,
  PieceOption,
  Product,
  ProductInsights,
  ShortStyle,
  ShortTemplate,
  UgcStyle,
  UgcTemplate,
} from "./types";
import themeBeforeAfter from "@/assets/v2/catalog/ad/before-after.webp";
import themeBoldOffer from "@/assets/v2/catalog/ad/bold-offer.webp";
import themeLifestyle from "@/assets/v2/catalog/ad/lifestyle.webp";
import themeProblemFix from "@/assets/v2/catalog/ad/problem-fix.webp";
import themeTestimonial from "@/assets/v2/catalog/ad/testimonial.webp";
import acmeBuds from "@/assets/v2/catalog/product/acme-buds.webp";
import acmeCharge from "@/assets/v2/catalog/product/acme-charge.webp";
import acmeSerum from "@/assets/v2/catalog/product/acme-glow-serum.webp";
import acmeShirt from "@/assets/v2/catalog/product/acme-linen-shirt.webp";
import mercuryLogo from "@/assets/v2/home/mercury-logo.svg";
import brandLogoPrimary from "@/assets/v2/brand/logo-primary.png";
import brandLogoLight from "@/assets/v2/brand/logo-light.png";

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

/*
 * Template catalog from the client's Drive folder ("Replix templates"), compressed to webp
 * and mp4. The full-resolution files, and the blank "base" plates the backend composites
 * products onto, stay in Drive. See docs/V2_HANDOVER.md.
 */
const catalogImages = import.meta.glob<string>("@/assets/v2/catalog/*/*.webp", {
  eager: true,
  import: "default",
});

function catalogImage(folder: string, slug: string): string {
  const key = Object.keys(catalogImages).find((k) => k.endsWith(`/catalog/${folder}/${slug}.webp`));
  return key ? catalogImages[key] : "";
}

/* Names, categories and Pro flags in this catalog follow the Replix Library Playbook. */
const PHOTO_TEMPLATE_META: [string, string, PhotoTemplateCategory[], boolean][] = [
  ["linen-studio", "Linen Studio", ["studio", "without-model"], false],
  ["clean-white", "Clean White", ["studio", "without-model"], false],
  ["morning-kitchen", "Morning Kitchen", ["lifestyle", "without-model"], false],
  ["hand-hero", "Hand Hero", ["with-model"], true],
  ["weekend-flat-lay", "Weekend Flat Lay", ["flat-lay", "without-model"], false],
  ["golden-hour-model", "Golden Hour Model", ["with-model"], true],
];

export const photoTemplates: PhotoTemplate[] = PHOTO_TEMPLATE_META.map(
  ([slug, name, categories, isPro]) => ({
    id: `pt_${slug}`,
    name,
    imageUrl: catalogImage("photo", slug),
    categories,
    isPro,
  }),
);

/** Credits charged per generated photo; the backend will own this value. */
export const PHOTO_CREDITS_PER_IMAGE = 2;

export const products: Product[] = [
  {
    id: "p_charge",
    name: "Acme Charge",
    imageUrl: acmeCharge,
    source: "shopify",
    createdAt: "2026-10-01T10:00:00Z",
  },
  {
    id: "p_serum",
    name: "Acme Glow Serum",
    imageUrl: acmeSerum,
    source: "shopify",
    createdAt: "2026-10-02T10:00:00Z",
  },
  {
    id: "p_buds",
    name: "Acme Buds",
    imageUrl: acmeBuds,
    source: "upload",
    createdAt: "2026-10-20T10:00:00Z",
  },
  {
    id: "p_shirt",
    name: "Acme Linen Shirt",
    imageUrl: acmeShirt,
    source: "upload",
    createdAt: "2026-10-25T10:00:00Z",
  },
];

function pieces(kind: PieceKind, entries: [string, string, boolean?][]): PieceOption[] {
  return entries.map(([slug, name, isPro = false]) => ({
    id: `${kind}_${slug}`,
    kind,
    name,
    imageUrl: catalogImage(kind, slug),
    isPro,
    /* Prop cut-outs have no background of their own. */
    background: kind === "prop" ? "#f2f2f2" : undefined,
  }));
}

export const pieceOptions: PieceOption[] = [
  ...pieces("scene", [
    ["white-seamless", "White seamless"],
    ["sand-linen-studio", "Sand linen studio"],
    ["pastel-blue-sweep", "Pastel blue sweep"],
    ["black-gloss-with-rim-light", "Black gloss with rim light", true],
    ["marble-kitchen", "Marble kitchen"],
    ["bathroom-vanity", "Bathroom vanity"],
    ["cozy-bedroom", "Cozy bedroom"],
    ["cafe-window-table", "Cafe window table", true],
    ["living-room-sofa", "Living room sofa"],
    ["home-office-desk", "Home office desk"],
    ["gym-corner", "Gym corner"],
    ["sunny-balcony", "Sunny balcony"],
    ["beach-at-golden-hour", "Beach at golden hour", true],
    ["linen-tabletop", "Linen tabletop"],
    ["terrazzo-top", "Terrazzo top", true],
  ]),
  ...pieces("prop", [
    ["city-bike", "City bike"],
    ["monstera-plant", "Monstera plant"],
    ["cactus", "Small cactus"],
    ["fresh-flowers-in-a-vase", "Fresh flowers in a vase"],
    ["coffee-mug", "Coffee mug"],
    ["croissant-on-a-plate", "Croissant on a plate"],
    ["stack-of-books", "Stack of books"],
    ["sunglasses", "Sunglasses"],
    ["silk-scarf", "Silk scarf", true],
    ["lemons", "Lemons"],
    ["ice-cubes", "Ice cubes"],
    ["water-splash", "Water splash"],
    ["rolled-towel", "Rolled towel"],
    ["candle", "Candle", true],
    ["wooden-tray", "Wooden tray"],
    ["marble-plinth", "Marble plinth", true],
    ["headphones", "Headphones"],
    ["laptop", "Laptop"],
    ["plain-shopping-bag", "Plain shopping bag"],
    ["gift-box-with-ribbon", "Gift box with ribbon", true],
    /* In the Drive folder but not the playbook; names are ours. */
    ["classic-car", "Classic car"],
    ["motorcycle", "Motorcycle"],
    ["street-lamp", "Street lamp"],
  ]),
  ...pieces("character", [
    ["sara", "Sara M."],
    ["robert", "Robert M."],
    ["zain", "Zain"],
    ["alliea", "Alliea"],
    ["daniel", "Daniel O."],
    ["joseph", "Joseph"],
    ["hira", "Hira M."],
    ["lena", "Lena C.", true],
    ["mei", "Mei L.", true],
    ["ayesha", "Ayesha K."],
    ["carlos", "Carlos R.", true],
    ["omar", "Omar A."],
  ]),
  ...pieces("style", [
    ["hand-holding-product-close-up", "Hand holding product close up"],
    ["two-hands-presenting", "Two hands presenting"],
    ["sitting-with-product-on-lap", "Sitting with product on lap"],
    ["walking-with-product", "Walking with product"],
    ["mirror-selfie", "Mirror selfie"],
    ["over-the-shoulder-look", "Over the shoulder look"],
    ["product-at-face-level", "Product at face level"],
    ["hand-reaching-into-a-flat-lay", "Hand reaching into a flat lay"],
    /* In the Drive folder but not the playbook; names are ours. */
    ["linen-121751", "Chin rest"],
    ["linen-122011", "Back glance"],
    ["linen-122220", "Phone selfie"],
    ["linen-123504", "Seated on chair"],
    ["linen-123724", "Reach to camera"],
    ["linen-123936", "Side turn"],
    ["linen-124220", "Cuff adjust"],
    ["linen-134905", "Seated on block"],
    ["linen-135807", "Laptop on stool"],
  ]),
];

/* Figma's "pain points" listed packaging traits; these are customer problems instead. */
export const sampleInsights: ProductInsights = {
  painPoints: [
    "Hard to tell apart from similar products when scrolling",
    "Customers want proof it works before they buy",
    "Stock product photos don't show it in real life",
    "Premium price needs a clear reason to pay it",
  ],
  adAngles: ["Everyday upgrade", "Real results", "Quality you can see", "Gift"],
};

export const adThemes: AdTheme[] = [
  {
    id: "problem-fix",
    name: "Problem → Fix",
    description: "Name the pain, then show the product solving it",
    imageUrl: themeProblemFix,
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
    imageUrl: themeTestimonial,
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
    imageUrl: themeLifestyle,
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

/* Videos live in public/ so they stream on demand instead of going through the bundler. */
const UGC_META: [string, string, UgcStyle, boolean][] = [
  ["honest-review", "Honest review", "review", false],
  ["morning-routine", "Morning routine", "tutorial", false],
  ["first-unboxing", "First unboxing", "unboxing", false],
  ["the-reveal", "The reveal", "reveal", true],
  ["try-on-check", "Try-on check", "try-on", true],
  ["gym-quick-take", "Gym quick take", "review", false],
];

export const ugcTemplates: UgcTemplate[] = UGC_META.map(([slug, name, style, isPro]) => ({
  id: `ugc_${slug}`,
  name,
  style,
  isPro,
  posterUrl: catalogImage("ugc", slug),
  videoUrl: `/v2/videos/ugc/${slug}.mp4`,
}));

/** Video pricing placeholder: credits per started 15 seconds. The backend owns this. */
export const VIDEO_CREDITS_PER_15S = 10;

const SHORT_META: [string, string, ShortStyle[], boolean][] = [
  ["studio-turn", "Studio Turn", ["studio"], false],
  ["floating", "Floating", ["floating"], false],
  ["360-spin", "360 Spin", ["spin"], false],
  ["dramatic-light", "Dramatic Light", ["dramatic"], true],
  ["morning-light", "Morning Light", ["lifestyle"], false],
  ["splash", "Splash", ["dramatic"], true],
];

export const shortTemplates: ShortTemplate[] = SHORT_META.map(([slug, name, styles, isPro]) => ({
  id: `short_${slug}`,
  name,
  styles,
  isPro,
  posterUrl: catalogImage("short", slug),
  videoUrl: `/v2/videos/shorts/${slug}.mp4`,
}));

type FeedKind = Exclude<CreationKind, "concept">;

function feedCard(kind: FeedKind, slug: string): CommunityCreation {
  const id = `c_${kind}_${slug}`;
  if (kind === "ugc" || kind === "product-short") {
    const t =
      kind === "ugc"
        ? ugcTemplates.find((x) => x.id === `ugc_${slug}`)
        : shortTemplates.find((x) => x.id === `short_${slug}`);
    return {
      id,
      kind,
      imageUrl: t?.posterUrl ?? "",
      videoUrl: t?.videoUrl,
      aspect: 9 / 16,
      title: t?.name ?? slug,
    };
  }
  if (kind === "ad") {
    const t = adThemes.find((x) => x.id === slug);
    return { id, kind, imageUrl: t?.imageUrl ?? "", aspect: 1, title: t?.name ?? slug };
  }
  const t = photoTemplates.find((x) => x.id === `pt_${slug}`);
  return { id, kind, imageUrl: t?.imageUrl ?? "", aspect: 4 / 3, title: t?.name ?? slug };
}

/* The 12 Home feed picks, three per format. Cards deal left to right into columns, so this
   order keeps the columns even and the same product from stacking. */
export const communityCreations: CommunityCreation[] = (
  [
    ["ugc", "honest-review"],
    ["photoshoot", "golden-hour-model"],
    ["ad", "before-after"],
    ["product-short", "dramatic-light"],
    ["product-short", "morning-light"],
    ["photoshoot", "linen-studio"],
    ["ugc", "gym-quick-take"],
    ["product-short", "splash"],
    ["ugc", "the-reveal"],
    ["ad", "bold-offer"],
    ["photoshoot", "weekend-flat-lay"],
    ["ad", "testimonial"],
  ] as [FeedKind, string][]
).map(([kind, slug]) => feedCard(kind, slug));

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
      "Each result opens on its own page where you can download it, regenerate, or save it to Assets to find and reuse later. Characters and scenes you upload live in the Library.",
  },
];

/** Seconds a fake generation takes, so the loading state can be designed and tested. */
export const MOCK_GENERATION_SECONDS: Record<GenerationKind, number> = {
  photo: 5,
  ad: 5,
  video: 9,
};

/** Images the fake generator returns: the studio's own template art. */
export function mockGenerationImages(kind: GenerationKind): string[] {
  if (kind === "photo") return photoTemplates.map((t) => t.imageUrl).filter(Boolean);
  if (kind === "ad") return [...new Set(adThemes.map((t) => t.imageUrl))];
  return [
    ...ugcTemplates.map((t) => t.posterUrl),
    ...shortTemplates.map((t) => t.posterUrl),
    ...recentGenerations.map((g) => g.thumbnailUrl),
  ].filter(Boolean);
}
