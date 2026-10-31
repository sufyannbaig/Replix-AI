import { Pencil, Plus, Trash2 } from "lucide-react";
import folderGray from "@/assets/redesign/folder-gray.svg";
import folderPink from "@/assets/redesign/folder-pink.svg";
import folderTeal from "@/assets/redesign/folder-teal.svg";
import folderYellow from "@/assets/redesign/folder-yellow.svg";
import type { CampaignColor } from "@/lib/campaigns";
import { cn } from "@/lib/utils";

const folderByColor: Record<CampaignColor, string> = {
  gray: folderGray,
  yellow: folderYellow,
  pink: folderPink,
  teal: folderTeal,
};

export function CampaignFolderCard({
  title,
  count,
  images,
  color = "gray",
  className,
  onEdit,
  onAdd,
  onDelete,
  onOpen,
}: {
  title: string;
  count: number;
  images: string[];
  color?: CampaignColor;
  className?: string;
  onEdit?: () => void;
  onAdd?: () => void;
  onDelete?: () => void;
  onOpen?: () => void;
}) {
  const front = images[0];
  const back = images[1] ?? front;

  return (
    <article
      className={cn("group relative aspect-[294/271] w-full", onOpen && "cursor-pointer", className)}
      {...(onOpen
        ? {
            role: "button" as const,
            tabIndex: 0,
            "aria-label": `Open ${title}`,
            onClick: onOpen,
            onKeyDown: (event: React.KeyboardEvent) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onOpen();
              }
            },
          }
        : {})}
    >
      <img src={folderByColor[color]} alt="" className="absolute inset-0 h-full w-full" />
      {back ? (
        <div className="absolute top-[48%] left-[49.7%] h-[31.4%] w-[45.2%] overflow-hidden rounded-xl">
          <img src={back} alt="" className="h-full w-full object-cover" />
        </div>
      ) : null}
      {front ? (
        <div className="absolute top-[28.4%] left-[14.6%] h-[56.8%] w-[69.7%] overflow-hidden rounded-xl">
          <img src={front} alt="" className="h-full w-full object-cover" />
        </div>
      ) : null}

      {onEdit || onAdd || onDelete ? (
        <div className="absolute top-[9%] right-[4%] z-10 flex gap-1.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          {onAdd ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onAdd();
              }}
              aria-label={`Add creatives to ${title}`}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-card text-navy shadow-soft transition-colors hover:bg-secondary"
            >
              <Plus className="h-4 w-4" />
            </button>
          ) : null}
          {onEdit ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              aria-label={`Edit ${title}`}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-card text-navy shadow-soft transition-colors hover:bg-secondary"
            >
              <Pencil className="h-4 w-4" />
            </button>
          ) : null}
          {onDelete ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              aria-label={`Delete ${title}`}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-card text-destructive shadow-soft transition-colors hover:bg-destructive/10"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="absolute top-[71.2%] flex h-[28.8%] w-full flex-col justify-center rounded-b-xl bg-card px-4">
        <p className="truncate text-sm font-semibold text-navy">{title}</p>
        <p className="text-xs text-muted-foreground">{count} Creatives</p>
      </div>
    </article>
  );
}
