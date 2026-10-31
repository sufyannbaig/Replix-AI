import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service — Replix AI" },
      { name: "description", content: "The rules for using Replix AI's ad generation platform." },
      { property: "og:title", content: "Terms of Service — Replix AI" },
      { property: "og:url", content: "https://replixai.co.uk/terms" },
    ],
    links: [{ rel: "canonical", href: "https://replixai.co.uk/terms" }],
  }),
  component: TermsPage,
});

const LAST_UPDATED = "29 May 2026";

function TermsPage() {
  return (
    <article className="mx-auto max-w-3xl px-6 py-16 lg:px-10">
      <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
        ← Back to home
      </Link>
      <h1 className="mt-6 font-display text-4xl font-bold tracking-tight">Terms of Service</h1>
      <p className="mt-2 text-sm text-muted-foreground">Last updated: {LAST_UPDATED}</p>

      <div className="prose prose-invert mt-10 max-w-none space-y-6 text-muted-foreground">
        <section>
          <h2 className="font-display text-xl font-bold text-foreground">1. Agreement</h2>
          <p>By creating an account or using Replix AI ("the Service") you agree to these Terms. If you do not agree, do not use the Service.</p>
        </section>

        <section>
          <h2 className="font-display text-xl font-bold text-foreground">2. The service</h2>
          <p>Replix AI generates ad copy and creative assets from your Shopify product catalog using third-party AI models. Output quality varies and may require human review before publication.</p>
        </section>

        <section>
          <h2 className="font-display text-xl font-bold text-foreground">3. Accounts</h2>
          <p>You are responsible for keeping your login credentials secure and for everything that happens under your account. You must be at least 18 years old to use Replix AI.</p>
        </section>

        <section>
          <h2 className="font-display text-xl font-bold text-foreground">4. Plans, credits and billing</h2>
          <ul className="list-disc pl-6">
            <li>Plans are billed monthly in advance through Shopify's billing system for stores installed via Shopify, or through our payment processor for direct accounts.</li>
            <li>Each plan includes a monthly credit allowance that resets on renewal. Unused credits do not roll over.</li>
            <li>You may cancel at any time; access continues until the end of your current billing period.</li>
            <li>We offer a 7-day money-back guarantee on first-time paid subscriptions.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-display text-xl font-bold text-foreground">5. Acceptable use</h2>
          <p>You agree not to use Replix AI to generate content that is illegal, defamatory, infringing, hateful, sexually explicit, or that targets minors. We may suspend accounts that violate this policy.</p>
        </section>

        <section>
          <h2 className="font-display text-xl font-bold text-foreground">6. Ownership of generated content</h2>
          <p>You own the ads you generate, subject to the underlying rights in the product images you provide. You are responsible for ensuring you have rights to all inputs you upload or connect.</p>
        </section>

        <section>
          <h2 className="font-display text-xl font-bold text-foreground">7. Disclaimers</h2>
          <p>The Service is provided "as is" without warranties of any kind. AI-generated output may contain inaccuracies — always review before publishing.</p>
        </section>

        <section>
          <h2 className="font-display text-xl font-bold text-foreground">8. Limitation of liability</h2>
          <p>To the maximum extent permitted by law, our total liability for any claim relating to the Service is limited to the amount you paid us in the 12 months before the claim arose.</p>
        </section>

        <section>
          <h2 className="font-display text-xl font-bold text-foreground">9. Termination</h2>
          <p>You may delete your account at any time. We may suspend or terminate your account for breach of these Terms or extended inactivity, with notice where reasonable.</p>
        </section>

        <section>
          <h2 className="font-display text-xl font-bold text-foreground">10. Governing law</h2>
          <p>These Terms are governed by the laws of England and Wales. Disputes are subject to the exclusive jurisdiction of the courts of England and Wales.</p>
        </section>

        <section>
          <h2 className="font-display text-xl font-bold text-foreground">11. Contact</h2>
          <p>
            Questions? Email{" "}
            <a href="mailto:hello@replixai.co.uk" className="text-brand hover:brightness-110">hello@replixai.co.uk</a>.
          </p>
        </section>
      </div>
    </article>
  );
}
