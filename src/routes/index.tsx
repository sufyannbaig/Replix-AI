import { Link, createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { replixAssets } from "@/lib/replix-assets";
import connectStoreGraphic from "@/assets/replix/connect-store-updated.png.asset.json";
import pickProductGraphic from "@/assets/replix/pick-product-updated.png.asset.json";
import generateAdGraphic from "@/assets/replix/generate-ad-updated.png.asset.json";

export const Route = createFileRoute("/")({
  component: ReplixLandingPage,
  head: () => ({
    meta: [
      { title: "Replix AI | Turn any product photo into scroll-stopping ads" },
      {
        name: "description",
        content:
          "Upload a product photo and Replix AI turns it into polished, scroll-stopping ad creatives. Try 10 free ads. No credit card required.",
      },
      { property: "og:title", content: "Replix AI | Turn any product photo into scroll-stopping ads" },
      {
        property: "og:description",
        content: "Upload a product photo and Replix AI turns it into polished, scroll-stopping ad creatives. Try 10 free ads. No credit card required.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://replixai.co.uk/" },
      {
        property: "og:image",
        content: "https://replixai.co.uk/__l5e/assets-v1/1e8e075d-2fc3-4707-9dc6-796c23b6ee43/og-preview-v2.png",
      },
      { property: "og:image:width", content: "1920" },
      { property: "og:image:height", content: "984" },
      { property: "og:image:type", content: "image/webp" },
      { name: "twitter:card", content: "summary_large_image" },
      {
        name: "twitter:image",
        content: "https://replixai.co.uk/__l5e/assets-v1/1e8e075d-2fc3-4707-9dc6-796c23b6ee43/og-preview-v2.png",
      },
      {
        name: "twitter:description",
        content: "Upload a product photo and Replix AI turns it into polished, scroll-stopping ad creatives. Try 10 free ads. No credit card required.",
      },
    ],
    links: [{ rel: "canonical", href: "https://replixai.co.uk/" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "Replix AI",
          url: "https://replixai.co.uk/",
        }),
      },
    ],
  }),
});

function trackLead() {
  try {
    const fbq = typeof window !== "undefined" ? (window as any).fbq : undefined;
    if (typeof fbq === "function") fbq("track", "Lead");
  } catch {}
}

// A generic "product photo" icon (24 x 24) that replaces the Shopify logo in the hero and step 1.
const photoGlyph = (
  <>
    <rect x="3" y="4" width="18" height="16" rx="3" fill="none" stroke="#12213D" strokeWidth="1.8" />
    <circle cx="9" cy="9.5" r="1.9" fill="#E8A93B" />
    <path d="M4 18l5.2-5.2a1.5 1.5 0 0 1 2.1 0L14 15.5l1.8-1.8a1.5 1.5 0 0 1 2.1 0L21 16.8" fill="none" stroke="#12213D" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </>
);

const faqFilters = [
  { label: "All", icon: null },
  { label: "Getting Started", icon: replixAssets.faq_filter_getting_started_svg },
  { label: "Generation", icon: replixAssets.faq_filter_generation_svg },
  { label: "Exports", icon: replixAssets.faq_filter_exports_svg },
  { label: "Billing", icon: replixAssets.faq_filter_billing_svg },
  { label: "Account", icon: replixAssets.faq_filter_account_svg },
];

const faqItems = [
  { question: "How Do I Get Started With Replix Ai ?", answer: "Sign up free, upload a product photo or paste a product link, and create your first ad. Get 10 free AI ad generations—no card required." },
  { question: "Do I Need a Shopify Store ?", answer: "No. Upload a photo of any product or paste a link to its page. If you sell on Shopify, you can also connect your store to import every product in one click." },
  { question: "Do I Need a Shopify Store", answer: "No. Upload a photo of any product or paste a link to its page. If you sell on Shopify, you can also connect your store to import every product in one click." },
  { question: "What Ad Styles Are Available", answer: "Choose from 10+ creative styles, tailored to your brand and product category." },
  { question: "What Ad Styles Are Available", answer: "Choose from 10+ creative styles, tailored to your brand and product category." },
];

function ReplixLandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState("All");
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const closeMenu = () => setMenuOpen(false);
  return <main className="replix-homepage">
<header className="nav-wrap">
  <nav className="nav container">
    <a href="#top" className="logo" onClick={closeMenu}>
      <img src={replixAssets.logo_mark_png} alt="" className="logo-mark" />
      <span>Replix Ai</span>
    </a>
    <Button type="button" variant="ghost" size="icon" className="nav-toggle" aria-label="Toggle menu" aria-expanded={menuOpen} onClick={() => setMenuOpen((value) => !value)}>
      <span></span><span></span><span></span>
    </Button>
    <ul className={`nav-links${menuOpen ? " nav-links--open" : ""}`}>
       <li><a href="#how" className="active" onClick={closeMenu}>How it works</a></li>
       <li><a href="#gallery" onClick={closeMenu}>Ad Gallery</a></li>
       <li><a href="#pricing" onClick={closeMenu}>Pricing</a></li>
       <li><a href="#faq" onClick={closeMenu}>FAQ</a></li>
    </ul>
     <Button asChild className="btn btn-gradient nav-cta"><Link to="/login" onClick={trackLead}>Try 10 free ads</Link></Button>
  </nav>
</header>


<section className="hero" id="top">
  <div className="container hero-inner">
    <div className="hero-decor" aria-hidden="true">
      <div className="float-card float-card-a">
        <svg viewBox="0 0 24 24" width="100%" height="100%">{photoGlyph}</svg>
      </div>
      <div className="float-card float-card-b">
        <img src={replixAssets.float_card_1_jpg} alt="" />
      </div>
    </div>

    <h1 className="hero-title">Your next product ad could be ready <span className="grad-text">in 36 seconds</span></h1>

    <div className="hero-sub-wrap">
      <p className="hero-sub">Upload a product photo and Replix AI turns it into polished, scroll-stopping ad creatives. Create more concepts, explore more angles, and find what works without starting from scratch every time.</p>
      <div className="hero-actions">
        <Button asChild className="btn btn-yellow"><Link to="/login" onClick={trackLead}>Try 10 free ads</Link></Button>
        <Button asChild className="btn btn-outline"><a href="#gallery">View the gallery</a></Button>
      </div>
      <p className="hero-fineprint">No credit card required.</p>
    </div>
  </div>

  <div className="hero-strip" aria-hidden="true">
    <img src={replixAssets.hero_strip_1_jpg} alt="" />
    <img src={replixAssets.hero_strip_2_jpg} alt="" />
    <img src={replixAssets.hero_strip_3_jpg} alt="" />
    <img src={replixAssets.hero_strip_4_jpg} alt="" />
    <img src={replixAssets.hero_strip_5_jpg} alt="" />
    <img src={replixAssets.hero_strip_6_jpg} alt="" />
  </div>

  <div className="container hero-stats-wrap">
    <h2 className="hero-stats-title">Built for Faster, <span className="accent-text">Better Ads</span></h2>
    <div className="stats-row">
      <div className="stat"><span className="stat-num">3k+</span><span className="stat-label">Ads Generated</span></div>
      <span className="stat-divider"></span>
      <div className="stat"><span className="stat-num">60 Sec</span><span className="stat-label">Product to Ad</span></div>
      <span className="stat-divider"></span>
      <div className="stat"><span className="stat-num">10</span><span className="stat-label">Creative Styles</span></div>
      <span className="stat-divider"></span>
      <div className="stat"><span className="stat-num">0</span><span className="stat-label">Design Skills Needed</span></div>
    </div>
  </div>
</section>


<section className="features" id="how">
  <div className="container">
    <div className="features-head">
      <h2>Create More.<br />Spend Less.</h2>
      <p>See how Replix delivers high-quality, on-brand ad creatives in seconds—at a fraction of the cost of freelancers and manual design tools.</p>
    </div>

    <div className="compare-table">
      <div className="compare-col compare-col--highlight">
        <div className="compare-plan-name">Replix AI</div>
        <div className="compare-cell compare-cell--strong" data-label="Speed To Market">60 Seconds</div>
        <div className="compare-cell compare-cell--strong" data-label="Cost Per Ad">$0.30</div>
        <div className="compare-cell compare-check" data-label="Product Import"><img src={replixAssets.check_icon_svg} alt="Yes" /></div>
        <div className="compare-cell compare-cell--strong" data-label="Copy Writing Hook">AI Sales-Optimized</div>
      </div>
      <div className="compare-col">
        <div className="compare-plan-name">Freelancers</div>
        <div className="compare-cell" data-label="Speed To Market">2-5 Days</div>
        <div className="compare-cell" data-label="Cost Per Ad">$150-$500</div>
        <div className="compare-cell" data-label="Product Import">Manual Upload</div>
        <div className="compare-cell" data-label="Copy Writing Hook">Hit Or Miss</div>
      </div>
      <div className="compare-col">
        <div className="compare-plan-name">Canva/Manual</div>
        <div className="compare-cell" data-label="Speed To Market">2-4 Hours</div>
        <div className="compare-cell" data-label="Cost Per Ad">Your Time (Expensive)</div>
        <div className="compare-cell" data-label="Product Import">None</div>
        <div className="compare-cell" data-label="Copy Writing Hook">Genetic Templates</div>
      </div>
      <div className="compare-rows">
        <div className="compare-row-label">Speed To Market</div>
        <div className="compare-row-label">Cost Per Ad</div>
        <div className="compare-row-label">Product Import</div>
        <div className="compare-row-label">Copy Writing Hook</div>
      </div>
    </div>
  </div>
</section>


<section className="steps">
  <div className="container">
    <div className="section-head">
      <h2>3 Simple Steps to Automated <span className="muted">Marketing</span></h2>
      <p>Add your product, choose your brand style, and let AI generate high-converting campaigns instantly.</p>
    </div>

    <div className="steps-row">
      <div className="step-card">
        <div className="step-visual step-visual--blue">
          <svg className="step-graphic" viewBox="0 0 344 340" preserveAspectRatio="xMidYMin slice" role="img" aria-label="Product added to Replix">
            <image href={connectStoreGraphic.url} width="344" height="340" />
            <rect x="117" y="100" width="36" height="38" fill="#fff" />
            <svg x="121" y="105" width="28" height="28" viewBox="0 0 24 24">
              <g transform="rotate(2 12 12)">{photoGlyph}</g>
            </svg>
          </svg>
        </div>
        <div className="step-body">
          <h3>Add Your Product</h3>
          <p>Upload a photo or paste a product link. On Shopify? Connect your store to import everything in one click.</p>
        </div>
      </div>

      <div className="step-card">
        <div className="step-visual step-visual--yellow">
          <img className="step-graphic" src={pickProductGraphic.url} alt="Product selection with bottled products" loading="lazy" />
        </div>
        <div className="step-body">
          <h3>Pick a Product</h3>
          <p>Choose the product you want to promote. Replix pulls in the details automatically.</p>
        </div>
      </div>

      <div className="step-card">
        <div className="step-visual step-visual--green">
          <img className="step-graphic" src={generateAdGraphic.url} alt="Generated iced coffee ad with three aspect ratio options" loading="lazy" />
        </div>
        <div className="step-body">
          <h3>Generate Your Ad</h3>
          <p>Replix creates the hook, copy and visual — ready to post across social media.</p>
        </div>
      </div>
    </div>
  </div>
</section>


<section className="gallery" id="gallery">
  <div className="container section-head">
    <h2>Explore What You Can Create with <span className="muted">Replix AI</span></h2>
    <p>Filter through high-converting ad styles generated automatically for top e-commerce brands.</p>
  </div>

  <div className="marquee-wrap">
    <div className="marquee-fade marquee-fade--left"></div>
    <div className="marquee-fade marquee-fade--right"></div>
    <div className="marquee-track marquee-track--row1">
      <div className="marquee-group">
        <img src={replixAssets.gallery_1_jpg} alt="" />
        <img src={replixAssets.gallery_2_jpg} alt="" />
        <img src={replixAssets.gallery_3_jpg} alt="" />
        <img src={replixAssets.gallery_4_jpg} alt="" />
        <img src={replixAssets.gallery_5_jpg} alt="" />
        <img src={replixAssets.gallery_6_jpg} alt="" />
      </div>
      <div className="marquee-group" aria-hidden="true">
        <img src={replixAssets.gallery_1_jpg} alt="" />
        <img src={replixAssets.gallery_2_jpg} alt="" />
        <img src={replixAssets.gallery_3_jpg} alt="" />
        <img src={replixAssets.gallery_4_jpg} alt="" />
        <img src={replixAssets.gallery_5_jpg} alt="" />
        <img src={replixAssets.gallery_6_jpg} alt="" />
      </div>
    </div>
    <div className="marquee-track marquee-track--row2">
      <div className="marquee-group">
        <img src={replixAssets.gallery_7_jpg} alt="" />
        <img src={replixAssets.gallery_8_jpg} alt="" />
        <img src={replixAssets.gallery_9_jpg} alt="" />
        <img src={replixAssets.gallery_10_jpg} alt="" />
        <img src={replixAssets.gallery_11_jpg} alt="" />
      </div>
      <div className="marquee-group" aria-hidden="true">
        <img src={replixAssets.gallery_7_jpg} alt="" />
        <img src={replixAssets.gallery_8_jpg} alt="" />
        <img src={replixAssets.gallery_9_jpg} alt="" />
        <img src={replixAssets.gallery_10_jpg} alt="" />
        <img src={replixAssets.gallery_11_jpg} alt="" />
      </div>
    </div>
  </div>

  <div className="container gallery-cta-wrap">
    <Button asChild className="btn btn-gradient"><Link to="/login">Create Your Own Ad</Link></Button>
  </div>
</section>


<section className="pricing" id="pricing">
  <div className="container section-head">
    <h2>Simple plans that grow <span className="muted">with you.</span></h2>
    <p>Start with 10 free ads, then choose a plan that fits your monthly creative volume.</p>
  </div>

  <div className="container pricing-row">
    <div className="price-card">
      <div className="price-head">
        <div>
          <div className="price-name">Starter</div>
          <div className="price-desc">For small brands and solo sellers</div>
        </div>
        <img src={replixAssets.pricing_icon_starter_svg} alt="" className="price-icon" />
      </div>
      <div className="price-cta-row">
        <Button asChild className="btn btn-outline-dark btn-sm"><Link to="/login">Start Starter</Link></Button>
        <div className="price-amount"><s className="price-was">$19.99</s>$9.99<span>/month</span></div>
      </div>
      <div className="price-divider" />
      <ul className="price-features">
        <li><img src={replixAssets.check_icon_svg} alt="" />30 AI generations/month</li>
        <li><img src={replixAssets.check_icon_svg} alt="" />All creative styles</li>
        <li><img src={replixAssets.check_icon_svg} alt="" />Edit captions & hooks</li>
        <li><img src={replixAssets.check_icon_svg} alt="" />Basic Brand DNA</li>
        <li><img src={replixAssets.check_icon_svg} alt="" />High-quality downloads</li>
      </ul>
    </div>

    <div className="price-panel--pro">
      <span className="price-badge">MOST POPULAR</span>
      <div className="price-card price-card--pro">
        <div className="price-head">
          <div>
            <div className="price-name">Pro</div>
            <div className="price-desc">For growing brands</div>
          </div>
          <img src={replixAssets.pricing_icon_pro_svg} alt="" className="price-icon" />
        </div>
        <div className="price-cta-row">
          <Button asChild className="btn btn-gradient btn-sm"><Link to="/login">Start Pro</Link></Button>
          <div className="price-amount"><s className="price-was">$59</s>$29<span>/month</span></div>
        </div>
        <div className="price-divider" />
        <ul className="price-features">
          <li><svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M2.5 8.5l3.5 3.5 7.5-8" stroke="#5F6470" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>100 AI generations/month</li>
          <li><svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M2.5 8.5l3.5 3.5 7.5-8" stroke="#5F6470" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>Advanced Brand DNA</li>
          <li><svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M2.5 8.5l3.5 3.5 7.5-8" stroke="#5F6470" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>Multiple creative concepts</li>
          <li><svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M2.5 8.5l3.5 3.5 7.5-8" stroke="#5F6470" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>Premium creative styles</li>
          <li><svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M2.5 8.5l3.5 3.5 7.5-8" stroke="#5F6470" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>Full creative library</li>
        </ul>
      </div>
    </div>

    <div className="price-card">
      <div className="price-head">
        <div>
          <div className="price-name">Scale</div>
          <div className="price-desc">For brands creating ads at scale</div>
        </div>
        <img src={replixAssets.pricing_icon_scale_svg} alt="" className="price-icon" />
      </div>
      <div className="price-cta-row">
        <Button asChild className="btn btn-outline-dark btn-sm"><Link to="/login">Start Scale</Link></Button>
          <div className="price-amount"><s className="price-was">$99</s>$59<span>/month</span></div>
        </div>
        <div className="price-divider" />
        <ul className="price-features">
          <li><img src={replixAssets.check_icon_svg} alt="" />300 AI generations/month</li>
          <li><img src={replixAssets.check_icon_svg} alt="" />Advanced Brand DNA</li>
          <li><img src={replixAssets.check_icon_svg} alt="" />Multiple creative concepts</li>
          <li><img src={replixAssets.check_icon_svg} alt="" />Unlimited access to creative styles</li>
          <li><img src={replixAssets.check_icon_svg} alt="" />Priority Support</li>
        </ul>
    </div>
  </div>
</section>


<section className="testimonials">
  <div className="container section-head">
    <h2>What people actually say.</h2>
  </div>

  <div className="marquee-wrap">
    <div className="marquee-fade marquee-fade--left"></div>
    <div className="marquee-fade marquee-fade--right"></div>
    <div className="marquee-track marquee-track--row1">
      <div className="marquee-group marquee-group--testi">
        <article className="testi-card">
          <img className="testi-img" src={replixAssets.testimonial_1_jpg} alt="" />
          <div className="testi-content">
          <div className="testi-stars">★★★★★</div>
          <p>Plugged in one of my products and the captions actually sounded like something I'd write, not the usual robotic ad copy. The image variations were a nice bonus.</p>
          </div>
        </article>
        <article className="testi-card">
          <img className="testi-img" src={replixAssets.testimonial_2_jpg} alt="" />
          <div className="testi-content">
          <div className="testi-stars">★★★★★</div>
          <p>Plugged in one of my Shopify products and the generated hooks actually sounded like something my customers would stop scrolling for. The caption variations saved me at least an hour of staring at a blank doc.</p>
          </div>
        </article>
        <article className="testi-card">
          <img className="testi-img" src={replixAssets.testimonial_3_jpg} alt="" />
          <div className="testi-content">
          <div className="testi-stars">★★★★★</div>
          <p>Finally something that takes the guesswork out of writing ad copy. I fed it one of my products and got three solid hooks in under a minute, way better than staring at a blank Canva screen.</p>
          </div>
        </article>
      </div>
      <div className="marquee-group marquee-group--testi" aria-hidden="true">
        <article className="testi-card">
          <img className="testi-img" src={replixAssets.testimonial_1_jpg} alt="" />
          <div className="testi-content">
          <div className="testi-stars">★★★★★</div>
          <p>Love how it ties the product image, caption, and hook into one workflow instead of jumping between three different tabs.</p>
          </div>
        </article>
        <article className="testi-card">
          <img className="testi-img" src={replixAssets.testimonial_2_jpg} alt="" />
          <div className="testi-content">
          <div className="testi-stars">★★★★★</div>
          <p>Onboarding took a minute. Literally. I connected the store, picked a product, and had three ads before my coffee.</p>
          </div>
        </article>
        <article className="testi-card">
          <img className="testi-img" src={replixAssets.testimonial_3_jpg} alt="" />
          <div className="testi-content">
          <div className="testi-stars">★★★★★</div>
          <p>Our best-performing Meta ad this quarter was generated by Replix in 40 seconds. That still feels illegal to say.</p>
          </div>
        </article>
      </div>
    </div>
    <div className="marquee-track marquee-track--row2">
      <div className="marquee-group marquee-group--testi">
        <article className="testi-card">
          <img className="testi-img" src={replixAssets.testimonial_4_jpg} alt="" />
          <div className="testi-content">
          <div className="testi-stars">★★★★★</div>
          <p>Plugged in one of my products and the captions actually sounded like something I'd write, not the usual robotic ad copy. The image variations were a nice bonus.</p>
          </div>
        </article>
        <article className="testi-card">
          <img className="testi-img" src={replixAssets.testimonial_5_jpg} alt="" />
          <div className="testi-content">
          <div className="testi-stars">★★★★★</div>
          <p>Plugged in one of my Shopify products and the generated hooks actually sounded like something my customers would stop scrolling for. The caption variations saved me at least an hour of staring at a blank doc.</p>
          </div>
        </article>
        <article className="testi-card">
          <img className="testi-img" src={replixAssets.testimonial_6_jpg} alt="" />
          <div className="testi-content">
          <div className="testi-stars">★★★★★</div>
          <p>Finally something that takes the guesswork out of writing ad copy. I fed it one of my products and got three solid hooks in under a minute, way better than staring at a blank Canva screen.</p>
          </div>
        </article>
      </div>
      <div className="marquee-group marquee-group--testi" aria-hidden="true">
        <article className="testi-card">
          <img className="testi-img" src={replixAssets.testimonial_4_jpg} alt="" />
          <div className="testi-content">
          <div className="testi-stars">★★★★★</div>
          <p>Love how it ties the product image, caption, and hook into one workflow instead of jumping between three different tabs.</p>
          </div>
        </article>
        <article className="testi-card">
          <img className="testi-img" src={replixAssets.testimonial_5_jpg} alt="" />
          <div className="testi-content">
          <div className="testi-stars">★★★★★</div>
          <p>Onboarding took a minute. Literally. I connected the store, picked a product, and had three ads before my coffee.</p>
          </div>
        </article>
        <article className="testi-card">
          <img className="testi-img" src={replixAssets.testimonial_6_jpg} alt="" />
          <div className="testi-content">
          <div className="testi-stars">★★★★★</div>
          <p>Our best-performing Meta ad this quarter was generated by Replix in 40 seconds. That still feels illegal to say.</p>
          </div>
        </article>
      </div>
    </div>
  </div>
</section>


<section className="faq" id="faq">
  <div className="container">
    <div className="faq-grid">
      <div className="faq-left">
        <h2>How can we help?</h2>
        <p className="faq-sub">Answers to the most common questions about generating ads, billing, and your account.</p>

        <div className="faq-search">
          <img src={replixAssets.faq_search_icon_svg} alt="" />
          <span>Search Articles....</span>
        </div>

        <div className="faq-filters">
          {faqFilters.map((filter) => (
            <Button key={filter.label} type="button" className={`faq-filter${activeFilter === filter.label ? " faq-filter--active" : ""}`} onClick={() => setActiveFilter(filter.label)}>
              {filter.icon && <img src={filter.icon} alt="" />}{filter.label}
            </Button>
          ))}
        </div>

        <div className="faq-accordion">
          {faqItems.map((item, index) => {
            const isOpen = openFaq === index;
            return (
              <div className={`faq-item${isOpen ? " faq-item--open" : ""}`} key={`${item.question}-${index}`}>
                <Button type="button" className="faq-q" aria-expanded={isOpen} onClick={() => setOpenFaq(isOpen ? null : index)}>
                  {item.question}<span className="faq-toggle" aria-hidden="true"></span>
                </Button>
                <div className="faq-a" aria-hidden={!isOpen}><p>{item.answer}</p></div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="faq-help-card">
        <h3>Still need help?</h3>
        <p>Email our support team and we’ll get back to you within one business day.</p>
        <Button asChild className="btn btn-light-pill"><a href="mailto:benjamin@replixai.co.uk">
          <img src={replixAssets.faq_arrow_icon_svg} alt="" />
          Email Us
        </a></Button>
      </div>
    </div>
  </div>
</section>


<section className="final-cta">
  <div className="container">
    <div className="final-cta-card">
      <h2>Start Generating High-ROAS Ads in Seconds</h2>
      <p>Create more on-brand ads without the slow briefs, repetitive setup, or creative production bottlenecks.</p>
      <Button asChild className="btn btn-gradient"><Link to="/login">Start Free Trial</Link></Button>
    </div>
  </div>
</section>


<footer className="footer">
  <img src={replixAssets.footer_dashed_line_svg} alt="" className="footer-dashes" />
  <div className="container footer-inner">
    <img src={replixAssets.footer_divider_svg} alt="" className="footer-divider" />
    <div className="footer-row">
      <span>© 2026 Replix AI Ltd. All rights reserved.</span>
      <div className="footer-links">
        <Link to="/privacy">Privacy Policy</Link>
        <Link to="/terms">Terms of Service</Link>
      </div>
    </div>
    <img src={replixAssets.footer_wordmark_svg} alt="Replix Ai" className="footer-wordmark" />
  </div>
</footer>
  </main>;
}
