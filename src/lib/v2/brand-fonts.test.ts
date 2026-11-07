import { test } from "node:test";
import assert from "node:assert/strict";
import {
  FONT_UPLOAD_TYPES,
  POPULAR_FONTS,
  fontNameFromFile,
  fontsourceId,
  googleFontFile,
  nearestWeight,
  searchFonts,
} from "../../v2/data/fonts.ts";

test("fontsource ids are lower-case and dashed", () => {
  assert.equal(fontsourceId("Playfair Display"), "playfair-display");
  assert.equal(fontsourceId("  DM Serif Display "), "dm-serif-display");
  assert.equal(fontsourceId("M PLUS 1p"), "m-plus-1p");
});

test("google font files are static latin woff by default", () => {
  assert.equal(
    googleFontFile("Inter Tight", 700),
    "https://cdn.jsdelivr.net/fontsource/fonts/inter-tight@latest/latin-700-normal.woff",
  );
  assert.match(googleFontFile("Inter", 400, "woff2"), /latin-400-normal\.woff2$/);
});

test("nearest weight prefers the closest, heavier on a tie", () => {
  assert.equal(nearestWeight([400, 700], 700), 700);
  assert.equal(nearestWeight([400, 500, 600], 700), 600);
  assert.equal(nearestWeight([400, 600], 500), 600);
  assert.equal(nearestWeight([], 700), 700);
});

test("search puts prefix matches first and respects the limit", () => {
  const names = searchFonts(POPULAR_FONTS, "sans").map((f) => f.family);
  assert.ok(names.includes("DM Sans"));
  assert.ok(names.includes("Plus Jakarta Sans"));
  const pre = searchFonts(POPULAR_FONTS, "in").map((f) => f.family);
  assert.equal(pre[0], "Inter");
  assert.equal(pre[1], "Inter Tight");
  assert.equal(searchFonts(POPULAR_FONTS, "", 5).length, 5);
  assert.equal(searchFonts(POPULAR_FONTS, "zzzz").length, 0);
});

test("uploaded font names and types", () => {
  assert.equal(fontNameFromFile("Acme_Sans-Bold.otf"), "Acme Sans Bold");
  assert.equal(fontNameFromFile(".ttf"), "Custom font");
  assert.deepEqual(Object.keys(FONT_UPLOAD_TYPES).sort(), ["otf", "ttf", "woff"]);
});

test("the storage policy allows the same font extensions", async () => {
  const { readFile } = await import("node:fs/promises");
  const sql = await readFile(
    new URL("../../../supabase/migrations/20261107140000_v2_brand_fonts.sql", import.meta.url),
    "utf8",
  );
  for (const ext of Object.keys(FONT_UPLOAD_TYPES)) assert.match(sql, new RegExp(`'${ext}'`));
});
