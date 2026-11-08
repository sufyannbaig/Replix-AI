import { Link } from "@tanstack/react-router";
import { ArrowLeft, Loader2 } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";
import logoMark from "@/assets/v2/logo-mark.png";
import logoWordmark from "@/assets/v2/logo-wordmark.svg";
import heroImage from "@/assets/v2/auth/hero.jpg";

/**
 * Split layout of the 2.0 login (Figma 543:168449): form column on the left (643px at
 * 1440), product hero on the right from `lg` up. Shared by login, forgot and reset password.
 */
export function AuthLayout({
  heading,
  subtitle,
  children,
}: {
  /** Two lines of the big uppercase heading. */
  heading: [string, string];
  subtitle: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-v2-surface font-inter-tight text-v2-ink">
      <div className="relative z-10 flex w-full flex-col px-6 pb-12 pt-10 shadow-[5px_0px_27.1px_0px_rgba(0,0,0,0.03)] sm:px-[51px] sm:pt-16 lg:w-[44.65%] lg:shrink-0">
        <Link
          to="/"
          aria-label="Replix AI home"
          className="flex h-[37px] items-center gap-[6.1px] self-start"
        >
          <img src={logoMark} alt="" className="size-[37px] rounded-[5.5px] object-cover" />
          <span
            aria-hidden
            className="v2-icon mt-[4.9px] h-[31.8px] w-[139.3px] self-start text-[#162544] night:text-v2-ink"
            style={{
              maskImage: `url("${logoWordmark}")`,
              WebkitMaskImage: `url("${logoWordmark}")`,
            }}
          />
        </Link>

        <div className="mt-14 w-full max-w-[418px] sm:mt-[61px]">
          <h1 className="font-archivo text-[44px] font-semibold uppercase leading-[1.14] tracking-[-2.2px] text-[#162544] sm:-mb-[15px] sm:text-[61px] sm:tracking-[-3.05px] night:text-v2-ink">
            {heading[0]}
            <br />
            {heading[1]}
          </h1>
          <p className="-mb-[5px] mt-6 font-inter-tight text-lg leading-[1.38] tracking-[0.18px] text-v2-ink-60">
            {subtitle}
          </p>
          {children}
        </div>
      </div>

      <div className="relative hidden min-h-screen flex-1 overflow-hidden lg:block">
        <img
          src={heroImage}
          alt="A Replix product shot: a phone photo of a drink can turned into a studio ad"
          className="absolute inset-0 size-full object-cover object-[20%_center]"
        />
      </div>
    </div>
  );
}

export const authInputClass =
  "h-[52px] w-full rounded-[250px] border border-[rgba(11,15,25,0.3)] bg-transparent px-4 font-inter-tight text-sm tracking-[0.14px] text-v2-ink outline-none transition-colors placeholder:text-v2-ink-60 focus:border-v2-blue night:border-v2-border";

export function AuthField({
  label,
  htmlFor,
  aside,
  children,
}: {
  label: string;
  htmlFor: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-4">
        <label
          htmlFor={htmlFor}
          className="font-archivo text-lg leading-[1.38] tracking-[0.18px] text-[#0b0f19] night:text-v2-ink"
        >
          {label}
        </label>
        {aside}
      </div>
      {children}
    </div>
  );
}

/** Error or confirmation line under the fields. */
export function AuthMessage({ tone, children }: { tone: "error" | "info"; children: ReactNode }) {
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "-mt-2 rounded-[14px] px-4 py-3 text-sm",
        tone === "error" ? "bg-destructive/10 text-destructive" : "bg-v2-nav-active text-v2-ink",
      )}
    >
      {children}
    </p>
  );
}

/** Full-width 58px navy pill from the login design. */
export function AuthSubmit({
  loading,
  children,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean }) {
  return (
    <button
      type="submit"
      className={cn(
        "v2-brand-fill flex h-[58px] w-full items-center justify-center gap-2 rounded-[60px] px-[30px] font-archivo text-xl leading-[1.4] text-[#f5f5f5] transition-[filter] hover:brightness-110 disabled:opacity-60",
        className,
      )}
      {...props}
      disabled={loading || props.disabled}
    >
      {loading ? <Loader2 className="size-5 animate-spin" /> : null}
      {children}
    </button>
  );
}

export function BackToLogin() {
  return (
    <Link
      to="/login"
      className="mt-6 inline-flex items-center gap-1.5 font-inter-tight text-sm font-medium text-v2-blue hover:underline"
    >
      <ArrowLeft className="size-3.5" />
      Back to log in
    </Link>
  );
}
