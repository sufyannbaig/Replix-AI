// Run with: node --test src/lib/v2/writer.test.ts
import { describe, test } from "node:test";
import { strictEqual, ok } from "node:assert";
import { parseWriter, writerMessages } from "./writer.ts";

describe("writer", () => {
  test("tidies and caps the reply", () => {
    strictEqual(parseWriter({ text: ' "One drop.  Glow." ' }, "climax"), "One drop. Glow.");
    strictEqual(parseWriter({ text: "x".repeat(900) }, "climax").length, 400);
    strictEqual(parseWriter(null, "concept"), "");
  });
  test("the brief carries the product and the other fields", () => {
    const m = writerMessages("climax", {
      productName: "Glow",
      concept: "Tired morning",
      emotion: "Desire",
    });
    ok(m[1].content.includes("Product: Glow.") && m[1].content.includes("Concept: Tired morning"));
    ok(
      !writerMessages("concept", { productName: "G", concept: "x" })[1].content.includes(
        "Concept: x",
      ),
    );
  });
});
