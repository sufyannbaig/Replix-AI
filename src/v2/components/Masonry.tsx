import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Column masonry. Items are dealt round-robin so a row-ordered list reads left to right,
 * or, with `getHeight`, each goes to the shortest column so the columns end level.
 * Column count follows the container width.
 */
export function Masonry<T>({
  items,
  minColumnWidth,
  maxColumns,
  columnGap,
  rowGap,
  getKey,
  getHeight,
  renderItem,
  className,
}: {
  items: T[];
  minColumnWidth: number;
  maxColumns: number;
  columnGap: number;
  rowGap: number;
  getKey: (item: T) => string;
  /** Item height relative to its width. */
  getHeight?: (item: T) => number;
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
  const heights = buckets.map(() => 0);
  items.forEach((item, i) => {
    const target = getHeight ? heights.indexOf(Math.min(...heights)) : i % columns;
    buckets[target].push(item);
    if (getHeight) heights[target] += getHeight(item);
  });
  /* Even out the column ends: move a card from the tallest column to the shortest. */
  for (let pass = 0; getHeight && pass < 12; pass++) {
    const tall = heights.indexOf(Math.max(...heights));
    const short = heights.indexOf(Math.min(...heights));
    const gap = heights[tall] - heights[short];
    const index = buckets[tall].map((item) => getHeight(item) < gap).lastIndexOf(true);
    if (index < 0) break;
    const [moved] = buckets[tall].splice(index, 1);
    buckets[short].push(moved);
    heights[tall] -= getHeight(moved);
    heights[short] += getHeight(moved);
  }

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
