// Reusable, declarative ad-template architecture.
//
// Each template is a pure data description of a layout: background, product
// area, text areas, CTA, badge, typography, colour and spacing. <AdPreview />
// renders any template dynamically, so the same product + AI copy can be
// re-rendered across every template without regenerating anything.

import type { CSSProperties } from "react";

export type AdTemplateId = "bold" | "minimal" | "luxury" | "fun";
export type AdTemplateCategory =
  | "Bold & Vibrant"
  | "Modern Minimalist"
  | "Luxury"
  | "Playful & Fun";

export type AdTemplate = {
  id: AdTemplateId;
  name: string;
  category: AdTemplateCategory;
  description: string;
  /** Best-fit verticals — used for the template picker copy. */
  suitedFor: string;

  /** Outer canvas background. */
  background: CSSProperties;
  /** Decorative layers behind the product card. */
  backLayers?: CSSProperties[];
  /** Decorative layers above the card (corner ornaments etc.). */
  frontLayers?: CSSProperties[];

  /** Padding around the inner product card, as a % of canvas width. */
  cardInset: number;
  /** Inner card surface (the pale panel the product sits on). */
  card: CSSProperties;
  /** Card corner radius, % of canvas width. */
  cardRadius: number;
  /** Inner padding of the card, % of canvas width. */
  cardPadding: number;

  typography: {
    headlineFamily: string;
    headlineWeight: number;
    headlineColor: string;
    headlineTracking: string;
    headlineTransform?: CSSProperties["textTransform"];
    headlineItalic?: boolean;
    /** Base headline size as % of canvas width (auto-shrinks for long copy). */
    headlineSize: number;
    bodyFamily: string;
    bodyColor: string;
    align: "left" | "center";
  };

  colors: {
    /** Accent used for CTA / badge; may be overridden by brand colour. */
    accent: string;
    accentText: string;
    badgeBg: string;
    badgeText: string;
  };

  cta: {
    style: CSSProperties;
    /** Pill vs. underlined-editorial link. */
    shape: "pill" | "rule";
  };

  /** Product image behaviour. */
  product: {
    /** Share of the card height reserved for the product (0-1). */
    heightRatio: number;
    /** Extra drop shadow beneath the product. */
    shadow?: string;
  };
};

const DISPLAY = "'Boldonse', 'Archivo Black', system-ui, sans-serif";
const SANS = "'Inter', system-ui, sans-serif";
const SERIF = "'Cormorant Garamond', Georgia, serif";

const CARD_SURFACE = "#e3f0fd";
const INK = "#2b2560";

const LUXURY_CORNER =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 120' fill='none' stroke='%23c9932f' stroke-width='1.6' stroke-linecap='round'><path d='M8 8 L8 64'/><path d='M8 8 L64 8'/><path d='M8 24 Q30 24 30 46 Q30 62 48 62'/><path d='M24 8 Q24 30 46 30 Q62 30 62 48'/><circle cx='8' cy='8' r='2.6' fill='%23c9932f'/><circle cx='34' cy='34' r='1.8' fill='%23c9932f'/><path d='M13 13 Q25 18 30 30'/><path d='M42 11 Q49 20 46 31'/><path d='M11 42 Q20 49 31 46'/></svg>\")";

export const AD_TEMPLATES: Record<AdTemplateId, AdTemplate> = {
  // ------------------------------- BOLD & VIBRANT -------------------------
  bold: {
    id: "bold",
    name: "Bold & Vibrant",
    category: "Bold & Vibrant",
    description: "High-energy iridescent gradient, huge type, strong contrast",
    suitedFor: "Fashion, beauty, food, lifestyle",
    background: {
      background:
        "linear-gradient(115deg,#ff2d6f 0%,#c026d3 18%,#6d28d9 38%,#2563eb 58%,#0ea5e9 76%,#ec4899 100%)",
    },
    backLayers: [
      {
        backgroundImage:
          "repeating-linear-gradient(118deg, rgba(255,255,255,0.22) 0 1px, transparent 1px 7px)",
        mixBlendMode: "screen",
        opacity: 0.75,
      },
      {
        background:
          "radial-gradient(55% 40% at 12% 88%, rgba(255,255,255,0.28), transparent 70%)",
      },
      {
        background:
          "linear-gradient(118deg, transparent 52%, rgba(255,255,255,0.3) 60%, transparent 70%)",
      },
    ],
    cardInset: 9,
    card: {
      background: CARD_SURFACE,
      boxShadow: "0 0.4em 0.9em -0.3em rgba(15,23,42,0.35)",
    },
    cardRadius: 4.5,
    cardPadding: 6,
    typography: {
      headlineFamily: DISPLAY,
      headlineWeight: 900,
      headlineColor: INK,
      headlineTracking: "-0.02em",
      headlineSize: 8.4,
      bodyFamily: SANS,
      bodyColor: "#3f3a6b",
      align: "center",
    },
    colors: {
      accent: "#2b2560",
      accentText: "#ffffff",
      badgeBg: "#ff2d6f",
      badgeText: "#ffffff",
    },
    cta: {
      shape: "pill",
      style: { boxShadow: "0 0.2em 0.5em -0.1em rgba(43,37,96,0.5)", letterSpacing: "0.08em" },
    },
    product: { heightRatio: 0.6, shadow: "drop-shadow(0 0.3em 0.5em rgba(15,23,42,0.28))" },
  },

  // ------------------------------ MODERN MINIMALIST -----------------------
  minimal: {
    id: "minimal",
    name: "Modern Minimalist",
    category: "Modern Minimalist",
    description: "Concentric rings, generous whitespace, elegant restraint",
    suitedFor: "Skincare, beauty, tech, homeware",
    background: { background: "#ffffff" },
    backLayers: [
      {
        background:
          "radial-gradient(circle at 50% 50%, transparent 0 30%, #d3d7dd 30% 39%, transparent 39% 55%, #d3d7dd 55% 64%, transparent 64% 80%, #d3d7dd 80% 90%, transparent 90%)",
        opacity: 0.95,
      },
    ],
    cardInset: 9,
    card: {
      background: CARD_SURFACE,
      boxShadow: "0 0.3em 0.8em -0.3em rgba(15,23,42,0.22)",
    },
    cardRadius: 4,
    cardPadding: 6.5,
    typography: {
      headlineFamily: DISPLAY,
      headlineWeight: 800,
      headlineColor: INK,
      headlineTracking: "-0.025em",
      headlineSize: 8,
      bodyFamily: SANS,
      bodyColor: "#4b5563",
      align: "center",
    },
    colors: {
      accent: "#0f172a",
      accentText: "#f8fafc",
      badgeBg: "#0f172a",
      badgeText: "#f8fafc",
    },
    cta: {
      shape: "pill",
      style: { letterSpacing: "0.22em", textTransform: "uppercase" },
    },
    product: { heightRatio: 0.6, shadow: "drop-shadow(0 0.3em 0.5em rgba(15,23,42,0.2))" },
  },

  // ----------------------------------- LUXURY -----------------------------
  luxury: {
    id: "luxury",
    name: "Luxury",
    category: "Luxury",
    description: "Obsidian and cream with gold filigree corners",
    suitedFor: "Jewellery, fragrance, premium lifestyle",
    background: {
      background:
        "radial-gradient(78% 58% at 50% 50%, #35230d 0%, #150d05 55%, #030201 100%)",
    },
    backLayers: [{ boxShadow: "inset 0 0 22em 6em rgba(0,0,0,0.8)" }],
    frontLayers: [
      {
        top: "2%",
        left: "2%",
        width: "13%",
        aspectRatio: "1",
        backgroundImage: LUXURY_CORNER,
        backgroundSize: "contain",
        backgroundRepeat: "no-repeat",
      },
      {
        top: "2%",
        right: "2%",
        width: "13%",
        aspectRatio: "1",
        backgroundImage: LUXURY_CORNER,
        backgroundSize: "contain",
        backgroundRepeat: "no-repeat",
        transform: "scaleX(-1)",
      },
      {
        bottom: "2%",
        left: "2%",
        width: "13%",
        aspectRatio: "1",
        backgroundImage: LUXURY_CORNER,
        backgroundSize: "contain",
        backgroundRepeat: "no-repeat",
        transform: "scaleY(-1)",
      },
      {
        bottom: "2%",
        right: "2%",
        width: "13%",
        aspectRatio: "1",
        backgroundImage: LUXURY_CORNER,
        backgroundSize: "contain",
        backgroundRepeat: "no-repeat",
        transform: "scale(-1,-1)",
      },
    ],
    cardInset: 11,
    card: {
      background: CARD_SURFACE,
      border: "0.9em solid #fdf3dd",
      boxShadow: "0 0.4em 1em -0.3em rgba(0,0,0,0.7)",
    },
    cardRadius: 4,
    cardPadding: 6,
    typography: {
      headlineFamily: SERIF,
      headlineWeight: 600,
      headlineColor: INK,
      headlineTracking: "0.005em",
      headlineSize: 9,
      bodyFamily: SERIF,
      bodyColor: "#4a4470",
      align: "center",
    },
    colors: {
      accent: "linear-gradient(135deg,#f2dc9c 0%,#c9932f 55%,#8c6418 100%)",
      accentText: "#1a1408",
      badgeBg: "#1a1408",
      badgeText: "#f2dc9c",
    },
    cta: {
      shape: "pill",
      style: { letterSpacing: "0.28em", textTransform: "uppercase" },
    },
    product: { heightRatio: 0.58, shadow: "drop-shadow(0 0.3em 0.5em rgba(15,23,42,0.25))" },
  },

  // -------------------------------- PLAYFUL & FUN -------------------------
  fun: {
    id: "fun",
    name: "Playful & Fun",
    category: "Playful & Fun",
    description: "Candy swirl stripes, cream frame, joyful energy",
    suitedFor: "Food, drinks, accessories, kids",
    background: {
      background:
        "repeating-conic-gradient(from 200deg at 20% 30%, #f0abfc 0deg 14deg, #f472b6 14deg 26deg, #c084fc 26deg 40deg, #e879f9 40deg 54deg)",
    },
    backLayers: [
      {
        background:
          "radial-gradient(70% 60% at 50% 45%, rgba(255,255,255,0.25), transparent 70%)",
      },
    ],
    cardInset: 8,
    card: {
      background: CARD_SURFACE,
      border: "1.4em solid #fdf1d6",
      boxShadow: "0 0.4em 0.9em -0.3em rgba(88,28,135,0.4)",
    },
    cardRadius: 5,
    cardPadding: 6,
    typography: {
      headlineFamily: DISPLAY,
      headlineWeight: 900,
      headlineColor: INK,
      headlineTracking: "-0.015em",
      headlineSize: 8.6,
      bodyFamily: SANS,
      bodyColor: "#5b21b6",
      align: "center",
    },
    colors: {
      accent: "#7c3aed",
      accentText: "#ffffff",
      badgeBg: "#fbbf24",
      badgeText: "#4c1d95",
    },
    cta: {
      shape: "pill",
      style: { boxShadow: "0 0.2em 0.5em -0.1em rgba(124,58,237,0.5)", letterSpacing: "0.1em" },
    },
    product: { heightRatio: 0.58, shadow: "drop-shadow(0 0.3em 0.5em rgba(88,28,135,0.3))" },
  },
};

export const AD_TEMPLATE_LIST: AdTemplate[] = [
  AD_TEMPLATES.bold,
  AD_TEMPLATES.minimal,
  AD_TEMPLATES.luxury,
  AD_TEMPLATES.fun,
];

/**
 * Auto-fit: pick a headline font size (in % of canvas width) that keeps long
 * AI copy inside the design without ever becoming unreadably small.
 */
export function fitHeadlineSize(text: string, base: number): number {
  const len = text.trim().length;
  const longestWord = text
    .trim()
    .split(/\s+/)
    .reduce((m, w) => Math.max(m, w.length), 0);

  let size = base;
  if (len > 26) size = base * 0.88;
  if (len > 40) size = base * 0.76;
  if (len > 58) size = base * 0.64;
  if (len > 80) size = base * 0.54;
  // Never let a single long word blow past the card edge.
  if (longestWord > 11) size = Math.min(size, base * (11 / longestWord) * 1.15);
  return Math.max(size, base * 0.45);
}

/** Trim over-long headlines at a word boundary rather than clipping mid-word. */
export function clampHeadline(text: string, max = 96): string {
  const t = text.trim().replace(/\s+/g, " ");
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const at = cut.lastIndexOf(" ");
  return `${(at > 40 ? cut.slice(0, at) : cut).replace(/[,;:.\-]$/, "")}…`;
}

/**
 * Blend a brand colour into a template accent without letting it destroy the
 * template's hierarchy: we only accept it for the CTA/badge, and only when it
 * has enough contrast against the pale card surface.
 */
export function resolveAccent(
  template: AdTemplate,
  brandColor?: string | null,
): { accent: string; accentText: string } {
  const fallback = { accent: template.colors.accent, accentText: template.colors.accentText };
  if (!brandColor || !/^#([0-9a-f]{6}|[0-9a-f]{3})$/i.test(brandColor)) return fallback;
  // Luxury keeps its gold — brand colour must never override it.
  if (template.id === "luxury") return fallback;

  const hex = brandColor.length === 4
    ? `#${brandColor[1]}${brandColor[1]}${brandColor[2]}${brandColor[2]}${brandColor[3]}${brandColor[3]}`
    : brandColor;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  // Too light against the pale card → keep the template accent.
  if (luminance > 0.72) return fallback;
  return { accent: hex, accentText: luminance > 0.5 ? "#101828" : "#ffffff" };
}
