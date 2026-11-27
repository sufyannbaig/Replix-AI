// Run with: node --test src/lib/v2/ai-metadata.test.ts
// The "made with AI" mark written into downloaded pictures.
import { describe, test } from "node:test";
import { deepStrictEqual, ok, strictEqual } from "node:assert";
import { AI_SOURCE, aiXmp, crc32, withAiMetadata } from "./ai-metadata.ts";

const latin = (b: Uint8Array) => new TextDecoder("latin1").decode(b);
const pad = (b: number[], n: number) => Uint8Array.from([...b, ...new Array(n).fill(0x11)]);

/* SOI, a 16-byte JFIF APP0, some scan bytes, EOI. */
const jpeg = Uint8Array.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 1, 1, 0, 0, 1, 0, 1, 0, 0, 0xff,
  0xdb, 0x00, 0x04, 9, 9, 0xff, 0xd9,
]);
/* Signature, a 13-byte IHDR chunk (with a made-up CRC), then IEND. */
const png = Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 0, 1,
  0, 0, 0, 1, 8, 6, 0, 0, 0, 1, 2, 3, 4, 0, 0, 0, 0, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
]);

describe("AI mark in downloads", () => {
  test("the packet names the IPTC source type", () => {
    ok(aiXmp().includes(`DigitalSourceType="${AI_SOURCE.generated}"`));
    ok(aiXmp("composite").includes("compositeWithTrainedAlgorithmicMedia"));
  });

  test("crc32 matches the standard check value", () => {
    strictEqual(crc32(new TextEncoder().encode("123456789")), 0xcbf43926);
  });

  test("JPEG: an XMP segment goes after APP0, the rest is untouched", () => {
    const out = withAiMetadata(jpeg);
    deepStrictEqual([...out.subarray(0, 20)], [...jpeg.subarray(0, 20)]);
    strictEqual(out[20], 0xff);
    strictEqual(out[21], 0xe1);
    const size = (out[22] << 8) | out[23];
    ok(latin(out.subarray(24, 22 + size)).startsWith("http://ns.adobe.com/xap/1.0/\0"));
    ok(latin(out).includes("trainedAlgorithmicMedia"));
    deepStrictEqual([...out.subarray(22 + size)], [...jpeg.subarray(20)]);
  });

  test("PNG: an iTXt chunk goes after IHDR with a correct length and CRC", () => {
    const out = withAiMetadata(png, "composite");
    deepStrictEqual([...out.subarray(0, 33)], [...png.subarray(0, 33)]);
    const length = (out[33] << 24) | (out[34] << 16) | (out[35] << 8) | out[36];
    strictEqual(latin(out.subarray(37, 41)), "iTXt");
    ok(latin(out.subarray(41, 41 + length)).startsWith("XML:com.adobe.xmp\0"));
    const end = 41 + length;
    const crc =
      ((out[end] << 24) | (out[end + 1] << 16) | (out[end + 2] << 8) | out[end + 3]) >>> 0;
    strictEqual(crc, crc32(out.subarray(37, end)));
    deepStrictEqual([...out.subarray(end + 4)], [...png.subarray(33)]);
  });

  test("marked files, other formats and tiny files are left alone", () => {
    const once = withAiMetadata(jpeg);
    strictEqual(withAiMetadata(once), once);
    const webp = pad([0x52, 0x49, 0x46, 0x46], 40);
    strictEqual(withAiMetadata(webp), webp);
    const tiny = Uint8Array.from([0xff, 0xd8, 0xff]);
    strictEqual(withAiMetadata(tiny), tiny);
  });
});
