import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { SUPPORT_EMAIL, useHelpFaqs } from "@/v2/data/api";
import type { HelpCategory } from "@/v2/data/types";
import { AppShell } from "@/v2/components/shell/AppShell";
import { Icon, type IconName } from "@/v2/components/Icon";
import { SectionTitle, pillClass } from "@/v2/components/primitives";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/help")({
  head: () => ({
    meta: [
      { title: "Help & Support · Replix AI" },
      {
        name: "description",
        content:
          "Answers to common questions about Replix AI: getting started, credits and billing, and using the studios.",
      },
    ],
  }),
  component: HelpPage,
});

/*
 * Figma's third card reads "Studies How - To"; it covers the studios. Cards say how many
 * answers they hold instead of a bare "Articles →", since there are no separate articles.
 */
const TOPICS: { key: HelpCategory; title: string; icon: IconName; iconSize: [number, number] }[] = [
  { key: "getting-started", title: "Getting Started", icon: "rocket", iconSize: [26, 26] },
  { key: "credits-billing", title: "Credits & Billing", icon: "wallet", iconSize: [28, 28] },
  { key: "studios", title: "Studio How-Tos", icon: "graduation", iconSize: [25.6, 21] },
];

function HelpPage() {
  const { data: faqs = [] } = useHelpFaqs();
  const [query, setQuery] = useState("");
  const [topic, setTopic] = useState<HelpCategory | null>(null);
  const [openId, setOpenId] = useState<string | null>("start");

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return faqs.filter(
      (f) =>
        (!topic || f.category === topic) &&
        (!q || `${f.question} ${f.answer}`.toLowerCase().includes(q)),
    );
  }, [faqs, query, topic]);

  return (
    <AppShell title="Help & Support">
      <label className="mt-6 flex h-[49px] w-full max-w-[454px] items-center gap-[11px] rounded-[50px] border border-[rgba(162,162,162,0.36)] bg-v2-surface px-[21px] lg:mt-[50px] night:border-v2-border">
        <Icon name="searchHelp" width={14} className="text-v2-ink-70" />
        <span className="sr-only">Search help</span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search help articles"
          className="min-w-0 flex-1 bg-transparent font-inter-tight text-[15px] leading-[1.41] text-v2-ink outline-none placeholder:text-v2-ink-70"
        />
      </label>

      <div className="mt-[30px] grid gap-[18px] sm:grid-cols-3">
        {TOPICS.map((t) => {
          const active = topic === t.key;
          const count = faqs.filter((f) => f.category === t.key).length;
          return (
            <button
              key={t.key}
              type="button"
              aria-pressed={active}
              onClick={() => setTopic(active ? null : t.key)}
              className={cn(
                "flex items-center gap-4 rounded-[18px] bg-v2-surface py-4 pl-4 pr-5 text-left sm:min-h-[186px] sm:flex-col sm:items-start sm:pb-10 sm:pl-5 sm:pr-[34px] sm:pt-5 drop-shadow-[0px_0px_22.1px_rgba(0,0,0,0.03)]",
                active ? "v2-highlight-stroke" : "border border-transparent hover:border-v2-line",
              )}
            >
              <span className="flex size-[52px] shrink-0 items-center justify-center rounded-[6px] bg-v2-nav-active">
                <Icon
                  name={t.icon}
                  width={t.iconSize[0]}
                  height={t.iconSize[1]}
                  className="text-v2-ink"
                />
              </span>
              <span className="flex flex-col gap-1.5 text-v2-ink sm:gap-4">
                <span className="font-archivo text-xl font-medium leading-archivo tracking-[-0.4px]">
                  {t.title}
                </span>
                <span
                  className={cn(
                    "font-inter-tight text-base leading-[1.22] tracking-[0.32px]",
                    !active && "opacity-60",
                  )}
                >
                  {count} {count === 1 ? "answer" : "answers"} →
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {/* Figma: "Faq". */}
      <SectionTitle className="mt-[60px]">FAQ</SectionTitle>

      <div className="mt-[30px] flex flex-col gap-9 lg:flex-row lg:items-start">
        <div className="flex min-w-0 flex-1 flex-col gap-5 lg:max-w-[748px]">
          {visible.length === 0 ? (
            <p className="rounded-[12px] bg-v2-surface p-6 font-inter-tight text-sm text-v2-muted">
              No answers match “{query}”. Try another word, or contact support.
            </p>
          ) : null}
          {visible.map((f) => {
            const open = openId === f.id;
            const panelId = `faq-${f.id}`;
            return (
              <div
                key={f.id}
                className={cn(
                  "bg-v2-surface",
                  open
                    ? "v2-highlight-stroke rounded-[18px] pb-[30px] pl-5 pr-[34px] pt-6 drop-shadow-[0px_0px_22.1px_rgba(0,0,0,0.03)]"
                    : "rounded-[12px] py-6 pl-6 pr-[26px]",
                )}
              >
                <button
                  type="button"
                  aria-expanded={open}
                  aria-controls={panelId}
                  onClick={() => setOpenId(open ? null : f.id)}
                  className="flex w-full items-start justify-between gap-6 text-left"
                >
                  <span className="pt-px type-label text-v2-ink">{f.question}</span>
                  <span className="flex size-[26px] shrink-0 items-center justify-center rounded-full bg-[#ffcc50] text-[#12213d]">
                    <Icon
                      name="faqChevron"
                      width={6}
                      height={11}
                      className={cn("transition-transform", open ? "-rotate-90" : "rotate-90")}
                    />
                  </span>
                </button>
                {open ? (
                  <p
                    id={panelId}
                    className="mt-3 max-w-[617px] type-subtitle text-[#5c6b8d] night:text-v2-muted"
                  >
                    {f.answer}
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>

        <aside className="flex flex-col items-start rounded-[18px] bg-v2-surface p-5 lg:min-h-[227px] lg:w-[258px] lg:shrink-0">
          {/* Figma: "Still Stuck ?". */}
          <h2 className="type-card-title text-v2-ink">Still stuck?</h2>
          <p className="mt-4 type-subtitle text-v2-ink-70">
            Our team usually replies within a day.
          </p>
          <a href={`mailto:${SUPPORT_EMAIL}`} className={pillClass("primary", "mt-8 lg:mt-auto")}>
            Contact Support
          </a>
        </aside>
      </div>
    </AppShell>
  );
}
