import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Column masonry that deals items round-robin, so a row-ordered list reads left to right
 * like the Figma grids. Column count follows the container width.
 */
export function Masonry<T>({
  items,
  minColumnWidth,
  maxColumns,
  columnGap,
  rowGap,
  getKey,
  renderItem,
  className,
}: {
  items: T[];
  minColumnWidth: number;
  maxColumns: number;
  columnGap: number;
  rowGap: number;
  getKey: (item: T) => string;
  renderItem: (item: T) => ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [columns, setColumns] = useState(maxColumns);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const fit = Math.floor((el.clientWidth + columnGap) / (minColumnWidth + columnGap));
      setColumns(Math.max(2, Math.min(maxColumns, fit)));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [columnGap, minColumnWidth, maxColumns]);

  const buckets: T[][] = Array.from({ length: columns }, () => []);
  items.forEach((item, i) => buckets[i % columns].push(item));

  return (
    <div ref={ref} className={cn("flex items-start", className)} style={{ gap: columnGap }}>
      {buckets.map((bucket, i) => (
        <div key={i} className="flex min-w-0 flex-1 flex-col" style={{ gap: rowGap }}>
          {bucket.map((item) => (
            <div key={getKey(item)}>{renderItem(item)}</div>
          ))}
        </div>
      ))}
    </div>
  );
}
