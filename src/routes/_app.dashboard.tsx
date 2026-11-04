import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useCredits } from "@/hooks/use-credits";
import { cn } from "@/lib/utils";
import { AppShell } from "@/v2/components/shell/AppShell";
import { CheckCircleIcon, Icon } from "@/v2/components/Icon";
import { Masonry } from "@/v2/components/Masonry";
import { FilterTabs, PillLink, SectionTitle } from "@/v2/components/primitives";
import { useBrandKits, useCommunityCreations, useRecentGenerations } from "@/v2/data/api";
import type { CommunityCreation, CreationKind } from "@/v2/data/types";
import createPhoto from "@/assets/v2/catalog/loops/home-photo.webp";
import createAd from "@/assets/v2/catalog/loops/home-ad.webp";
import createVideo from "@/assets/v2/catalog/loops/home-video.webp";
import playIcon from "@/assets/v2/icons/play.svg";
import { LoopingPreview } from "@/v2/components/LoopingPreview";
import promoBack from "@/assets/v2/gallery/44dcb.png";
import promoMiddle from "@/assets/v2/gallery/d726d.png";
import promoFront from "@/assets/v2/gallery/d1a08.png";

export const Route = createFileRoute("/_app/dashboard")({
  head: () => ({ meta: [{ title: "Home · Replix AI" }] }),
  component: HomePage,
});

function greeting(date = new Date()) {
  const hour = date.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function useFirstName() {
  const { user } = useAuth();
  const meta = user?.user_metadata ?? {};
  const full = (meta.full_name ?? meta.name ?? "") as string;
  const fromEmail = (user?.email ?? "").split("@")[0].split(/[._-]/)[0];
  const name = full.trim().split(/\s+/)[0] || fromEmail;
  return name ? name.charAt(0).toUpperCase() + name.slice(1) : "";
}

function HomePage() {
  const firstName = useFirstName();
  const { plan } = useCredits();
  const { data: kits } = useBrandKits();
  const needsBrandKit = !kits?.some((kit) => kit.isComplete);

  return (
    <AppShell
      title="Home"
      subtitle={`${greeting()}${firstName ? `, ${firstName}` : ""} — what are we making today?`}
    >
      <div className="mt-10 flex flex-col gap-10">
        {needsBrandKit ? <BrandKitBanner /> : null}
        <CreateSection />
        <RecentGenerations />
        {plan === "free" ? <UpgradePromo /> : null}
        <CommunitySection />
      </div>
    </AppShell>
  );
}

function BrandKitBanner() {
  return (
    <section className="flex flex-col gap-5 rounded-[18px] bg-v2-cream px-6 py-6 night:bg-v2-surface-2 sm:flex-row sm:items-center sm:justify-between sm:px-[38px] sm:py-7">
      <div className="flex max-w-[499px] flex-col gap-1">
        <h2 className="font-archivo text-xl font-medium leading-archivo tracking-[-0.8px] text-v2-ink sm:text-2xl sm:tracking-[-0.96px]">
          Need consistent results? Create a brand kit
        </h2>
        <p className="font-inter-tight text-sm leading-[1.41] text-v2-ink-60">
          Logo, colours, fonts and tone applied to every generation
        </p>
      </div>
      <PillLink
        to="/brand-kit"
        search={{ new: "1" }}
        variant="ghost-outline"
        className="self-start sm:self-auto"
      >
        Create Brand Kit
      </PillLink>
    </section>
  );
}

const CREATE_CARDS = [
  {
    to: "/photo-studio",
    title: "Photo Studio",
    description: "Product photoshoots from templates or your own scene.",
    image: createPhoto,
    videoSrc: "/v2/videos/loops/home-photo.mp4",
  },
  {
    to: "/ad-studio",
    title: "Ad Studio",
    description: "Static ad creatives from one product.",
    image: createAd,
    videoSrc: "/v2/videos/loops/home-ad.mp4",
  },
  {
    to: "/video-studio",
    title: "Video Studio",
    description: "UGC ads, product shorts and story ads.",
    image: createVideo,
    videoSrc: "/v2/videos/loops/home-video.mp4",
  },
] as const;

function CreateSection() {
  return (
    <section className="flex flex-col gap-[30px]">
      <SectionTitle>Create</SectionTitle>
      <div className="grid grid-cols-1 gap-[21px] sm:grid-cols-2 xl:grid-cols-3">
        {CREATE_CARDS.map((card) => (
          <Link
            key={card.to}
            to={card.to}
            className="group flex flex-col overflow-hidden rounded-[14px] border border-transparent bg-v2-surface pb-[17px] transition-[border-color,box-shadow] duration-200 hover:border-v2-border hover:shadow-[var(--v2-shadow-card)] focus-visible:border-v2-border focus-visible:outline-none"
          >
            <div className="aspect-video overflow-hidden rounded-[10px]">
              <LoopingPreview frames={[card.image]} videoSrc={card.videoSrc} />
            </div>
            <div className="mx-[18px] mt-[27px] flex flex-col gap-1">
              <h3 className="font-archivo text-lg font-medium leading-archivo tracking-[-0.36px] text-v2-ink">
                {card.title}
              </h3>
              <p className="font-inter-tight text-xs leading-[1.41] text-v2-muted group-hover:text-v2-ink-70">
                {card.description}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

const KIND_LABEL = { photo: "Photo", ad: "Ad", video: "Video" } as const;

/** Wireframe item 4: the user's latest work; hidden entirely until they've generated. */
function RecentGenerations() {
  const { data: recent = [] } = useRecentGenerations();
  if (!recent.length) return null;
  return (
    <section className="flex flex-col gap-[30px]">
      <div className="flex items-end justify-between gap-4">
        <SectionTitle>Recent generations</SectionTitle>
        <Link
          to="/assets"
          className="font-inter-tight text-sm text-v2-ink-70 underline-offset-4 hover:text-v2-ink hover:underline"
        >
          View all
        </Link>
      </div>
      <div className="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0">
        {recent.slice(0, 8).map((g) => {
          const content = (
            <>
              <img
                src={g.thumbnailUrl}
                alt=""
                loading="lazy"
                className="size-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
              />
              {g.kind === "video" ? (
                <span className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-[26px] bg-white px-[12.4px] py-[11.8px] shadow-sm">
                  <img src={playIcon} alt="" className="h-[12.4px] w-[11.2px]" />
                </span>
              ) : null}
              <span className="absolute left-2 top-2 rounded-full bg-white/90 px-2 py-0.5 font-inter-tight text-[10px] font-medium text-[#12213d]">
                {KIND_LABEL[g.kind]}
              </span>
              <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/60 to-transparent px-2.5 pb-2 pt-6 font-inter-tight text-xs text-white">
                {g.title}
              </span>
            </>
          );
          const className =
            "group relative aspect-[4/5] w-[150px] shrink-0 snap-start overflow-hidden rounded-[12px] bg-v2-surface sm:w-[170px]";
          return g.jobId ? (
            <Link
              key={g.id}
              to="/generations/$jobId"
              params={{ jobId: g.jobId }}
              className={className}
            >
              {content}
            </Link>
          ) : (
            <Link
              key={g.id}
              to="/assets"
              className={className}
              aria-label={`Open ${g.title} in Assets`}
            >
              {content}
            </Link>
          );
        })}
      </div>
    </section>
  );
}

const PRO_FEATURES = [
  "Premium Photo & Video Templates",
  "Concept & Story ads",
  "More Credits Every Month",
];

function UpgradePromo() {
  return (
    <section
      data-theme="light"
      className="v2-promo-fill relative flex flex-col overflow-hidden rounded-[18px] p-4 lg:h-[324px] lg:flex-row lg:items-center lg:justify-end lg:p-0 lg:pr-[21px]"
    >
      {/* Blurred, fanned previews of premium templates (Figma group 543:5005). */}
      <div
        aria-hidden
        className="relative mx-auto h-[270px] w-[345px] shrink-0 lg:absolute lg:left-[93px] lg:top-[28px] lg:mx-0"
      >
        {/* Positions are the unrotated boxes whose rotated bounds match Figma. */}
        <FannedCard src={promoBack} rotate={21.56} left={148.91} top={31.84} />
        <FannedCard src={promoMiddle} rotate={8.03} left={85.46} top={10.29} radius={13.99} />
        <FannedCard src={promoFront} rotate={-10} left={17.25} top={20.88} radius={12.243} crop />
        <span className="absolute left-[107px] top-[175px] flex w-[130px] items-center justify-center gap-2.5 rounded-[32px] bg-white p-2 drop-shadow-[-2px_4px_4.5px_rgba(0,0,0,0.1)]">
          <span className="flex size-5 items-center justify-center">
            <Icon name="lock" width={12.5} height={17.5} className="text-black" />
          </span>
          <span className="font-archivo text-base leading-[1.4] text-black/[0.76]">Unlock All</span>
        </span>
      </div>

      <div className="relative w-full rounded-[12px] bg-v2-surface px-6 py-6 lg:w-[459px] lg:pl-8 lg:pr-6">
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-[9px]">
              <h2 className="font-archivo text-[26px] font-medium leading-[1.12] tracking-[-1.04px] text-black sm:text-[30px] sm:tracking-[-1.2px] night:text-v2-ink">
                Unlock premium templates, Concept Ads and more credits
              </h2>
              <p className="font-inter-tight text-sm leading-[1.41] text-v2-muted">
                Everything in Free, plus the tools brands use to scale.
              </p>
            </div>
            <ul className="flex flex-col gap-[9px]">
              {PRO_FEATURES.map((feature) => (
                <li
                  key={feature}
                  className="flex items-center gap-2.5 font-inter-tight text-xs leading-[1.41] text-v2-muted"
                >
                  <CheckCircleIcon className="text-v2-icon" />
                  {feature}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex items-center gap-[18px]">
            <PillLink to="/upgrade">See Plans</PillLink>
            <PillLink to="/upgrade" hash="compare" variant="outline">
              Compare
            </PillLink>
          </div>
        </div>
      </div>
    </section>
  );
}

function FannedCard({
  src,
  rotate,
  left,
  top,
  radius = 12,
  crop = false,
}: {
  src: string;
  rotate: number;
  left: number;
  top: number;
  radius?: number;
  crop?: boolean;
}) {
  return (
    <div
      className="absolute h-[212.85px] w-[162.37px] overflow-hidden border-[2.19px] border-solid border-white blur-[2.15px]"
      style={{ left, top, borderRadius: radius, transform: `rotate(${rotate}deg)` }}
    >
      {crop ? (
        <img
          src={src}
          alt=""
          className="absolute left-[-11.56%] top-0 h-[100.31%] w-[123.37%] max-w-none"
        />
      ) : (
        <img src={src} alt="" className="size-full object-cover" />
      )}
    </div>
  );
}

const COMMUNITY_FILTERS: readonly { value: "all" | CreationKind; label: string }[] = [
  { value: "all", label: "All" },
  { value: "ugc", label: "UGC ads" },
  { value: "product-short", label: "Product Shorts" },
  { value: "photoshoot", label: "Photoshoots" },
  { value: "ad", label: "Ads" },
  { value: "concept", label: "Concept ads" },
];

function CommunitySection() {
  const [filter, setFilter] = useState<"all" | CreationKind>("all");
  const { data, isLoading } = useCommunityCreations();
  const items = useMemo(
    () => (data ?? []).filter((item) => filter === "all" || item.kind === filter),
    [data, filter],
  );

  return (
    <section className="flex flex-col gap-[30px]">
      <div className="flex flex-col gap-[18px]">
        <SectionTitle>See what others made with Replix</SectionTitle>
        <FilterTabs
          label="Filter community creations"
          options={COMMUNITY_FILTERS}
          value={filter}
          onChange={setFilter}
          className="self-start"
        />
      </div>
      <div className="rounded-[18px] bg-v2-surface p-3 sm:px-[27px] sm:py-7">
        {isLoading ? (
          <div className="grid grid-cols-2 gap-[19px] sm:grid-cols-3 lg:grid-cols-5">
            {Array.from({ length: 10 }, (_, i) => (
              <div
                key={i}
                className={cn(
                  "animate-pulse rounded-[12px] bg-v2-canvas",
                  i % 2 ? "h-[298px]" : "h-[231px]",
                )}
              />
            ))}
          </div>
        ) : items.length ? (
          <Masonry
            items={items}
            minColumnWidth={170}
            maxColumns={6}
            columnGap={19}
            rowGap={18}
            getKey={(item) => item.id}
            renderItem={(item) => <CommunityCard item={item} />}
          />
        ) : (
          <p className="py-16 text-center font-inter-tight text-sm text-v2-muted">
            Nothing here yet. Check back soon for new work from the community.
          </p>
        )}
      </div>
    </section>
  );
}

function CommunityCard({ item }: { item: CommunityCreation }) {
  return (
    <figure
      className="group relative overflow-hidden rounded-[12px]"
      style={{ aspectRatio: item.aspect }}
    >
      <img
        src={item.imageUrl}
        alt={item.title}
        loading="lazy"
        className="size-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
      />
      <figcaption className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 to-transparent p-3 font-inter-tight text-xs text-white opacity-0 transition-opacity duration-200 group-hover:opacity-100">
        {item.title}
      </figcaption>
    </figure>
  );
}
