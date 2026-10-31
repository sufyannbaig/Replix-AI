export type Faq = {
  q: string;
  a: string;
  category: "Getting started" | "Generation" | "Billing" | "Exports" | "Account";
};

export const FAQS: Faq[] = [
  {
    category: "Getting started",
    q: "How do I get started with Replix AI?",
    a: "Sign up for a free account, connect your Shopify store, pick a product, and generate your first ad. New accounts come with 10 free AI ad generations so you can try the whole flow end-to-end without entering payment details.",
  },
  {
    category: "Getting started",
    q: "Do I need a Shopify store?",
    a: "Yes — Replix AI pulls product details, images, and prices directly from your Shopify catalogue so the ads it writes are accurate. You can connect any Shopify plan (including development stores).",
  },
  {
    category: "Generation",
    q: "How does ad generation work?",
    a: "We send your product info (title, price, category, image) to a state-of-the-art language model along with your chosen platform (Instagram or Facebook) and creative style. The model returns a scroll-stopping hook and a caption with hashtags. You can then download the image cropped to spec.",
  },
  {
    category: "Generation",
    q: "Can I generate multiple variants at once?",
    a: "Yes. On the generate screen, set the variant count to 2–5 and we'll produce that many distinct angles in a single run (e.g. urgency, social proof, transformation) so you can A/B test them. Each variant uses one credit.",
  },
  {
    category: "Generation",
    q: "What ad styles are available?",
    a: "Modern Minimalist, Bold & Vibrant, Elegant Luxury, and Playful & Fun. Each style nudges the AI toward different copy tone and word choices.",
  },
  {
    category: "Billing",
    q: "How do credits work?",
    a: "Every ad variant costs 1 credit. Free accounts start with 10 free ad generations as a one-off promotional allowance. Paid plans then top up automatically each month (Starter 30, Pro 100, Scale 300). If generation fails for any reason, the credit is refunded automatically.",
  },
  {
    category: "Billing",
    q: "How do I upgrade or cancel?",
    a: "Open the Billing page from the sidebar and click 'Manage subscription' — that opens the billing portal where you can upgrade, downgrade, switch payment method, or cancel any time.",
  },
  {
    category: "Exports",
    q: "What ad sizes can I export?",
    a: "We export your image cropped (center-fit) to all major platform specs: Instagram Story / Reel (1080×1920), Instagram Feed Square (1080×1080), Instagram Feed Portrait (1080×1350), Facebook Feed (1200×1500), and Facebook Story (1080×1920).",
  },
  {
    category: "Exports",
    q: "Where can I download ads?",
    a: "Hover any ad in the Gallery and click the download icon, or open the full ad detail page and use the Download button. Pick the format you need from the dropdown — we'll auto-crop and save as JPG.",
  },
  {
    category: "Account",
    q: "How do collections work?",
    a: "Collections are folders for campaigns. Create one (e.g. 'Summer Sale 2024'), then assign ads to it from the ad detail page. The collections page shows you a tile per campaign with the ad count.",
  },
  {
    category: "Account",
    q: "How do I contact support?",
    a: "Email benjamin@replixai.co.uk — we typically reply within one business day. Include your account email and a screenshot if you're reporting a bug.",
  },
];

