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
import themeBeforeAfter from "@/assets/v2/catalog/ad-theme/before-after.webp";
import themeBoldClaim from "@/assets/v2/catalog/ad-theme/bold-claim.webp";
import themeFeatureBenefit from "@/assets/v2/catalog/ad-theme/feature-benefit.webp";
import themeHeadline from "@/assets/v2/catalog/ad-theme/headline.webp";
import themeOfferSale from "@/assets/v2/catalog/ad-theme/offer-sale.webp";
import themeProblemSolution from "@/assets/v2/catalog/ad-theme/problem-solution.webp";
import themeShowcase from "@/assets/v2/catalog/ad-theme/showcase.webp";
import themeStats from "@/assets/v2/catalog/ad-theme/stats.webp";
import themeTestimonial from "@/assets/v2/catalog/ad-theme/testimonial.webp";
import themeUsVsThem from "@/assets/v2/catalog/ad-theme/us-vs-them.webp";
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
    isDefault: true,
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

export function catalogImage(folder: string, slug: string): string {
  const key = Object.keys(catalogImages).find((k) => k.endsWith(`/catalog/${folder}/${slug}.webp`));
  return key ? catalogImages[key] : "";
}

/**
 * The `catalog` storage bucket path ("photo/splash-burst.webp") of a bundled catalog image
 * URL, or null. The generation server reads art from that bucket instead of fetching its own
 * site, which Lovable's preview host blocks.
 */
export function catalogPathForUrl(url: string): string | null {
  const key = Object.keys(catalogImages).find((k) => catalogImages[k] === url);
  return key ? key.slice(key.indexOf("/catalog/") + "/catalog/".length) : null;
}

/*
 * Photo templates from the Figma "Experimentation." page (node 299:46), 4:5 portrait,
 * exported at 800x1000. They replaced the first six Drive templates. Free ones cover each
 * filter; the rest are Pro. Same ids, names, categories and Pro flags as the `templates` rows.
 */
const PHOTO_TEMPLATE_META: [string, string, PhotoTemplateCategory[], boolean][] = [
  ["splash-burst", "Splash Burst", ["studio", "without-model"], false],
  ["hold-out", "Hold Out", ["with-model"], false],
  ["terrazzo-pedestal", "Terrazzo Pedestal", ["studio", "without-model"], false],
  ["linen-morning", "Linen Morning", ["lifestyle", "without-model"], false],
  ["soft-studio", "Soft Studio", ["studio", "without-model"], false],
  ["morning-routine", "Morning Routine", ["with-model", "lifestyle"], false],
  ["tone-on-tone", "Tone on Tone", ["studio", "without-model"], false],
  ["ingredient-spread", "Ingredient Spread", ["flat-lay", "without-model"], false],
  ["two-tone-set", "Two-Tone Set", ["flat-lay", "without-model"], false],
  ["desk-setup", "Desk Setup", ["lifestyle", "without-model"], false],
  ["blind-shadows", "Blind Shadows", ["lifestyle", "without-model"], false],
  ["palm-shadow", "Palm Shadow", ["lifestyle", "without-model"], false],
  ["fruit-burst", "Fruit Burst", ["studio", "without-model"], true],
  ["golden-skin", "Golden Skin", ["with-model"], true],
  ["monolith", "Monolith", ["studio", "without-model"], true],
  ["sky-high", "Sky High", ["with-model", "lifestyle"], true],
  ["power-burst", "Power Burst", ["studio", "without-model"], true],
  ["flash-sip", "Flash Sip", ["with-model"], true],
  ["black-water", "Black Water", ["studio", "without-model"], true],
  ["morning-commute", "Morning Commute", ["with-model", "lifestyle"], true],
  ["levitation", "Levitation", ["studio", "without-model"], true],
  ["track-day", "Track Day", ["with-model", "lifestyle"], true],
  ["ice-crush", "Ice Crush", ["studio", "without-model"], true],
  ["tennis-club", "Tennis Club", ["with-model", "lifestyle"], true],
  ["spotlight-noir", "Spotlight Noir", ["studio", "without-model"], true],
  ["studio-stride", "Studio Stride", ["with-model", "studio"], true],
  ["satin-wave", "Satin Wave", ["studio", "without-model"], true],
  ["mirror-floor", "Mirror Floor", ["studio", "without-model"], true],
  ["trail-dawn", "Trail Dawn", ["lifestyle", "without-model"], true],
  /* Figma "new temps" (node 768:141), added 2026-11-17. */
  ["dewy-grass", "Dewy Grass", ["flat-lay", "without-model"], true],
  ["green-wave", "Green Wave", ["studio", "without-model"], true],
  ["sand-noir", "Sand Noir", ["flat-lay", "without-model"], true],
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

/* Prices live in ./pricing.ts (the server uses the same table). */
export { AD_CREDITS_PER_IMAGE, PHOTO_CREDITS_PER_IMAGE, VIDEO_CREDITS_PER_15S } from "./pricing";
import {
  PHOTO_CREDITS_PER_IMAGE,
  SHORTS_CREDITS_BY_SECONDS,
  UGC_CREDITS_BY_SECONDS,
  VIDEO_CREDITS_PER_15S,
} from "./pricing";

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
    /* Figma "new temps" backgrounds (node 768:141), 4:5, added 2026-11-17. */
    ["forest-stone-podium", "Forest stone podium"],
    ["lush-grass", "Lush grass"],
    ["golden-sand", "Golden sand"],
    ["crushed-ice", "Crushed ice"],
    ["pink-stucco", "Pink stucco with palm shadows"],
    ["mossy-branch", "Mossy branch on sage", true],
    ["black-sand-driftwood", "Black sand and driftwood", true],
    ["sunset-rocks", "Sunset rocks", true],
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

/*
 * Ad themes for business buyers (B2B). They exist in code only (no `templates` rows) and
 * reuse the picker art and layouts of the nearest consumer theme until they get their own.
 */
export const b2bAdThemes: AdTheme[] = [
  {
    id: "b2b-problem",
    name: "Problem First",
    description: "Name the buyer's problem in their words",
    imageUrl: themeProblemSolution,
  },
  {
    id: "b2b-proof",
    name: "Proof Number",
    description: "One real figure that makes the case",
    imageUrl: themeStats,
  },
  {
    id: "b2b-quote",
    name: "Customer Quote",
    description: "A real customer's words",
    imageUrl: themeTestimonial,
  },
  {
    id: "b2b-old-way",
    name: "Old Way vs Us",
    description: "How it's done today, and the better way",
    imageUrl: themeUsVsThem,
  },
];

/* v1's ten ad themes (src/data/studio.ts on main), brought back on 2026-11-15. */
export const adThemes: AdTheme[] = [
  {
    id: "showcase",
    name: "Product Showcase",
    description: "Hero shot with one clear benefit",
    imageUrl: themeShowcase,
  },
  {
    id: "bold-claim",
    name: "Bold Claim",
    description: "One confident statement, nothing else",
    imageUrl: themeBoldClaim,
  },
  {
    id: "feature-benefit",
    name: "Feature → Benefit",
    description: "What it does, why it matters",
    imageUrl: themeFeatureBenefit,
  },
  {
    id: "headline",
    name: "Big Headline",
    description: "Typography-led scroll stopper",
    imageUrl: themeHeadline,
  },
  {
    id: "offer-sale",
    name: "Offer / Sale",
    description: "Deal-led urgency creative",
    imageUrl: themeOfferSale,
  },
  {
    id: "problem-solution",
    name: "Problem → Solution",
    description: "Name the pain, then solve it",
    imageUrl: themeProblemSolution,
  },
  {
    id: "before-after",
    name: "Before / After",
    description: "Show the transformation",
    imageUrl: themeBeforeAfter,
  },
  {
    id: "stats",
    name: "Stat Led",
    description: "One number that proves the point",
    imageUrl: themeStats,
  },
  {
    id: "testimonial",
    name: "Testimonial",
    description: "A short customer quote",
    imageUrl: themeTestimonial,
  },
  {
    id: "us-vs-them",
    name: "Us vs Them",
    description: "Why you beat the alternative",
    imageUrl: themeUsVsThem,
  },
];

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

/* Sample history for Recent generations and Assets, built from the real templates. */
export const recentGenerations: Generation[] = ugcTemplates
  .flatMap((t, i) => [t, shortTemplates[i]])
  .slice(0, 10)
  .map((t, i) => ({
    id: `gen_video_${String(i + 1).padStart(2, "0")}`,
    kind: "video",
    title: t.name,
    thumbnailUrl: t.posterUrl,
    createdAt: new Date(Date.UTC(2026, 9, 30 - i)).toISOString(),
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
  return { id, kind, imageUrl: t?.imageUrl ?? "", aspect: 4 / 5, title: t?.name ?? slug };
}

/* Community feed: every finished template, mixed so the formats sit side by side. */
export const communityCreations: CommunityCreation[] = (
  [
    ["ugc", "honest-review"],
    ["photoshoot", "golden-skin"],
    ["product-short", "dramatic-light"],
    ["photoshoot", "splash-burst"],
    ["ugc", "the-reveal"],
    ["product-short", "floating"],
    ["photoshoot", "monolith"],
    ["ugc", "morning-routine"],
    ["product-short", "splash"],
    ["photoshoot", "two-tone-set"],
    ["ugc", "first-unboxing"],
    ["product-short", "morning-light"],
    ["photoshoot", "levitation"],
    ["photoshoot", "linen-morning"],
    ["ugc", "try-on-check"],
    ["ugc", "gym-quick-take"],
    ["product-short", "360-spin"],
    ["product-short", "studio-turn"],
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
      "Paste your website to build your brand kit, add a product photo, pick a studio and generate. New accounts get 10 free credits to try it, no card required.",
  },
  {
    id: "shopify",
    category: "getting-started",
    question: "Do I need an online store?",
    answer:
      "No. Upload product photos or import a product link from the Products page. If you sell on Shopify, you can also connect your store to import your catalogue.",
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
    answer: `Each generation shows its cost on the Generate button before you commit: ${PHOTO_CREDITS_PER_IMAGE} credits per photo or ad, ${SHORTS_CREDITS_BY_SECONDS[5]}, ${SHORTS_CREDITS_BY_SECONDS[8]} or ${SHORTS_CREDITS_BY_SECONDS[10]} credits for a 5, 8 or 10 second Product Short, ${VIDEO_CREDITS_PER_15S} credits per started 15 seconds of Concept video, and ${UGC_CREDITS_BY_SECONDS[8]} credits for an 8 second or ${UGC_CREDITS_BY_SECONDS[15]} for a 15 second AI UGC video. If a generation fails, the credits come back automatically.`,
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
  {
    id: "ai-label",
    category: "studios",
    question: "Do I have to say my ads are made with AI?",
    answer:
      "Often, yes. Facebook and Instagram add an AI label to ads with realistic AI-made people, TikTok and YouTube ask you to tick an AI box when you upload, and EU rules ask for realistic AI images and video to be labelled. To help, every photo and ad you download from Replix carries the standard made-with-AI mark inside the file, which those platforms can read. Videos don't carry it yet, so tick the platform's AI option yourself. If you sell in the EU or UK, check the rules for your market.",
  },
  {
    id: "people",
    category: "studios",
    question: "Can I upload a photo of a real person?",
    answer:
      "Yes, if it's you or someone who has agreed to it. We ask you to confirm that each time you add a character. Don't upload celebrities or other public figures. Testimonial ads only quote a review you paste in yourself; Replix never invents customer quotes.",
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
  ].filter(Boolean);
}
