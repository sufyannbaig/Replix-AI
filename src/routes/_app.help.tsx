import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  BadgeCheck,
  Image as ImageIcon,
  Mail,
  Receipt,
  Rocket,
  Search,
  ShoppingBag,
  User,
  type LucideIcon,
} from "lucide-react";
import { FAQS, type Faq } from "@/lib/faqs";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Category = "All" | Faq["category"];

const CATEGORIES: { key: Category; icon: LucideIcon }[] = [
  { key: "All", icon: BadgeCheck },
  { key: "Getting started", icon: Rocket },
  { key: "Generation", icon: ImageIcon },
  { key: "Exports", icon: ShoppingBag },
  { key: "Billing", icon: Receipt },
  { key: "Account", icon: User },
];

export const Route = createFileRoute("/_app/help")({
  head: () => ({
    meta: [
      { title: "Help & FAQ — Replix AI" },
      {
        name: "description",
        content:
          "Answers to common questions about Replix AI: generating ads, connecting Shopify, credits, billing, and exporting.",
      },
    ],
  }),
  component: HelpPage,
});

function HelpPage() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<Category>("All");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return FAQS.filter((f) => {
      if (category !== "All" && f.category !== category) return false;
      if (!q) return true;
      return `${f.q} ${f.a}`.toLowerCase().includes(q);
    });
  }, [query, category]);

  return (
    <AppShell
      title="How can we help?"
      subtitle="Answers to the most common questions about generating ads, billing, and your account."
    >
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search articles..."
              className="h-14 rounded-full bg-card pl-12"
            />
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {CATEGORIES.map(({ key, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setCategory(key)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-medium transition-colors",
                  category === key
                    ? "border-navy bg-navy text-navy-foreground"
                    : "border-border bg-card text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="size-4" />
                {key}
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <p className="mt-6 rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
              No articles match "{query}". Try a different search or browse all categories.
            </p>
          ) : (
            <Accordion
              type="single"
              collapsible
              defaultValue={FAQS[0]?.q}
              className="mt-6 space-y-4"
            >
              {filtered.map((f) => (
                <AccordionItem
                  key={`${f.category}-${f.q}`}
                  value={f.q}
                  className="rounded-2xl border border-border bg-card px-6"
                >
                  <AccordionTrigger className="text-left font-semibold text-navy">
                    {f.q}
                  </AccordionTrigger>
                  <AccordionContent className="leading-6 text-muted-foreground">
                    {f.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </div>

        <aside className="h-fit rounded-2xl bg-navy p-8 text-navy-foreground lg:sticky lg:top-8">
          <h2 className="font-display text-2xl font-bold">Still need help?</h2>
          <p className="mt-3 text-sm leading-6 text-navy-foreground/75">
            Email our support team and we'll get back to you within one business day.
          </p>
          <Button
            className="mt-6 w-full rounded-full bg-card text-navy hover:bg-card/90"
            onClick={() => {
              window.location.href = "mailto:benjamin@replixai.co.uk";
            }}
          >
            <Mail /> Email Us
          </Button>
          <p className="mt-4 text-center text-xs text-navy-foreground/60">
            benjamin@replixai.co.uk
          </p>
        </aside>
      </div>
    </AppShell>
  );
}
