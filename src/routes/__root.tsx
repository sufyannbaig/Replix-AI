import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";

import { AuthProvider } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { StaleModuleRecovery } from "@/components/stale-module-recovery";
import { ApiHealthBanner } from "@/components/api-health-banner";
import { ClientErrorLogger } from "@/components/client-error-logger";
import { PromoPopup } from "@/components/PromoPopup";
import { logClientError, type LoggedError } from "@/lib/client-error-logger";
import { Toaster } from "sonner";
import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center justify-center rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground transition-colors hover:brightness-110"
        >
          Go home
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  const router = useRouter();
  const [logged, setLogged] = useState<LoggedError | null>(null);
  useEffect(() => {
    setLogged(logClientError(error, "route"));
  }, [error]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">This page didn't load</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end.
        </p>
        {logged ? (
          <p className="mt-2 text-xs text-muted-foreground">
            Reference ID:{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">
              {logged.refId}
            </code>
          </p>
        ) : null}
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground hover:brightness-110"
          >
            Try again
          </button>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Replix AI — AI ad creatives for Shopify" },
      {
        name: "description",
        content:
          "Turn Shopify products into scroll-stopping Instagram and Facebook ads with AI — copy, hook and visuals in seconds.",
      },
      { property: "og:site_name", content: "Replix AI" },
      { property: "og:title", content: "Replix AI — AI ad creatives for Shopify" },
      { name: "twitter:title", content: "Replix AI — AI ad creatives for Shopify" },
      {
        property: "og:description",
        content:
          "Turn Shopify products into scroll-stopping Instagram and Facebook ads with AI — copy, hook and visuals in seconds.",
      },
      {
        name: "twitter:description",
        content:
          "Turn Shopify products into scroll-stopping Instagram and Facebook ads with AI — copy, hook and visuals in seconds.",
      },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/png", href: "/favicon.png?v=4" },
      { rel: "apple-touch-icon", href: "/favicon.png?v=4" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta httpEquiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
        <meta httpEquiv="Pragma" content="no-cache" />
        <meta httpEquiv="Expires" content="0" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700;800;900&family=Inter+Tight:wght@400;500;600;700&family=Inter:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        {/* Apply the saved app theme before first paint so dark mode never flashes light. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('replix-theme');var d=t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=d?'dark':'light'}catch(e){}`,
          }}
        />

        <script
          dangerouslySetInnerHTML={{
            __html: `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window, document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init', '28605365312439799');fbq('track', 'PageView');`,
          }}
        />
        <HeadContent />
      </head>
      <body>
        <noscript>
          <img height="1" width="1" style={{ display: "none" }} alt="" src="https://www.facebook.com/tr?id=28605365312439799&ev=PageView&noscript=1" />
        </noscript>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function AuthInvalidator() {
  const router = useRouter();
  const queryClient = useQueryClient();
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      router.invalidate();
      if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
    });

    return () => subscription.unsubscribe();
  }, [router, queryClient]);
  return null;
}

function MetaPixelPageViews() {
  const router = useRouter();
  useEffect(() => {
    // Initial PageView is fired by the base code; track subsequent route changes.
    return router.subscribe("onResolved", (e) => {
      if (!e.pathChanged) return;
      const fbq = (window as any).fbq;
      if (typeof fbq === "function") fbq("track", "PageView");
    });
  }, [router]);
  return null;
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AuthInvalidator />
        <MetaPixelPageViews />
        <ClientErrorLogger />
        <StaleModuleRecovery />
        <ApiHealthBanner />
        <PromoPopup />
        <Outlet />
        <Toaster theme="light" position="top-right" richColors />
      </AuthProvider>
    </QueryClientProvider>
  );
}
