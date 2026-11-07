import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Upload } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { AppShell } from "@/v2/components/shell/AppShell";
import { useAddLibraryUpload, usePieceOptions } from "@/v2/data/api";
import type { PieceKind } from "@/v2/data/types";
import artBack from "@/assets/v2/catalog/scene/marble-kitchen.webp";
import artMiddle from "@/assets/v2/catalog/character/sara.webp";
import artFront from "@/assets/v2/catalog/character/robert.webp";

type LibraryTab = "characters" | "scenes" | "styles";

export const Route = createFileRoute("/_app/library")({
  validateSearch: (search: Record<string, unknown>): { tab?: LibraryTab } => {
    const tab = search.tab;
    return tab === "characters" || tab === "scenes" || tab === "styles" ? { tab } : {};
  },
  head: () => ({ meta: [{ title: "Library · Replix AI" }] }),
  component: LibraryPage,
});

const TABS: { value: LibraryTab; label: string; singular: string; kind: PieceKind }[] = [
  { value: "characters", label: "Characters", singular: "Character", kind: "character" },
  { value: "scenes", label: "Scenes", singular: "Scene", kind: "scene" },
  { value: "styles", label: "Styles & Poses", singular: "Style or Pose", kind: "style" },
];

type Owner = "all" | "replix" | "yours";

function LibraryPage() {
  const { tab = "characters" } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const current = TABS.find((t) => t.value === tab) ?? TABS[0];
  const { data: pieces = [] } = usePieceOptions(current.kind);
  const upload = useAddLibraryUpload();
  const [owner, setOwner] = useState<Owner>("all");

  const items = useMemo(
    () =>
      pieces.filter(
        (p) => owner === "all" || (owner === "yours" ? p.owner === "yours" : p.owner !== "yours"),
      ),
    [pieces, owner],
  );

  const addUpload = (file: File) =>
    upload.mutate(
      { file, kind: current.kind },
      {
        onSuccess: () => toast.success(`${current.singular} added to your library`),
        onError: () => toast.error("Upload failed. Please try again."),
      },
    );

  return (
    <AppShell
      title="Library"
      subtitle="Characters, scenes and styles you can reuse in every studio"
    >
      <div className="mt-[26px] flex flex-col gap-[19px]">
        <div role="tablist" aria-label="Library sections" className="flex gap-[18px]">
          {TABS.map((t) => (
            <button
              key={t.value}
              type="button"
              role="tab"
              aria-selected={t.value === tab}
              onClick={() => navigate({ search: { tab: t.value } })}
              className={cn(
                "font-inter-tight text-sm font-medium leading-[27px] tracking-[0.28px] text-v2-ink underline underline-offset-4",
                t.value === tab ? "opacity-100" : "opacity-40 hover:opacity-70",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div
          role="radiogroup"
          aria-label="Made by"
          className="flex gap-[11px] self-start rounded-[34px] bg-v2-surface px-4 py-2"
        >
          {(
            [
              { value: "all", label: "All" },
              { value: "replix", label: "Replix Made" },
              { value: "yours", label: "Yours" },
            ] as const
          ).map((o) => (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={owner === o.value}
              onClick={() => setOwner(o.value)}
              className={cn(
                "flex h-7 items-center rounded-[50px] px-3 font-inter-tight text-sm font-medium tracking-[0.28px]",
                owner === o.value
                  ? "bg-v2-active text-white"
                  : "border-[0.7px] border-black/60 text-[#616161] opacity-45 hover:opacity-80 night:border-v2-border night:text-v2-ink-60",
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-[42px] grid grid-cols-2 gap-x-5 gap-y-8 md:grid-cols-3 xl:grid-cols-4">
        <AddTile
          label={`Add Custom ${current.singular}`}
          hint={`${current.singular} images`}
          onFile={addUpload}
        />
        {items.map((item) => (
          <article
            key={item.id}
            className="flex flex-col overflow-hidden rounded-[12px] bg-v2-surface"
          >
            <div className="group relative aspect-[245/227] w-full overflow-hidden rounded-[12px]">
              <img
                src={item.imageUrl}
                alt=""
                loading="lazy"
                className="size-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
              />
              <Link
                to="/photo-studio"
                search={{ mode: "piece", use: item.id }}
                className="absolute inset-x-3 bottom-3 flex h-9 items-center justify-center rounded-full bg-white/95 font-archivo text-sm text-[#12213d] shadow-sm transition-opacity hover:bg-white focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
              >
                Use in Photo Studio
              </Link>
            </div>
            <div className="flex items-center justify-between gap-2 px-[14px] py-[13px]">
              <p className="truncate font-archivo text-sm font-medium leading-archivo text-black night:text-v2-ink">
                {item.name}
              </p>
              <span
                className={cn(
                  "h-7 shrink-0 items-center rounded-[50px] border-[0.7px] bg-white px-3 font-inter-tight text-xs font-medium tracking-[0.24px] night:bg-transparent",
                  item.owner === "yours"
                    ? "flex border-[#55932c] text-[#55932c]"
                    : "hidden border-[#12213d] text-[#12213d] night:border-v2-ink night:text-v2-ink sm:flex",
                )}
              >
                {item.owner === "yours" ? "Yours" : "Replix Made"}
              </span>
            </div>
          </article>
        ))}
      </div>
      {items.length === 0 ? (
        <p className="mt-6 font-inter-tight text-sm text-v2-muted">
          {owner === "yours"
            ? `You haven't added any ${current.label.toLowerCase()} yet.`
            : `No ${current.label.toLowerCase()} here yet. Upload your own to reuse them in every studio.`}
        </p>
      ) : null}
    </AppShell>
  );
}

function AddTile({
  label,
  hint,
  onFile,
}: {
  label: string;
  hint: string;
  onFile: (file: File) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="flex min-h-[281px] flex-col items-center justify-center gap-2.5 rounded-[12px] border border-dashed border-[rgba(2,2,2,0.27)] bg-v2-surface px-4 night:border-v2-border">
      <span aria-hidden className="relative block h-[82px] w-[130px]">
        <img
          src={artBack}
          alt=""
          className="absolute left-[65.7px] top-[9.5px] h-[72.6px] w-[59.5px] rotate-[7.6deg] rounded-[5px] object-cover"
        />
        <img
          src={artMiddle}
          alt=""
          className="absolute left-[34.7px] top-[5.2px] h-[73.2px] w-[59.5px] rounded-[12px] object-cover"
        />
        <img
          src={artFront}
          alt=""
          className="absolute left-[5.3px] top-[4.6px] h-[72.5px] w-[59.5px] -rotate-[9.79deg] rounded-[12px] border-2 border-white object-cover"
        />
      </span>
      <span className="flex flex-col items-center gap-1.5 text-center">
        <span className="font-archivo text-lg font-medium leading-archivo tracking-[-0.36px] text-v2-ink">
          {label}
        </span>
        <span className="font-inter-tight text-sm text-v2-muted">{hint}</span>
      </span>
      <button
        type="button"
        onClick={() => input.current?.click()}
        className="flex items-center gap-1.5 rounded-[35px] border-[0.6px] border-[#a2a2a2] bg-v2-surface px-[14px] py-[7px] font-archivo text-[10.6px] leading-[1.4] text-black hover:bg-v2-canvas night:text-v2-ink"
      >
        <Upload className="size-3" />
        Upload Image
      </button>
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) onFile(file);
        }}
      />
    </div>
  );
}
