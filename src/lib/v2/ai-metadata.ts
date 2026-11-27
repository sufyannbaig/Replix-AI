/**
 * Marks a downloaded picture as AI-made, in the file itself. It writes the IPTC
 * "digital source type" into an XMP packet, the machine-readable mark that Meta, Google
 * and others read to label AI content (and what the EU AI Act's Article 50 asks for).
 * JPEG and PNG only; any other file is returned unchanged. Pure, so it is unit-tested.
 */
const IPTC = "http://cv.iptc.org/newscodes/digitalsourcetype/";
/** Fully made by a model (photos) or a model's picture with our own type on it (ads). */
export const AI_SOURCE = {
  generated: `${IPTC}trainedAlgorithmicMedia`,
  composite: `${IPTC}compositeWithTrainedAlgorithmicMedia`,
} as const;
export type AiSource = keyof typeof AI_SOURCE;

export function aiXmp(source: AiSource = "generated") {
  return `<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?><x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description rdf:about="" xmlns:Iptc4xmpExt="http://iptc.org/std/Iptc4xmpExt/2008-02-29/" xmlns:xmp="http://ns.adobe.com/xap/1.0/" Iptc4xmpExt:DigitalSourceType="${AI_SOURCE[source]}" xmp:CreatorTool="Replix AI"/></rdf:RDF></x:xmpmeta><?xpacket end="w"?>`;
}

const ascii = (text: string) => Uint8Array.from(text, (c) => c.charCodeAt(0) & 0xff);
const utf8 = (text: string) => new TextEncoder().encode(text);

function join(parts: Uint8Array[]) {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

let table: Uint32Array | undefined;
export function crc32(bytes: Uint8Array) {
  table ??= Uint32Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  let crc = 0xffffffff;
  for (const b of bytes) crc = table[(crc ^ b) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

const isJpeg = (b: Uint8Array) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const isPng = (b: Uint8Array) => PNG_SIG.every((v, i) => b[i] === v);

/** JPEG: an APP1 XMP segment right after the start marker (and after JFIF's APP0, if any). */
function jpegWithXmp(bytes: Uint8Array, xmp: string) {
  const payload = join([ascii("http://ns.adobe.com/xap/1.0/\0"), utf8(xmp)]);
  const size = payload.length + 2;
  if (size > 0xffff) return bytes;
  let at = 2;
  if (bytes[2] === 0xff && bytes[3] === 0xe0) at = 4 + ((bytes[4] << 8) | bytes[5]);
  if (at > bytes.length) return bytes;
  const head = Uint8Array.of(0xff, 0xe1, size >> 8, size & 0xff);
  return join([bytes.subarray(0, at), head, payload, bytes.subarray(at)]);
}

/** PNG: an iTXt chunk with the XMP keyword, right after the header chunk. */
function pngWithXmp(bytes: Uint8Array, xmp: string) {
  const headerEnd = 8 + 12 + ((bytes[8] << 24) | (bytes[9] << 16) | (bytes[10] << 8) | bytes[11]);
  if (ascii("IHDR").some((v, i) => bytes[12 + i] !== v) || headerEnd > bytes.length) return bytes;
  const body = join([ascii("iTXt"), ascii("XML:com.adobe.xmp\0\0\0\0\0"), utf8(xmp)]);
  const length = body.length - 4;
  const crc = crc32(body);
  const be = (n: number) => Uint8Array.of(n >>> 24, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff);
  return join([bytes.subarray(0, headerEnd), be(length), body, be(crc), bytes.subarray(headerEnd)]);
}

/** The same picture with the AI mark added. Files that already carry XMP are left alone. */
export function withAiMetadata(bytes: Uint8Array, source: AiSource = "generated") {
  try {
    if (bytes.length < 24) return bytes;
    const head = new TextDecoder("latin1").decode(bytes.subarray(0, Math.min(bytes.length, 65536)));
    if (head.includes("DigitalSourceType")) return bytes;
    if (isJpeg(bytes)) return jpegWithXmp(bytes, aiXmp(source));
    if (isPng(bytes)) return pngWithXmp(bytes, aiXmp(source));
    return bytes;
  } catch {
    return bytes;
  }
}
