import { createFileRoute } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { AppShell } from "@/v2/components/shell/AppShell";
import { PillButton, SectionTitle } from "@/v2/components/primitives";
import { useBrandKits, useExtractBrandKit } from "@/v2/data/api";
import type { BrandKit } from "@/v2/data/types";
import logoMark from "@/assets/v2/logo-mark.png";
import assetCap from "@/assets/v2/brand/asset-cap.png";
import assetBottle from "@/assets/v2/brand/asset-bottle.png";
import linkA from "@/assets/v2/brand/link-a.svg";
import linkB from "@/assets/v2/brand/link-b.svg";
import linkC from "@/assets/v2/brand/link-c.svg";

export const Route = createFileRoute("/_app/brand-kit")({
  validateSearch: (search: Record<string, unknown>): { new?: "1" } =>
    search.new === "1" || search.new === 1 ? { new: "1" } : {},
  head: () => ({ meta: [{ title: "Brand Kit · Replix AI" }] }),
  component: BrandKitPage,
});

/* Figma's subtitle reads "Upload Or Setup Your Brand Kit For Further Result". */
const SUBTITLE = "Logo, colours, fonts and tone applied to every generation";

function normaliseWebsite(input: string) {
  const trimmed = input.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
    return url.hostname.includes(".") ? url.hostname.replace(/^www\./, "") : null;
  } catch {
    return null;
  }
}

function BrandKitPage() {
  const { data: kits = [] } = useBrandKits();
  const kit = kits[0];
  const extract = useExtractBrandKit();

  const run = (website: string) => {
    if (!kit) return;
    extract.mutate(
      { kitId: kit.id, website },
      {
        onSuccess: () => toast.success("Brand kit ready. It now shapes every generation."),
        onError: () => toast.error("We couldn't read that website. Try again or upload manually."),
      },
    );
  };

  if (kit?.isComplete) {
    return (
      <AppShell title="Brand Kit" subtitle={SUBTITLE}>
        <div className="mt-[30px] flex justify-end">
          <PillButton
            variant="outline"
            className="opacity-60 hover:opacity-100"
            disabled={extract.isPending || !kit.website}
            onClick={() => kit.website && run(kit.website)}
          >
            {extract.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            Re-sync From Website
          </PillButton>
        </div>
        <FilledKit kit={kit} />
      </AppShell>
    );
  }

  return (
    <AppShell title="Brand Kit" subtitle={SUBTITLE}>
      <EmptyKit pending={extract.isPending} onExtract={run} />
    </AppShell>
  );
}

/* ---------- Empty state (Figma 543:25614) ---------- */

function Callout({ className, children }: { className: string; children: ReactNode }) {
  return <div className={cn("absolute rounded-[6px] bg-white", className)}>{children}</div>;
}

function EmptyKit({
  pending,
  onExtract,
}: {
  pending: boolean;
  onExtract: (website: string) => void;
}) {
  const [value, setValue] = useState("");
  const submit = () => {
    const site = normaliseWebsite(value);
    if (!site) {
      toast.error("Enter a website like acme.com");
      return;
    }
    onExtract(site);
  };

  return (
    <section className="mx-auto mt-10 flex max-w-[686px] flex-col items-center overflow-hidden rounded-[18px] bg-v2-surface px-6 pb-10 pt-[42px] sm:px-[90px] sm:pb-[27px]">
      {/* Brand moodboard illustration: colours, logo, type and assets around a card. */}
      <div
        aria-hidden
        className={cn(
          "relative h-[201px] w-[392px] shrink-0 origin-top max-sm:-mb-[50px] max-sm:scale-75",
          pending && "animate-pulse",
        )}
      >
        <img src={linkA} alt="" className="absolute left-[255px] top-0 h-[25.7px] w-[30.7px]" />
        <img src={linkB} alt="" className="absolute left-[90px] top-[23px] h-[15.7px] w-[42.7px]" />
        <img
          src={linkC}
          alt=""
          className="absolute left-[257px] top-[147px] h-[33.7px] w-[15.7px]"
        />
        <div className="absolute left-[114px] top-[25px] h-[131px] w-[176px] rounded-[14px] bg-[#f5f5f5] shadow-[0_0_26.8px_rgba(0,0,0,0.04)]" />
        <img
          src={logoMark}
          alt=""
          className="absolute left-[168px] top-[57px] size-[68px] rounded-[6px] object-cover"
        />
        <Callout className="left-0 top-[38px] h-[82px] w-[120px] px-2 pt-2 shadow-[1px_4px_14.2px_rgba(232,169,59,0.08)]">
          <p className="font-archivo text-[10px] font-medium leading-[1.4] text-black">
            Brand Colour
          </p>
          <div className="mt-2.5 flex justify-between">
            {["#162544", "#fab91b", "#f5f5f5"].map((c) => (
              <span key={c} className="h-[42px] w-7 rounded-[4px]" style={{ background: c }} />
            ))}
          </div>
        </Callout>
        <Callout className="left-[272px] top-[4px] h-[92px] w-[120px] px-[11px] pt-[11px] shadow-[1px_4px_14.2px_rgba(153,186,255,0.44)]">
          <p className="font-archivo text-lg font-semibold leading-none text-black">Aa</p>
          <p className="mt-1 font-archivo text-xs font-medium leading-[1.4] text-black">Archivo</p>
          <p className="mt-[22px] flex gap-1.5 font-archivo text-[8px] leading-[1.4] text-black opacity-50">
            <span>Aa</span>
            <span>Bb</span>
            <span>Cc</span>
            <span>Dd</span>
            <span>Ee</span>
            <span>Ff</span>
          </p>
        </Callout>
        <Callout className="left-[272px] top-[120px] h-[81px] w-[120px] px-2 pt-2 shadow-[4px_3px_16.1px_rgba(0,0,0,0.05)]">
          <p className="font-archivo text-[10px] font-medium leading-[1.4] text-black">
            Brand Assets
          </p>
          <div className="mt-2 flex gap-2.5">
            <img src={assetCap} alt="" className="h-9 w-[47px] rounded-[5px] object-cover" />
            <img src={assetBottle} alt="" className="h-9 w-[47px] rounded-[5px] object-cover" />
          </div>
        </Callout>
      </div>

      <div className="mt-[22px] flex w-full flex-col items-center gap-[13px] text-center">
        <h2 className="type-page-title text-v2-ink">
          {pending ? "Reading your website…" : "Set up your brand kit"}
        </h2>
        <p className="max-w-[374px] type-subtitle text-v2-ink-70">
          {pending
            ? "Pulling your logo, colours, fonts, tone of voice and brand images."
            : "Paste your website. We pull your logo, colours, fonts, tone of voice and brand images for you."}
        </p>
        <form
          className="mt-[10px] flex w-full flex-col gap-[7px] sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            disabled={pending}
            inputMode="url"
            placeholder="Paste your website link, e.g. acme.com"
            aria-label="Website"
            className="h-[49px] w-full min-w-0 shrink-0 rounded-[50px] border border-[#a2a2a2] sm:w-auto sm:flex-1 bg-transparent px-5 font-inter-tight text-sm text-v2-ink outline-none placeholder:text-xs placeholder:text-v2-ink-70 focus:border-v2-blue night:border-v2-border"
          />
          <PillButton type="submit" disabled={pending} className="h-[49.88px]">
            {pending ? <Loader2 className="size-4 animate-spin" /> : null}
            Extract
          </PillButton>
        </form>
      </div>

      <div className="mt-5 flex w-full items-center gap-[19px] font-inter-tight text-base text-v2-ink-70">
        <span className="h-px flex-1 bg-black/20 night:bg-v2-line" />
        Or
        <span className="h-px flex-1 bg-black/20 night:bg-v2-line" />
      </div>
      <PillButton
        variant="outline"
        className="mt-[14px] opacity-60 hover:opacity-100"
        onClick={() => toast("Manual upload opens the brand editor once the backend is connected.")}
      >
        Upload Manually
      </PillButton>
    </section>
  );
}

/* ---------- Filled state (Figma 543:72077) ---------- */

function Card({
  title,
  className,
  children,
}: {
  title: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={cn("flex flex-col gap-[23px] rounded-[14px] bg-v2-surface p-[18px]", className)}
    >
      <h2 className="type-card-title text-v2-ink">{title}</h2>
      {children}
    </section>
  );
}

function FilledKit({ kit }: { kit: BrandKit }) {
  return (
    <div className="mt-[29px] flex flex-col gap-10">
      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        <Card title="Logo">
          <div className="flex gap-[30px]">
            {kit.logos.slice(0, 2).map((logo, i) => (
              <img
                key={logo}
                src={logo}
                alt={i === 0 ? `${kit.name} logo` : `${kit.name} logo, alternate`}
                className={cn(
                  "h-[115px] w-[134px] rounded-[6px] object-cover",
                  i > 0 && "border border-black/[0.13]",
                )}
              />
            ))}
          </div>
        </Card>
        <Card title="Colours">
          <div className="flex h-[114px] justify-between">
            {kit.colors.map((hex) => (
              <div key={hex} className="flex w-[58px] flex-col gap-[13px]">
                <span
                  className="flex-1 rounded-[6px] border border-black/10"
                  style={{ background: hex }}
                />
                <span className="text-center type-caption text-v2-ink-70">{hex}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card title="Fonts">
          <div className="flex h-[114px] flex-col justify-between">
            <div className="flex items-start gap-[25px]">
              <span className="font-archivo text-[57px] font-semibold leading-[0.75] tracking-[-1.14px] text-v2-ink">
                Aa
              </span>
              <span className="flex flex-col gap-1">
                <span className="type-card-title text-v2-ink">{kit.fonts?.heading}</span>
                <span className="font-inter-tight text-base tracking-[-0.32px] text-v2-ink-60">
                  {kit.fonts?.body}
                </span>
              </span>
            </div>
            {/* Figma repeats the setup copy here; describe how the fonts are used instead. */}
            <p className="type-caption text-v2-ink-70">
              {kit.fonts?.heading} for headlines, {kit.fonts?.body} for body copy and captions.
            </p>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-10 md:grid-cols-2">
        <Card title="Tone Of Voice" className="gap-[22px]">
          <div className="flex flex-col gap-[17px]">
            <div className="flex flex-wrap gap-[11px]">
              {kit.toneTags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-[50px] border-[0.7px] border-black/60 px-3 py-1.5 font-inter-tight text-xs tracking-[0.24px] text-[#616161] night:border-v2-border night:text-v2-ink-70"
                >
                  {tag}
                </span>
              ))}
            </div>
            <p className="type-subtitle text-v2-ink-70">{kit.tone}</p>
          </div>
        </Card>
        <Card title="About & Audience" className="gap-[22px]">
          <p className="type-subtitle text-v2-ink-70">{kit.audience}</p>
        </Card>
      </div>

      <section className="flex flex-col gap-[30px]">
        {/* Figma calls these "Product Images"; per the wireframe they are the brand's images. */}
        <SectionTitle>Brand Images</SectionTitle>
        <div className="grid grid-cols-2 gap-5 rounded-[18px] bg-v2-surface px-3 py-4 sm:grid-cols-3 sm:px-[27px] sm:py-7 lg:grid-cols-5">
          {kit.images.map((src) => (
            <img
              key={src}
              src={src}
              alt=""
              className="aspect-[183/231] w-full rounded-[12px] object-cover"
            />
          ))}
        </div>
      </section>
    </div>
  );
}
