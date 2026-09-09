import { Link } from 'react-router-dom';
import { Bot, Search, MapPin, AlertTriangle, BookOpen, Ban } from 'lucide-react';
import { SEOHead } from '../../components/seo/SEOHead';

/**
 * AgentsPage — dead-simple static doc for AI shopping agents.
 * Pure view: no Supabase / Convex imports (theme-decoupling rule).
 * Bots also get a prerendered copy from functions/ssr-middleware.js.
 */
export function AgentsPage() {
  return (
    <>
      <SEOHead
        title="Shopping Agents — Start Here | Cigarro"
        description="Machine-readable guide for AI shopping agents: catalog entry points, search template, variant semantics, and compliance rules for cigarro.in. 21+ only."
        url="https://cigarro.in/agents"
      />
      <main className="main-container py-10 md:py-16 max-w-3xl">
        <p className="suptitle text-canyon mb-3 flex items-center gap-2">
          <Bot className="w-4 h-4" /> For AI shopping agents
        </p>
        <h1 className="font-serif text-dark text-3xl md:text-5xl mb-4">
          Agents start here
        </h1>
        <p className="text-dark/70 text-base md:text-lg leading-relaxed mb-8">
          Cigarro is India&apos;s premium tobacco marketplace. This page is the
          machine-readable entry point: where the catalog lives, how search
          works, and the rules for acting on a shopper&apos;s behalf.
        </p>

        {/* Compliance */}
        <section className="rounded-xl border border-canyon/25 bg-canyon/5 p-5 md:p-6 mb-8">
          <h2 className="font-serif text-dark text-xl mb-3 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-canyon" /> Compliance (non-negotiable)
          </h2>
          <ul className="list-disc pl-5 space-y-2 text-dark/80 text-sm md:text-base leading-relaxed">
            <li>Buyers must be 18+ (21+ in Karnataka). Never facilitate underage purchase — it is a criminal offense.</li>
            <li>Smoking is injurious to health. Cigarro does not promote tobacco use.</li>
            <li>Surface the product&apos;s health warning to the shopper before checkout.</li>
          </ul>
        </section>

        {/* Entry points */}
        <section className="mb-8">
          <h2 className="font-serif text-dark text-xl mb-3 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-canyon" /> Entry points
          </h2>
          <ul className="space-y-2 text-sm md:text-base">
            <li><Link to="/products" className="text-canyon underline underline-offset-4">/products</Link> <span className="text-dark/60">— full catalog</span></li>
            <li><Link to="/brands" className="text-canyon underline underline-offset-4">/brands</Link> <span className="text-dark/60">— all brands</span></li>
            <li><Link to="/categories" className="text-canyon underline underline-offset-4">/categories</Link> <span className="text-dark/60">— all categories</span></li>
            <li><span className="font-mono bg-dark/5 px-1.5 py-0.5 rounded">/product/:slug</span> <span className="text-dark/60">— one product, variants + price + stock</span></li>
            <li><span className="font-mono bg-dark/5 px-1.5 py-0.5 rounded">/brand/:slug</span> <span className="text-dark/60">— brand collection</span></li>
            <li><span className="font-mono bg-dark/5 px-1.5 py-0.5 rounded">/category/:slug</span> <span className="text-dark/60">— category listing</span></li>
          </ul>
        </section>

        {/* Search */}
        <section className="mb-8">
          <h2 className="font-serif text-dark text-xl mb-3 flex items-center gap-2">
            <Search className="w-5 h-5 text-canyon" /> Search
          </h2>
          <p className="text-dark/70 text-sm md:text-base mb-2">URL-addressable search template (use this, don&apos;t guess):</p>
          <p className="font-mono text-sm bg-dark/5 rounded-lg px-3 py-2.5 mb-2">https://cigarro.in/products?search={'{query}'}</p>
          <p className="text-dark/60 text-sm leading-relaxed">
            Tip: include the pack size in the query — e.g. <em>“Dunhill Red carton”</em>, <em>“Marlboro Gold packet”</em>.
            Search understands packet / carton / half-carton / combo synonyms.
          </p>
          <p className="text-dark/70 text-sm md:text-base mt-3 mb-2">Machine formats (no login, any client — same public data as search engines see):</p>
          <p className="font-mono text-sm bg-dark/5 rounded-lg px-3 py-2.5 mb-2">…/products?search={'{query}'}&format=json</p>
          <p className="font-mono text-sm bg-dark/5 rounded-lg px-3 py-2.5 mb-2">…/product/{'{slug}'}?format=json <span className="text-dark/50">or ?format=md</span></p>
        </section>

        {/* Variants */}
        <section className="mb-8">
          <h2 className="font-serif text-dark text-xl mb-3 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-canyon" /> Variant semantics
          </h2>
          <ul className="list-disc pl-5 space-y-2 text-dark/80 text-sm md:text-base leading-relaxed">
            <li><strong>packet</strong> — single pack (check <em>units_contained</em> for stick count).</li>
            <li><strong>carton</strong> — box of 10 packets. <strong>half-carton</strong> — 5 packets.</li>
            <li><strong>combo</strong> — bundle / special offer, may mix products.</li>
            <li>Price and stock live on the <strong>variant</strong>, not the product. Always quote the selected variant&apos;s price in INR (₹).</li>
          </ul>
        </section>

        {/* Rules */}
        <section className="mb-8">
          <h2 className="font-serif text-dark text-xl mb-3 flex items-center gap-2">
            <Ban className="w-5 h-5 text-canyon" /> Rules for agents
          </h2>
          <ul className="list-disc pl-5 space-y-2 text-dark/80 text-sm md:text-base leading-relaxed">
            <li>Read-only: browse, compare, and link. Do not auto-purchase — checkout requires human UPI payment with an exact-paise amount.</li>
            <li>Never quote a price without its variant (packet vs carton) and stock status.</li>
            <li>Out-of-stock variants cannot be ordered. Suggest an in-stock variant instead.</li>
            <li>Respect <Link to="/terms" className="text-canyon underline underline-offset-4">Terms</Link>, <Link to="/shipping" className="text-canyon underline underline-offset-4">Shipping</Link> and <Link to="/returns" className="text-canyon underline underline-offset-4">Returns</Link> pages when advising shoppers.</li>
          </ul>
        </section>

        {/* Machine files */}
        <section className="rounded-xl border border-coyote/30 p-5 md:p-6">
          <h2 className="font-serif text-dark text-xl mb-3">Machine files</h2>
          <ul className="space-y-2 text-sm md:text-base">
            <li><a href="/llms.txt" className="text-canyon underline underline-offset-4">/llms.txt</a> <span className="text-dark/60">— store manual for LLMs</span></li>
            <li><a href="/sitemap.xml" className="text-canyon underline underline-offset-4">/sitemap.xml</a> <span className="text-dark/60">— all indexable URLs + product images</span></li>
          </ul>
          <p className="text-dark/60 text-sm mt-4">
            Questions or bulk-catalog access? <Link to="/contact" className="text-canyon underline underline-offset-4">Contact us</Link>.
          </p>
        </section>
      </main>
    </>
  );
}

export default AgentsPage;
