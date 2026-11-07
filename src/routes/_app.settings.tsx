import { createFileRoute, Link } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useCredits } from "@/hooks/use-credits";
import { PRICING_PLANS } from "@/lib/pricing-plans";
import { cn } from "@/lib/utils";
import { AppShell } from "@/v2/components/shell/AppShell";
import { PillButton, pillClass } from "@/v2/components/primitives";
import { useThemePreference, type ThemePreference } from "@/v2/theme";
import defaultAvatar from "@/assets/v2/home/avatar.png";

type SettingsTab = "profile" | "billing" | "credits" | "security" | "appearance";

export const Route = createFileRoute("/_app/settings")({
  validateSearch: (search: Record<string, unknown>): { tab?: SettingsTab } => {
    const tab = search.tab;
    return tab === "billing" || tab === "credits" || tab === "security" || tab === "appearance"
      ? { tab }
      : {};
  },
  head: () => ({ meta: [{ title: "Settings · Replix AI" }] }),
  component: SettingsPage,
});

const TABS: { value: SettingsTab; label: string }[] = [
  { value: "profile", label: "Profile" },
  { value: "billing", label: "Billing" },
  { value: "credits", label: "Credits" },
  { value: "security", label: "Security" },
  /* Not in Figma; the wireframe asks for Light / Dark / System and dev owns dark mode. */
  { value: "appearance", label: "Appearance" },
];

const label =
  "font-archivo text-base leading-[1.38] tracking-[0.16px] text-[#0b0f19] night:text-v2-ink";
const field =
  "h-11 w-full rounded-[250px] border border-[rgba(11,15,25,0.3)] bg-transparent px-4 font-inter-tight text-sm tracking-[0.14px] text-v2-ink outline-none placeholder:text-[rgba(22,37,68,0.6)] focus:border-v2-blue disabled:opacity-70 night:border-v2-border night:placeholder:text-v2-ink-60";

function SettingsPage() {
  const { tab = "profile" } = Route.useSearch();
  const navigate = Route.useNavigate();

  return (
    <AppShell title="Settings" subtitle="Manage your profile, plan and preferences">
      <div
        role="tablist"
        aria-label="Settings sections"
        className="mt-[30px] flex flex-wrap gap-[18px]"
      >
        {TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            role="tab"
            aria-selected={t.value === tab}
            onClick={() => navigate({ search: t.value === "profile" ? {} : { tab: t.value } })}
            className={cn(
              "font-inter-tight text-sm font-medium leading-[27px] tracking-[0.28px] text-v2-ink underline underline-offset-4",
              t.value === tab ? "opacity-100" : "opacity-40 hover:opacity-70",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      <section className="mt-10 rounded-[18px] bg-v2-surface px-[21px] py-[27px] shadow-[0_0_44.2px_rgba(0,0,0,0.03)] lg:w-[720px]">
        {tab === "profile" ? <ProfileTab /> : null}
        {tab === "billing" ? <BillingTab /> : null}
        {tab === "credits" ? <CreditsTab /> : null}
        {tab === "security" ? <SecurityTab /> : null}
        {tab === "appearance" ? <AppearanceTab /> : null}
      </section>
    </AppShell>
  );
}

function ProfileTab() {
  const { user } = useAuth();
  const meta = user?.user_metadata ?? {};
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setName(((meta.full_name ?? meta.name) as string | undefined) ?? "");
    setCompany((meta.company as string | undefined) ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const save = async () => {
    setSaving(true);
    // Profile fields live in the auth user's metadata; avatar upload needs storage (backend TODO).
    const { error } = await supabase.auth.updateUser({
      data: { full_name: name.trim(), company: company.trim() },
    });
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Profile saved");
  };

  return (
    <div className="flex flex-col gap-[22px]">
      <div className="flex items-end gap-[18px]">
        <img
          src={avatar ?? (meta.avatar_url as string | undefined) ?? defaultAvatar}
          alt=""
          className="size-[91px] rounded-[9px] object-cover"
        />
        <PillButton
          variant="outline"
          className="px-4 py-2 text-sm opacity-60 hover:opacity-100"
          onClick={() => fileInput.current?.click()}
        >
          Change Photo
        </PillButton>
        <input
          ref={fileInput}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) setAvatar(URL.createObjectURL(file));
          }}
        />
      </div>
      <div className="grid gap-[22px] sm:grid-cols-2">
        <label className="flex flex-col gap-2">
          <span className={label}>Full Name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            className={field}
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className={label}>Email</span>
          <input value={user?.email ?? ""} disabled readOnly className={field} />
        </label>
      </div>
      <label className="flex flex-col gap-2">
        <span className={label}>Company</span>
        <input
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          placeholder="Acme Co."
          className={field}
        />
      </label>
      <div className="flex justify-end">
        <PillButton onClick={save} disabled={saving || !user}>
          {saving ? <Loader2 className="size-4 animate-spin" /> : null}
          Save
        </PillButton>
      </div>
    </div>
  );
}

function BillingTab() {
  const { plan } = useCredits();
  const info = PRICING_PLANS.find((p) => p.key === plan) ?? PRICING_PLANS[0];
  return (
    <div className="flex flex-col gap-4">
      <p className={label}>Current plan</p>
      <p className="font-archivo text-2xl font-medium text-v2-ink">{info.name}</p>
      <p className="font-inter-tight text-sm text-v2-muted">{info.desc}</p>
      <div className="flex flex-wrap gap-3">
        <Link to="/upgrade" className={pillClass("primary")}>
          Change plan
        </Link>
        {/* Invoices and payment method stay on the existing billing page until v2 billing ships. */}
        <Link to="/billing" className={pillClass("outline")}>
          Invoices & payment method
        </Link>
      </div>
    </div>
  );
}

function CreditsTab() {
  const { credits, plan } = useCredits();
  const info = PRICING_PLANS.find((p) => p.key === plan) ?? PRICING_PLANS[0];
  const remaining = Math.max(0, credits);
  return (
    <div className="flex flex-col gap-4">
      <p className={label}>Credits</p>
      <p className="font-archivo text-[32px] font-medium tabular-nums text-v2-ink">
        {remaining} <span className="text-base text-v2-muted">/ {info.ads}</span>
      </p>
      <div className="h-[7px] overflow-hidden rounded-full bg-[#f5f5f5] night:bg-v2-canvas">
        <div
          className="h-full rounded-full bg-[#374c74] night:bg-v2-blue"
          style={{ width: `${Math.min(100, (remaining / Math.max(1, info.ads)) * 100)}%` }}
        />
      </div>
      <p className="font-inter-tight text-sm text-v2-muted">
        {plan === "free"
          ? "Free credits are a one-time grant."
          : "Credits reset on the 1st of each month."}
      </p>
      <Link to="/upgrade" className={pillClass("outline", "self-start")}>
        Get more credits
      </Link>
    </div>
  );
}

function SecurityTab() {
  return (
    <div className="flex flex-col gap-4">
      <p className={label}>Password</p>
      <p className="font-inter-tight text-sm text-v2-muted">
        We'll email you a secure link to set a new password. Accounts that sign in with Google
        manage their password there.
      </p>
      <Link to="/forgot-password" className={pillClass("outline", "self-start")}>
        Reset password
      </Link>
    </div>
  );
}

function AppearanceTab() {
  const { preference, setPreference } = useThemePreference();
  const options: { value: ThemePreference; label: string; hint: string }[] = [
    { value: "light", label: "Light", hint: "The default look" },
    { value: "dark", label: "Dark", hint: "Easier on the eyes at night" },
    { value: "system", label: "System", hint: "Follow your device setting" },
  ];
  return (
    <div role="radiogroup" aria-label="Appearance" className="grid gap-3 sm:grid-cols-3">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={preference === o.value}
          onClick={() => setPreference(o.value)}
          className={cn(
            "flex flex-col gap-1 rounded-[14px] border p-4 text-left transition-colors",
            preference === o.value
              ? "border-v2-blue bg-v2-nav-active"
              : "border-v2-border hover:bg-v2-canvas",
          )}
        >
          <span className="font-archivo text-base font-medium text-v2-ink">{o.label}</span>
          <span className="font-inter-tight text-xs text-v2-muted">{o.hint}</span>
        </button>
      ))}
    </div>
  );
}
