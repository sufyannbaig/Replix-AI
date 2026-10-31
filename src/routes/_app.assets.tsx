import { createFileRoute, Link } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { AppShell } from "@/v2/components/shell/AppShell";
import { pillClass, SectionTitle } from "@/v2/components/primitives";
import { useAssets } from "@/v2/data/api";
import type { AssetItem, AssetKind } from "@/v2/data/types";
import playIcon from "@/assets/v2/icons/play.svg";

export const Route = createFileRoute("/_app/assets")({
  head: () => ({ meta: [{ title: "Assets · Replix AI" }] }),
  component: AssetsPage,
});

type Filter = "all" | AssetKind;

/* Figma writes "Style & Posses"; counts there are placeholders ("12" everywhere). */
const GROUPS: { title: string; items: { value: AssetKind; label: string }[] }[] = [
  {
    title: "Generations",
    items: [
      { value: "video", label: "Videos" },
      { value: "photo", label: "Photos" },
      { value: "ad", label: "Ads" },
    ],
  },
  {
    title: "My Uploads",
    items: [
      { value: "product", label: "Products" },
      { value: "character", label: "Characters" },
      { value: "scene", label: "Scenes" },
      { value: "style", label: "Styles & Poses" },
    ],
  },
];

function AssetsPage() {
  const { data: assets = [], isLoading } = useAssets();
  const [filter, setFilter] = useState<Filter>("all");
  const [order, setOrder] = useState<"newest" | "oldest">("newest");
  const [query, setQuery] = useState("");

  const counts = useMemo(() => {
    const map = new Map<AssetKind, number>();
    assets.forEach((a) => map.set(a.kind, (map.get(a.kind) ?? 0) + 1));
    return map;
  }, [assets]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = assets
      .filter((a) => filter === "all" || a.kind === filter)
      .filter((a) => !q || a.title.toLowerCase().includes(q));
    return order === "newest" ? list : [...list].reverse();
  }, [assets, filter, order, query]);

  const generations = visible.filter((a) => a.origin === "generation");
  const uploads = visible.filter((a) => a.origin === "upload");

  return (
    <AppShell title="Assets" subtitle="Everything you've generated and uploaded">
      <div className="mt-[33px] flex flex-col gap-9 lg:flex-row lg:items-start">
        <nav
          aria-label="Asset types"
          className="flex w-full shrink-0 flex-col rounded-[14px] bg-v2-surface px-[13px] pb-[18px] pt-[23px] lg:sticky lg:top-6 lg:w-[258px]"
        >
          <FilterRow label="All" active={filter === "all"} onClick={() => setFilter("all")} />
          {GROUPS.map((group, i) => (
            <div
              key={group.title}
              className={cn(
                "border-t-[0.5px] border-v2-line",
                i === 0 ? "mt-[19px] pt-5" : "mt-2 pt-[18px]",
              )}
            >
              <p className="px-[7px] pb-2 font-archivo text-base font-medium leading-archivo tracking-[-0.32px] text-v2-ink/80">
                {group.title}
              </p>
              {group.items.map((item) => (
                <FilterRow
                  key={item.value}
                  label={item.label}
                  count={counts.get(item.value) ?? 0}
                  active={filter === item.value}
                  onClick={() => setFilter(item.value)}
                />
              ))}
            </div>
          ))}
        </nav>

        <div className="flex min-w-0 flex-1 flex-col gap-10">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div
              role="tablist"
              aria-label="Sort"
              className="flex gap-[11px] rounded-[34px] bg-v2-surface px-4 py-2"
            >
              {(["newest", "oldest"] as const).map((o) => (
                <button
                  key={o}
                  type="button"
                  role="tab"
                  aria-selected={order === o}
                  onClick={() => setOrder(o)}
                  className={cn(
                    "flex h-7 items-center rounded-[50px] px-3 font-inter-tight text-sm font-medium capitalize tracking-[0.28px]",
                    order === o
                      ? "bg-[#1f55ae] text-white"
                      : "border-[0.7px] border-black/60 text-[#616161] opacity-45 hover:opacity-80 night:border-v2-border night:text-v2-ink-60",
                  )}
                >
                  {o}
                </button>
              ))}
            </div>
            <label className="flex h-[49px] w-full items-center gap-[19px] rounded-[50px] border border-[rgba(162,162,162,0.36)] bg-v2-surface px-[21px] sm:w-[273px]">
              <Search className="size-[14px] text-v2-ink-70" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search Assets"
                className="min-w-0 flex-1 bg-transparent font-inter-tight text-[15px] text-v2-ink outline-none placeholder:text-v2-ink-70"
              />
            </label>
          </div>

          {isLoading ? null : generations.length + uploads.length === 0 ? (
            <EmptyAssets hasAny={assets.length > 0} />
          ) : (
            <>
              {generations.length ? <AssetSection title="Generations" items={generations} /> : null}
              {uploads.length ? (
                <AssetSection title="Your Uploads" items={uploads} rounded />
              ) : null}
            </>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function FilterRow({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count?: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex w-full items-center justify-between rounded-[49px] px-[19px] py-3 font-archivo text-sm leading-archivo transition-colors",
        active ? "bg-[#315298] text-white" : "text-[#a9a9a9] hover:bg-v2-canvas hover:text-v2-ink",
      )}
    >
      {label}
      {count !== undefined ? <span className="tabular-nums">{count}</span> : null}
    </button>
  );
}

function AssetSection({
  title,
  items,
  rounded,
}: {
  title: string;
  items: AssetItem[];
  rounded?: boolean;
}) {
  return (
    <section className="flex flex-col gap-[17px]">
      <SectionTitle>{title}</SectionTitle>
      <div className="grid grid-cols-2 gap-x-[20px] gap-y-[30px] sm:grid-cols-3">
        {items.map((item) => (
          <figure
            key={item.id}
            className={cn(
              "group relative aspect-[235/237] overflow-hidden",
              rounded ? "rounded-[18px]" : "rounded-[12px]",
            )}
          >
            <img
              src={item.thumbnailUrl}
              alt={item.title}
              loading="lazy"
              className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
            />
            {item.kind === "video" ? (
              <span className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-[33px] bg-white px-[15.9px] py-[15.1px] shadow-sm">
                <img src={playIcon} alt="" className="h-[15.9px] w-[14.3px]" />
              </span>
            ) : null}
            <figcaption className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 to-transparent p-3 font-inter-tight text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">
              {item.title}
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

function EmptyAssets({ hasAny }: { hasAny: boolean }) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-[18px] bg-v2-surface px-6 py-16 text-center">
      <p className="font-archivo text-xl font-medium text-v2-ink">
        {hasAny ? "Nothing matches" : "Your library is empty"}
      </p>
      <p className="max-w-[380px] font-inter-tight text-sm text-v2-muted">
        {hasAny
          ? "Try another filter or search."
          : "Everything you generate or upload lands here, ready to download or reuse in another studio."}
      </p>
      {hasAny ? null : (
        <Link to="/photo-studio" className={pillClass("primary")}>
          Create your first shoot
        </Link>
      )}
    </div>
  );
}
