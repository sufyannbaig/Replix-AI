import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — Replix AI" },
      { name: "description", content: "How Replix AI collects, uses, and protects your data." },
      { property: "og:title", content: "Privacy Policy — Replix AI" },
      { property: "og:url", content: "https://replixai.co.uk/privacy" },
    ],
    links: [{ rel: "canonical", href: "https://replixai.co.uk/privacy" }],
  }),
  component: PrivacyPage,
});

const LAST_UPDATED = "29 May 2026";

function PrivacyPage() {
  return (
    <article className="mx-auto max-w-3xl px-6 py-16 lg:px-10">
      <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
        ← Back to home
      </Link>
      <h1 className="mt-6 font-display text-4xl font-bold tracking-tight">Privacy Policy</h1>
      <p className="mt-2 text-sm text-muted-foreground">Last updated: {LAST_UPDATED}</p>

      <div className="prose prose-invert mt-10 max-w-none space-y-6 text-muted-foreground">
        <section>
          <h2 className="font-display text-xl font-bold text-foreground">1. Who we are</h2>
          <p>
            Replix AI ("we", "us", "our") provides AI-powered ad creative generation for Shopify
            stores. This policy explains what data we collect when you use{" "}
            <a href="https://replixai.co.uk" className="text-brand hover:brightness-110">replixai.co.uk</a>{" "}
            and our connected services.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-bold text-foreground">2. Data we collect</h2>
          <ul className="list-disc pl-6">
            <li><strong className="text-foreground">Account data:</strong> name, email, profile picture from your sign-in provider.</li>
            <li><strong className="text-foreground">Shopify data:</strong> product titles, images, prices and categories, used solely to generate ads for you.</li>
            <li><strong className="text-foreground">Generated content:</strong> the ads, captions, and hooks you create through Replix AI.</li>
            <li><strong className="text-foreground">Billing data:</strong> for Shopify-installed stores, handled by Shopify's billing system; for direct accounts, handled by our payment processor. We never see your card details.</li>
            <li><strong className="text-foreground">Usage data:</strong> anonymous analytics about pages visited and features used.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-display text-xl font-bold text-foreground">3. How we use your data</h2>
          <p>We use your data to operate the service, generate the creatives you ask for, send transactional emails, prevent abuse, and improve the product. We do not sell your data.</p>
        </section>

        <section>
          <h2 className="font-display text-xl font-bold text-foreground">4. Sub-processors</h2>
          <p>We rely on the following providers to deliver the service:</p>
          <ul className="list-disc pl-6">
            <li>Supabase — database, authentication, file storage</li>
            <li>Shopify Billing — payment processing</li>
            <li>Shopify — product catalog access (with your authorization)</li>
            <li>Google &amp; OpenAI — AI model providers for ad generation</li>
            <li>Lovable Cloud — hosting and infrastructure</li>
          </ul>
        </section>

        <section>
          <h2 className="font-display text-xl font-bold text-foreground">5. Your rights</h2>
          <p>
            You may request access to, correction of, or deletion of your data at any time by emailing{" "}
            <a href="mailto:benjamin@replixai.co.uk" className="text-brand hover:brightness-110">benjamin@replixai.co.uk</a>.
            UK and EU users have rights under the UK GDPR and GDPR including the right to lodge a complaint with the ICO.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-bold text-foreground">6. Data retention</h2>
          <p>We keep your account data while your account is active and for up to 90 days after deletion to satisfy legal and accounting obligations.</p>
        </section>

        <section>
          <h2 className="font-display text-xl font-bold text-foreground">7. Cookies</h2>
          <p>We use essential cookies for authentication and anonymous analytics cookies to understand product usage. No third-party advertising cookies are used.</p>
        </section>

        <section>
          <h2 className="font-display text-xl font-bold text-foreground">8. Contact</h2>
          <p>
            Questions? Email{" "}
            <a href="mailto:benjamin@replixai.co.uk" className="text-brand hover:brightness-110">benjamin@replixai.co.uk</a>.
          </p>
        </section>
      </div>
    </article>
  );
}
