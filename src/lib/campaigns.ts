// Campaign (collection) helpers shared by the campaigns pages and dialogs.
// Campaigns are stored in the existing `collections` table; the many-to-many
// link between ads and campaigns lives in `ad_collections`.

export type CampaignColor = "gray" | "yellow" | "pink" | "teal";

export const CAMPAIGN_COLORS: { id: CampaignColor; label: string; swatch: string }[] = [
  { id: "gray", label: "Slate", swatch: "#C9CEDA" },
  { id: "yellow", label: "Gold", swatch: "#E8A93B" },
  { id: "pink", label: "Blush", swatch: "#EFAFC0" },
  { id: "teal", label: "Teal", swatch: "#7FC8C0" },
];

// Older records used a different palette; map them onto the new folder colours.
const LEGACY: Record<string, CampaignColor> = {
  brand: "teal",
  blue: "teal",
  emerald: "teal",
  amber: "yellow",
  gold: "yellow",
  fuchsia: "pink",
  rose: "pink",
};

export function toCampaignColor(color: string | null | undefined): CampaignColor {
  if (!color) return "gray";
  if (CAMPAIGN_COLORS.some((c) => c.id === color)) return color as CampaignColor;
  return LEGACY[color] ?? "gray";
}

export const folderTints: Record<CampaignColor, { body: string; tab: string; ring: string }> = {
  gray: { body: "#E4E8F0", tab: "#CBD2E0", ring: "#B4BDCF" },
  yellow: { body: "#FBE4B8", tab: "#F3C878", ring: "#E8A93B" },
  pink: { body: "#FADDE5", tab: "#F2B9C9", ring: "#E389A2" },
  teal: { body: "#D6EFEC", tab: "#A8DCD6", ring: "#7FC8C0" },
};

export type Campaign = {
  id: string;
  name: string;
  description: string | null;
  color: string;
  created_at: string;
};
