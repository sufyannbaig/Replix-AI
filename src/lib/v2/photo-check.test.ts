// Run with: node --test src/lib/v2/photo-check.test.ts
// Piece By Piece Phase 1: label lock, per-scene light, per-pose framing, check and retry.
import { describe, test } from "node:test";
import { deepStrictEqual, ok, strictEqual } from "node:assert";
import { checkMessages, fixLine, labelLine, parseCheck, parseLabel } from "./photo-check.ts";
import { PERSON_RULES, poseFraming, sceneDirection } from "./piece-direction.ts";
import { photoPrompt } from "./recipes.ts";

/* The preset names in src/v2/data/mock.ts (pieceOptions); mock.ts can't load under node. */
const SCENES = [
  "White seamless",
  "Sand linen studio",
  "Pastel blue sweep",
  "Black gloss with rim light",
  "Marble kitchen",
  "Bathroom vanity",
  "Cozy bedroom",
  "Cafe window table",
  "Living room sofa",
  "Home office desk",
  "Gym corner",
  "Sunny balcony",
  "Beach at golden hour",
  "Linen tabletop",
  "Terrazzo top",
];
const POSES = [
  "Hand holding product close up",
  "Two hands presenting",
  "Sitting with product on lap",
  "Walking with product",
  "Mirror selfie",
  "Over the shoulder look",
  "Product at face level",
  "Hand reaching into a flat lay",
  "Chin rest",
  "Back glance",
  "Phone selfie",
  "Seated on chair",
  "Reach to camera",
  "Side turn",
  "Cuff adjust",
  "Seated on block",
  "Laptop on stool",
];

describe("label lock", () => {
  test("keeps the printed lines in order and drops junk", () => {
    deepStrictEqual(parseLabel({ lines: [" ACME  GLOW ", "SERUM", 3, "", "30 ml"] }), [
      "ACME GLOW",
      "SERUM",
      "30 ml",
    ]);
    deepStrictEqual(parseLabel(null), []);
    deepStrictEqual(parseLabel({ lines: "ACME" }), []);
    strictEqual(parseLabel({ lines: Array(20).fill("x") }).length, 8);
  });

  test("the prompt line quotes every word, and is empty without a label", () => {
    const line = labelLine(["ACME GLOW SERUM", "30 ml"]);
    ok(line.includes('"ACME GLOW SERUM" / "30 ml"'));
    strictEqual(labelLine([]), "");
  });
});

describe("photo check", () => {
  test("asks about people only when a person is in the shot", () => {
    const text = (person: boolean) =>
      JSON.stringify(checkMessages("data:p", "data:o", { label: ["ACME"], person }));
    ok(text(true).includes("exactly one person"));
    ok(!text(false).includes("exactly one person"));
    ok(text(false).includes('\\"ACME\\"'));
  });

  test("only a clear false fails; a broken reply passes", () => {
    deepStrictEqual(parseCheck({ pass: false, issues: ["hand not attached", 4] }), {
      pass: false,
      issues: ["hand not attached"],
    });
    strictEqual(parseCheck(null).pass, true);
    strictEqual(parseCheck({ issues: ["x"] }).pass, true);
  });

  test("the retry names the problems", () => {
    ok(fixLine(["head cropped", "six fingers"]).includes("head cropped; six fingers"));
  });
});

describe("piece direction", () => {
  test("every preset scene has its own light and lens, every pose its framing", () => {
    for (const name of SCENES) ok(sceneDirection(name), name);
    for (const name of POSES) ok(poseFraming(name), name);
    strictEqual(sceneDirection("My kitchen upload"), undefined);
  });

  const brief = (refs: { role: "product" | "scene" | "character" | "pose"; name: string }[]) => ({
    product: { name: "Acme Glow Serum" },
    refs,
    aspect: "1:1" as const,
    mode: "piece" as const,
    label: ["ACME GLOW SERUM"],
  });

  test("the prompt uses the scene's light, the pose's framing and the person rules", () => {
    const p = photoPrompt(
      brief([
        { role: "product", name: "Acme Glow Serum" },
        { role: "scene", name: "Bathroom vanity" },
        { role: "character", name: "Ayesha K." },
        { role: "pose", name: "Hand holding product close up" },
      ]),
      0,
      1,
    );
    ok(p.includes(sceneDirection("Bathroom vanity")!.light));
    ok(p.includes(`- Framing: ${poseFraming("Hand holding product close up")}`));
    ok(p.includes(PERSON_RULES[0]));
    ok(p.includes('"ACME GLOW SERUM"'));
    ok(!p.includes("85mm product lens look"));
  });

  test("no person picked: no person rules; unknown scene: the generic light", () => {
    const p = photoPrompt(
      brief([
        { role: "product", name: "Acme Glow Serum" },
        { role: "scene", name: "My garden" },
      ]),
      0,
      1,
    );
    ok(!p.includes(PERSON_RULES[0]));
    ok(!p.includes("Framing:"));
    ok(p.includes("soft directional key light matching the SCENE"));
  });
});
