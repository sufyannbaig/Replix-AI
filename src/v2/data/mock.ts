/**
 * Front-end fixtures for Replix 2.0. Every value here is placeholder data that the
 * backend will replace through ./api.ts; nothing outside the data folder imports it.
 */
import type { BrandKit, CommunityCreation, CreationKind } from "./types";
import mercuryLogo from "@/assets/v2/home/mercury-logo.svg";
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
    logoUrl: mercuryLogo,
    colors: ["#0D2348", "#375DAA", "#F5F5F5"],
    fonts: null,
    tone: null,
    isComplete: false,
  },
];

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
