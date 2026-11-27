// Run with: node --test src/lib/v2/page-meta.test.ts
import { describe, test } from "node:test";
import { deepStrictEqual, strictEqual } from "node:assert";
import { isSafePublicUrl, readBrand, readProduct } from "./page-meta.ts";

describe("isSafePublicUrl", () => {
  test("allows public http(s) hosts", () => {
    strictEqual(
      isSafePublicUrl("https://shop.example.com/products/a")?.hostname,
      "shop.example.com",
    );
    strictEqual(isSafePublicUrl("http://example.co.uk")?.hostname, "example.co.uk");
  });
  test("blocks private, local and odd targets", () => {
    for (const bad of [
      "http://localhost/",
      "http://127.0.0.1/",
      "http://169.254.169.254/latest/meta-data",
      "http://[::1]/",
      "https://printer.local/",
      "https://intranet/",
      "ftp://example.com/",
      "https://user:pass@example.com/",
      "https://example.com:8443/",
      "not a url",
    ]) {
      strictEqual(isSafePublicUrl(bad), null, bad);
    }
  });
});

const base = new URL("https://store.example.com/products/serum");

describe("readProduct", () => {
  test("prefers JSON-LD Product with price", () => {
    const html = `<html><head><title>Ignore me</title>
      <script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"Product","name":"Glow Serum &amp; Oil","description":"Light daily serum.","image":["/img/serum.jpg"],"offers":{"@type":"Offer","price":"34.99","priceCurrency":"USD"}}]}</script>
      </head></html>`;
    deepStrictEqual(readProduct(html, base), {
      name: "Glow Serum & Oil",
      description: "Light daily serum.",
      imageUrl: "https://store.example.com/img/serum.jpg",
      price: "$34.99",
    });
  });
  test("falls back to Open Graph tags", () => {
    const html = `<meta property="og:title" content="Charge Pad">
      <meta property="og:description" content="Wireless charger">
      <meta property="og:image" content="https://cdn.example.com/pad.png">
      <meta property="product:price:amount" content="20"><meta property="product:price:currency" content="GBP">`;
    deepStrictEqual(readProduct(html, base), {
      name: "Charge Pad",
      description: "Wireless charger",
      imageUrl: "https://cdn.example.com/pad.png",
      price: "£20.00",
    });
  });
});

describe("readBrand", () => {
  test("finds logo, colours, fonts and text", () => {
    const html = `<html><head>
      <meta property="og:site_name" content="Acme">
      <meta name="theme-color" content="#162544">
      <link rel="icon" href="/favicon.ico">
      <link href="https://fonts.googleapis.com/css2?family=Archivo:wght@500&amp;family=Inter+Tight&amp;display=swap" rel="stylesheet">
      <style>body{font-family:"Inter Tight",sans-serif;color:#162544}.cta{background:#FAB91B;color:#fff}.x{color:#162544}</style>
      <script>var hidden = "#000000";</script>
      </head><body><img class="site-logo" src="/logo.png" alt="Acme"><h1>Skincare that works</h1></body></html>`;
    const brand = readBrand(html, base);
    strictEqual(brand.siteName, "Acme");
    strictEqual(brand.logoUrl, "https://store.example.com/logo.png");
    strictEqual(brand.themeColor, "#162544");
    deepStrictEqual(brand.cssColors.slice(0, 3), ["#162544", "#fab91b", "#ffffff"]);
    deepStrictEqual(brand.fonts, ["Archivo", "Inter Tight"]);
    strictEqual(brand.text.includes("Skincare that works"), true);
    strictEqual(brand.text.includes("hidden"), false);
  });
});
