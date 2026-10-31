import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CheckCircle2, Sparkles, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/install/welcome")({
  component: InstallWelcome,
  validateSearch: (search: Record<string, unknown>) => ({
    shop: typeof search.shop === "string" ? search.shop : "",
  }),
  head: () => ({
    meta: [
      { title: "Welcome to Replix" },
      {
        name: "description",
        content:
          "Replix is now installed on your Shopify store. Sign in or create an account to start generating AI ad creatives.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function InstallWelcome() {
  const { shop } = Route.useSearch();
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  // If merchant is already signed in, skip the sign-in step and go
  // straight to plan selection (which links the install to their user).
  useEffect(() => {
    if (!loading && user && shop) {
      navigate({
        to: "/install/select-plan",
        search: { shop },
        replace: true,
      } as any);
    }
  }, [user, loading, shop, navigate]);

  if (loading || (user && shop)) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-primary" />
      </main>
    );
  }


  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-6 py-12">
      <Card className="w-full max-w-xl p-8 md:p-12 space-y-8">
        <div className="flex flex-col items-center text-center gap-4">
          <div className="size-14 rounded-2xl bg-primary/10 flex items-center justify-center">
            <CheckCircle2 className="size-8 text-primary" aria-hidden />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
            Replix is installed
          </h1>
          {shop ? (
            <p className="text-muted-foreground">
              Connected to <span className="font-medium text-foreground">{shop}</span>
            </p>
          ) : null}
        </div>

        <div className="space-y-4">
          <h2 className="font-semibold flex items-center gap-2">
            <Sparkles className="size-4 text-primary" aria-hidden />
            What's next
          </h2>
          <ol className="space-y-3 text-sm text-muted-foreground list-decimal list-inside">
            <li>Sign in or create a Replix account to link your store.</li>
            <li>Pick a plan (7-day free trial — no charge during trial).</li>
            <li>Generate your first AI ad creative from a product in your store.</li>
          </ol>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <Button asChild className="flex-1">
            <a href={`/login${shop ? `?shop=${encodeURIComponent(shop)}` : ""}`}>
              Create account
            </a>
          </Button>
          <Button asChild variant="outline" className="flex-1">
            <a href={`/login${shop ? `?shop=${encodeURIComponent(shop)}` : ""}`}>
              Sign in
            </a>
          </Button>
        </div>
      </Card>
    </main>
  );
}
