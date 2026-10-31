/** Shared vocabulary for the Generate Ads studio flow. */

export type Platform = "instagram" | "facebook";
export type AdFormat = "1:1" | "4:5" | "9:16";

export type ThemeId =
  | "showcase"
  | "bold-claim"
  | "feature-benefit"
  | "headline"
  | "offer-sale"
  | "problem-solution"
  | "before-after"
  | "stats"
  | "testimonial"
  | "us-vs-them";

export type AdOverlay = {
  hero: string;
  support?: string;
  attribution?: string;
  badge?: string;
};

export type Theme = { id: ThemeId; label: string; logic: string };

export const themes: Theme[] = [
  { id: "showcase", label: "Product Showcase", logic: "Hero shot with one clear benefit" },
  { id: "bold-claim", label: "Bold Claim", logic: "One confident statement, nothing else" },
  { id: "feature-benefit", label: "Feature → Benefit", logic: "What it does, why it matters" },
  { id: "headline", label: "Big Headline", logic: "Typography-led scroll stopper" },
  { id: "offer-sale", label: "Offer / Sale", logic: "Deal-led urgency creative" },
  { id: "problem-solution", label: "Problem → Solution", logic: "Name the pain, then solve it" },
  { id: "before-after", label: "Before / After", logic: "Show the transformation" },
  { id: "stats", label: "Stat Led", logic: "One number that proves the point" },
  { id: "testimonial", label: "Testimonial", logic: "A short customer quote" },
  { id: "us-vs-them", label: "Us vs Them", logic: "Why you beat the alternative" },
];

export const formats: { id: AdFormat; label: string }[] = [
  { id: "1:1", label: "Square 1:1" },
  { id: "4:5", label: "Portrait 4:5" },
  { id: "9:16", label: "Story 9:16" },
];

export const understandingSteps = [
  "Looking at your product photo",
  "Reading packaging, colours and materials",
  "Working out who it is for",
  "Finding the strongest selling angle",
];

export const themeById = (id: string): Theme | undefined => themes.find((t) => t.id === id);
