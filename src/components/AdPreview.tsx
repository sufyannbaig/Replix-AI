import { useEffect, useRef, useState } from "react";
import replixLogoAsset from "@/assets/replix-mark.png.asset.json";
import {
  AD_TEMPLATES,
  clampHeadline,
  fitHeadlineSize,
  resolveAccent,
  type AdTemplateId,
} from "@/lib/ad-templates";

const replixLogo = replixLogoAsset.url;

/** Kept for backwards compatibility with existing callers. */
export type AdStyleId = AdTemplateId;

interface AdPreviewProps {
  styleId: AdStyleId;
  imageUrl: string;
  imageAlt: string;
  /** AI headline. */
  hook?: string;
  /** Optional supporting line (short caption / subheading). */
  supporting?: string | null;
  cta?: string;
  showOverlay?: boolean;
  /** Short objective badge (e.g. "NEW DROP", "SALE"). */
  badge?: string | null;
  /** Optional brand colour (hex) used for CTA / badge accents. */
  brandColor?: string | null;
  /** CSS aspect-ratio value (e.g. "1 / 1", "4 / 5", "9 / 16"). */
  aspectRatio?: string;
}

export function AdPreview({
  styleId,
  imageUrl,
  imageAlt,
  hook,
  supporting,
  cta,
  showOverlay,
  badge,
  brandColor,
  aspectRatio = "4 / 5",
}: AdPreviewProps) {
  const template = AD_TEMPLATES[styleId] ?? AD_TEMPLATES.minimal;
  const canvasRef = useRef<HTMLDivElement>(null);
  const [unit, setUnit] = useState(5.4); // px per 1% of canvas width

  // 1em == 1% of the canvas width, so every template value scales perfectly
  // at any preview size and at 1080x1080 export.
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const apply = () => {
      const w = el.getBoundingClientRect().width || el.offsetWidth;
      if (w > 0) setUnit(w / 100);
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const headline = hook ? clampHeadline(hook) : "";
  const headlineSize = headline
    ? fitHeadlineSize(headline, template.typography.headlineSize)
    : template.typography.headlineSize;
  const { accent, accentText } = resolveAccent(template, brandColor);
  const chip = badge?.trim();
  const hasText = Boolean(showOverlay && (headline || cta || supporting));
  const t = template.typography;

  return (
    <div
      className="overflow-hidden rounded-xl border border-border bg-background"
      aria-label="Ad preview"
      data-ad-style={styleId}
    >
      <div
        ref={canvasRef}
        className="relative overflow-hidden animate-fade-in"
        style={{ aspectRatio, fontSize: `${unit}px`, ...template.background }}
      >
        {template.backLayers?.map((layer, i) => (
          <div
            key={`back-${i}`}
            className="pointer-events-none absolute"
            style={{ inset: 0, ...layer }}
            aria-hidden
          />
        ))}

        {/* Inner product card */}
        <div
          className="absolute flex flex-col"
          style={{
            inset: `${template.cardInset}em`,
            borderRadius: `${template.cardRadius}em`,
            padding: `${template.cardPadding}em`,
            gap: `${template.cardPadding * 0.5}em`,
            overflow: "hidden",
            ...template.card,
          }}
        >
          {/* Headline */}
          {hasText && headline && (
            <p
              style={{
                fontFamily: t.headlineFamily,
                fontWeight: t.headlineWeight,
                color: t.headlineColor,
                letterSpacing: t.headlineTracking,
                textTransform: t.headlineTransform,
                fontStyle: t.headlineItalic ? "italic" : undefined,
                fontSize: `${headlineSize}em`,
                lineHeight: 1.04,
                textAlign: t.align,
                margin: 0,
                overflowWrap: "break-word",
                hyphens: "auto",
              }}
            >
              {headline}
            </p>
          )}

          {/* Product — object-contain keeps proportions and never crops */}
          <div
            className="relative min-h-0 flex-1"
            style={{ display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            <img
              src={imageUrl}
              alt={imageAlt}
              className="size-full select-none"
              style={{
                objectFit: "contain",
                filter: template.product.shadow,
                mixBlendMode: "multiply",
              }}
            />
          </div>

          {/* Supporting copy + CTA */}
          {hasText && (supporting || cta) && (
            <div
              style={{
                display: "grid",
                gap: `${template.cardPadding * 0.35}em`,
                justifyItems: t.align === "center" ? "center" : "start",
              }}
            >
              {supporting && (
                <p
                  style={{
                    fontFamily: t.bodyFamily,
                    color: t.bodyColor,
                    fontSize: `${Math.max(headlineSize * 0.34, 2.6)}em`,
                    lineHeight: 1.3,
                    textAlign: t.align,
                    margin: 0,
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {supporting}
                </p>
              )}
              {cta && (
                <span
                  style={{
                    fontFamily: t.bodyFamily,
                    fontWeight: 800,
                    fontSize: "3em",
                    lineHeight: 1,
                    padding:
                      template.cta.shape === "pill" ? "1.6em 3.4em" : "0 0 0.6em 0",
                    borderRadius: template.cta.shape === "pill" ? "999em" : 0,
                    borderBottom:
                      template.cta.shape === "rule" ? `0.12em solid ${accent}` : undefined,
                    background: template.cta.shape === "pill" ? accent : "transparent",
                    color: template.cta.shape === "pill" ? accentText : accent,
                    whiteSpace: "nowrap",
                    maxWidth: "100%",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    ...template.cta.style,
                  }}
                >
                  {cta}
                </span>
              )}
            </div>
          )}
        </div>

        {template.frontLayers?.map((layer, i) => (
          <div
            key={`front-${i}`}
            className="pointer-events-none absolute"
            style={layer}
            aria-hidden
          />
        ))}

        {/* Badge / offer chip */}
        {chip && (
          <div
            className="pointer-events-none absolute font-bold uppercase"
            style={{
              top: `${Math.max(template.cardInset - 6, 2)}em`,
              left: `${Math.max(template.cardInset - 6, 2)}em`,
              background: template.colors.badgeBg,
              color: template.colors.badgeText,
              fontSize: "2.4em",
              letterSpacing: "0.14em",
              padding: "0.7em 1.4em",
              borderRadius: "999em",
            }}
            aria-hidden
          >
            {chip}
          </div>
        )}

        {/* Replix watermark */}
        <img
          src={replixLogo}
          alt=""
          aria-hidden
          className="pointer-events-none absolute z-10 select-none object-contain"
          style={{
            bottom: "1.6em",
            right: "1.6em",
            width: "7em",
            height: "7em",
            opacity: 0.85,
            filter: "drop-shadow(0 0.1em 0.3em rgba(0,0,0,0.45))",
          }}
        />
      </div>
    </div>
  );
}
