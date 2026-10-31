// Advertising objectives for the ad generator.
// Add new objectives here — the UI and the AI prompt both read from this list.

export const AD_OBJECTIVES = [
  {
    id: "launch",
    badge: "JUST LAUNCHED",
    label: "Product Launch",
    desc: "Introduce something new with excitement",
    icon: "Rocket",
    brief:
      "announce a brand-new product launch — build anticipation and make it feel like an event",
  },
  {
    id: "sale",
    badge: "LIMITED OFFER",
    label: "Sale / Discount",
    desc: "Drive urgency with a limited offer",
    icon: "Tag",
    brief: "promote a limited-time sale or discount — urgency, scarcity, clear savings",
  },
  {
    id: "collection",
    badge: "NEW COLLECTION",
    label: "New Collection",
    desc: "Showcase a fresh drop or range",
    icon: "LayoutGrid",
    brief: "showcase a new collection or drop — curation, range, seasonal freshness",
  },
  {
    id: "awareness",
    badge: "THE STORY",
    label: "Brand Awareness",
    desc: "Tell the story behind the brand",
    icon: "Megaphone",
    brief: "build brand awareness — story, values, memorable identity over hard selling",
  },
  {
    id: "retargeting",
    badge: "STILL YOURS",
    label: "Retargeting",
    desc: "Win back shoppers who didn't buy",
    icon: "Repeat",
    brief:
      "retarget shoppers who viewed but didn't buy — remove objections, gentle nudge, reassurance",
  },
] as const;

export type AdObjectiveId = (typeof AD_OBJECTIVES)[number]["id"];

export const AD_OBJECTIVE_IDS = AD_OBJECTIVES.map((o) => o.id) as unknown as [
  AdObjectiveId,
  ...AdObjectiveId[],
];

export const objectiveBadges = Object.fromEntries(
  AD_OBJECTIVES.map((o) => [o.id, o.badge]),
) as Record<AdObjectiveId, string>;

export const objectiveBriefs = Object.fromEntries(
  AD_OBJECTIVES.map((o) => [o.id, o.brief]),
) as Record<AdObjectiveId, string>;
