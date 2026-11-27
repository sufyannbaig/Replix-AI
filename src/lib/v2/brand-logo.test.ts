import { test } from "node:test";
import assert from "node:assert/strict";
import { logoFileFor, siteKey, type WikidataEntity } from "./brand-logo.ts";

const claim = (value: string, extra: object = {}) => ({
  rank: "normal" as const,
  mainsnak: { datavalue: { value } },
  ...extra,
});

test("siteKey treats www, paths and subdomains as the same site", () => {
  assert.equal(siteKey("https://www.adidas.com/us"), "adidas.com");
  assert.equal(siteKey("adidas.com"), "adidas.com");
  assert.equal(siteKey("shop.adidas.com"), "adidas.com");
  assert.equal(siteKey("www.boots.co.uk"), "boots.co.uk");
});

test("logoFileFor takes the logo only when the website matches", () => {
  const adidas: WikidataEntity = {
    claims: { P856: [claim("https://www.adidas.com/")], P154: [claim("Adidas 2022 logo.svg")] },
  };
  assert.equal(logoFileFor(adidas, "adidas.com"), "Adidas 2022 logo.svg");
  assert.equal(logoFileFor(adidas, "adidas-fans.com"), null);
});

test("logoFileFor skips retired and deprecated logos and prefers the preferred one", () => {
  const brand: WikidataEntity = {
    claims: {
      P856: [claim("https://brand.com")],
      P154: [
        claim("old.svg", { qualifiers: { P582: [{}] } }),
        claim("bad.svg", { rank: "deprecated" }),
        claim("current.svg"),
        claim("main.svg", { rank: "preferred" }),
      ],
    },
  };
  assert.equal(logoFileFor(brand, "brand.com"), "main.svg");
  brand.claims!.P154 = brand.claims!.P154.slice(0, 3);
  assert.equal(logoFileFor(brand, "brand.com"), "current.svg");
});
