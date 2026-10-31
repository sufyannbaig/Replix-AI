import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, ArrowRight, Send, Sparkles, X } from "lucide-react";
import { salesChat } from "@/lib/api/sales-chat.functions";
import { CHAT_INTRO, QUICK_ACTIONS } from "@/lib/sales-chat.knowledge";
import { cn } from "@/lib/utils";

type Msg = { role: "user" | "assistant"; content: string };

const TEASER_TEXT = "Not sure if Replix AI is right for your store? \uD83D\uDC4B";
const TEASER_DISMISSED_KEY = "replix_chat_teaser_dismissed";
const TEASER_DELAY_MS = 12_000;

/** Fire an analytics event without assuming any specific provider is installed. */
function track(event: string, params: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  const w = window as unknown as {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  };
  try {
    w.gtag?.("event", event, params);
    w.dataLayer?.push({ event, ...params });
    window.dispatchEvent(new CustomEvent("replix:analytics", { detail: { event, ...params } }));
  } catch {
    /* analytics must never break the page */
  }
}

export function SalesChatWidget({ ctaTo = "/login" }: { ctaTo?: string }) {
  const [open, setOpen] = useState(false);
  const [teaser, setTeaser] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const startedRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const bubbleRef = useRef<HTMLButtonElement>(null);
  const ask = useServerFn(salesChat);

  // Teaser after a delay, once per session
  useEffect(() => {
    if (sessionStorage.getItem(TEASER_DISMISSED_KEY) === "1") return;
    const t = setTimeout(() => setTeaser(true), TEASER_DELAY_MS);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        track("chatbot_closed", { method: "escape" });
        bubbleRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const dismissTeaser = useCallback(() => {
    setTeaser(false);
    try {
      sessionStorage.setItem(TEASER_DISMISSED_KEY, "1");
    } catch {
      /* ignore */
    }
  }, []);

  const send = useCallback(
    async (text: string, source: "input" | "quick_action") => {
      const content = text.trim();
      if (!content || sending) return;
      if (!startedRef.current) {
        startedRef.current = true;
        track("chat_session_started");
      }
      if (source === "quick_action") track("chatbot_quick_question_clicked", { question: content });
      setError(null);
      const next: Msg[] = [...messages, { role: "user", content }];
      setMessages(next);
      setInput("");
      setSending(true);
      try {
        const res = await ask({ data: { messages: next.slice(-12) } });
        setMessages([...next, { role: "assistant", content: res.reply }]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      } finally {
        setSending(false);
      }
    },
    [ask, messages, sending],
  );

  const openChat = () => {
    setOpen(true);
    dismissTeaser();
    track("chatbot_opened");
    setTimeout(() => inputRef.current?.focus(), 250);
  };

  const closeChat = () => {
    setOpen(false);
    track("chatbot_closed", { method: "button" });
    bubbleRef.current?.focus();
  };

  const resetChat = () => {
    setMessages([]);
    setError(null);
    setInput("");
    track("chatbot_new_question");
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[70] flex justify-end p-4 sm:p-6">
      <div className="pointer-events-auto flex w-full max-w-[400px] flex-col items-end gap-3">
        {open && (
          <section
            role="dialog"
            aria-modal="false"
            aria-label="Replix AI assistant"
            className="flex h-[min(72vh,580px)] w-full animate-in flex-col overflow-hidden rounded-2xl border border-signal/25 bg-ink/95 text-ink-foreground shadow-2xl backdrop-blur-xl duration-300 fade-in slide-in-from-bottom-4"
          >
            {/* Header */}
            <header className="flex items-center gap-3 border-b border-ink-foreground/10 bg-ink/80 px-4 py-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-signal/15 text-signal ring-1 ring-signal/30">
                <Sparkles className="size-4" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="font-display text-sm font-bold leading-tight">Replix AI Assistant</p>
                <p className="text-[11px] leading-tight text-ink-foreground/60">
                  Answers about ads, plans & setup
                </p>
              </div>
              <button
                type="button"
                onClick={closeChat}
                aria-label="Close Replix AI assistant"
                className="ml-auto grid size-9 place-items-center rounded-lg text-ink-foreground/70 transition hover:bg-ink-foreground/10 hover:text-ink-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </header>

            {/* Transcript */}
            <div
              ref={scrollRef}
              className="flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-4"
              aria-live="polite"
            >
              <p className="whitespace-pre-line text-sm leading-relaxed text-ink-foreground/90">
                {CHAT_INTRO}
              </p>

              {messages.length === 0 && (
                <div className="grid gap-2">
                  {QUICK_ACTIONS.map((q) => (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => void send(q.label, "quick_action")}
                      className="rounded-xl border border-ink-foreground/15 bg-ink-foreground/[0.06] px-3.5 py-2.5 text-left text-[13px] font-medium text-ink-foreground transition hover:border-signal/50 hover:bg-signal/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
                    >
                      {q.label}
                    </button>
                  ))}
                </div>
              )}

              {messages.map((m, i) => (
                <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                  <div
                    className={cn(
                      "max-w-[85%] whitespace-pre-line rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                      m.role === "user"
                        ? "bg-signal text-signal-foreground"
                        : "bg-ink-foreground/[0.07] text-ink-foreground",
                    )}
                  >
                    {m.content}
                  </div>
                </div>
              ))}

              {sending && (
                <p className="text-xs text-ink-foreground/60" role="status">
                  Thinking…
                </p>
              )}
              {error && <p className="text-xs text-destructive">{error}</p>}

              {messages.length > 0 && !sending && (
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={resetChat}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-ink-foreground/20 bg-ink-foreground/[0.06] px-4 py-2.5 text-[13px] font-medium text-ink-foreground transition hover:border-signal/50 hover:bg-signal/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
                  >
                    <ArrowLeft className="size-3.5" aria-hidden="true" />
                    Ask another question
                  </button>
                  <Link
                    to={ctaTo}
                    onClick={() => track("chatbot_cta_clicked", { destination: ctaTo })}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-signal px-4 py-2.5 text-sm font-semibold text-signal-foreground transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-2 focus-visible:ring-offset-ink"
                  >
                    Start Creating Ads <ArrowRight className="size-4" aria-hidden="true" />
                  </Link>
                </div>
              )}
            </div>

            {/* Composer */}
            <form
              className="flex items-center gap-2 border-t border-ink-foreground/10 px-3 py-3"
              onSubmit={(e) => {
                e.preventDefault();
                void send(input, "input");
              }}
            >
              <label htmlFor="replix-chat-input" className="sr-only">
                Ask the Replix AI assistant a question
              </label>
              <input
                id="replix-chat-input"
                ref={inputRef}
                value={input}
                maxLength={500}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask anything about Replix AI…"
                className="min-w-0 flex-1 rounded-xl border border-ink-foreground/15 bg-ink-foreground/[0.06] px-3.5 py-2.5 text-sm text-ink-foreground placeholder:text-ink-foreground/45 focus:outline-none focus:ring-2 focus:ring-signal"
              />
              <button
                type="submit"
                disabled={sending || !input.trim()}
                aria-label="Send message"
                className="grid size-10 shrink-0 place-items-center rounded-xl bg-signal text-signal-foreground transition hover:brightness-105 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-2 focus-visible:ring-offset-ink"
              >
                <Send className="size-4" aria-hidden="true" />
              </button>
            </form>
          </section>
        )}

        {/* Teaser */}
        {!open && teaser && (
          <div className="flex max-w-[280px] animate-in items-start gap-2 rounded-2xl border border-signal/25 bg-ink/95 px-3.5 py-2.5 text-[13px] text-ink-foreground shadow-xl backdrop-blur-xl duration-500 fade-in slide-in-from-bottom-2">
            <button
              type="button"
              onClick={openChat}
              className="text-left leading-snug focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
            >
              {TEASER_TEXT}
            </button>
            <button
              type="button"
              onClick={dismissTeaser}
              aria-label="Dismiss assistant message"
              className="-mr-1 -mt-1 grid size-6 shrink-0 place-items-center rounded-md text-ink-foreground/60 transition hover:bg-ink-foreground/10 hover:text-ink-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
            >
              <X className="size-3.5" aria-hidden="true" />
            </button>
          </div>
        )}

        {/* Bubble */}
        {!open && (
          <button
            ref={bubbleRef}
            type="button"
            onClick={openChat}
            aria-label="Open Replix AI assistant"
            aria-expanded={open}
            className="relative grid size-[54px] place-items-center rounded-full border border-signal/30 bg-ink text-signal shadow-xl transition hover:scale-[1.04] active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-2 sm:size-[60px]"
          >
            <span
              aria-hidden="true"
              className="absolute inset-0 rounded-full bg-signal/25 motion-safe:animate-ping [animation-duration:3.5s]"
            />
            <Sparkles className="relative size-6" aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
}
