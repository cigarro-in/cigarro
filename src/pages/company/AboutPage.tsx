import { Link, useLocation } from 'react-router-dom';
import { ArrowRight, CircleHelp, Layers3, Search, ShieldAlert } from 'lucide-react';
import { SEOHead } from '../../components/seo/SEOHead';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';

const waysToBrowse = [
  {
    icon: Search,
    title: 'Find the brand you know',
    description: 'Search the catalogue directly or browse all available brands in one place.',
    label: 'Browse brands',
    href: '/brands',
  },
  {
    icon: Layers3,
    title: 'Compare the details that matter',
    description: 'See the variant, pack format, quantity, price and availability before you order.',
    label: 'View all products',
    href: '/products',
  },
  {
    icon: CircleHelp,
    title: 'Ask when something is unclear',
    description: 'Get help with a product, an existing order or using the website.',
    label: 'Contact support',
    href: '/contact',
  },
];

export function AboutPage() {
  const location = useLocation();

  return (
    <>
      <SEOHead
        title="About Cigarro | Online Cigarette Store in India"
        description="Learn how Cigarro helps adult customers in India browse cigarette brands, compare pack options and find clear product information online."
        url={`https://cigarro.in${location.pathname}`}
        type="website"
        keywords={['about Cigarro', 'online cigarette store India', 'cigarette brands India']}
      />

      <main className="min-h-screen bg-background pb-20 md:pb-12">
        <section className="border-b border-border/30 bg-creme-light/40">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 lg:py-28">
            <div className="max-w-5xl">
              <p className="mb-5 text-xs sm:text-sm font-semibold uppercase tracking-[0.22em] text-canyon">
                About Cigarro
              </p>
              <h1 className="font-serif text-foreground text-4xl sm:text-6xl lg:text-7xl leading-[0.98] tracking-tight max-w-4xl">
                Buying cigarettes online should not feel confusing.
              </h1>
              <p className="mt-7 max-w-2xl text-lg sm:text-xl leading-relaxed text-muted-foreground">
                Cigarro is an online cigarette store for adult customers in India. We bring brands,
                variants, pack details and pricing together so you can find what you are looking for
                without working through vague listings.
              </p>
              <div className="mt-9 flex flex-col sm:flex-row gap-3">
                <Button asChild size="lg" className="bg-dark text-creme-light hover:bg-canyon">
                  <Link to="/products">
                    Browse products <ArrowRight className="ml-2 w-4 h-4" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link to="/brands">Explore brands</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20">
          <div className="grid lg:grid-cols-[0.8fr_1.2fr] gap-10 lg:gap-20 items-start">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-canyon mb-4">
                Why Cigarro exists
              </p>
              <h2 className="font-serif text-3xl sm:text-5xl leading-tight text-foreground">
                Clear information makes choosing simpler.
              </h2>
            </div>
            <div className="space-y-5 text-base sm:text-lg leading-relaxed text-muted-foreground">
              <p>
                Cigarette listings can be difficult to navigate. Product names vary, pack information
                is often incomplete, and availability is not always obvious.
              </p>
              <p>
                We built Cigarro to make that experience more straightforward. Products are organised
                by brand and category, while each listing is designed to show the variant, format,
                quantity and current price before you place an order.
              </p>
              <p>
                Cigarro is still improving. Our focus is practical: clearer product information, a
                better-organised catalogue and support that is easy to reach when something is unclear.
              </p>
            </div>
          </div>
        </section>

        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-14 sm:pb-20">
          <div className="grid md:grid-cols-3 gap-5">
            {waysToBrowse.map((item) => (
              <Card key={item.title} className="border-2 border-border/40 bg-card h-full">
                <CardContent className="p-7 sm:p-8 flex flex-col h-full">
                  <div className="w-11 h-11 rounded-full bg-accent/10 flex items-center justify-center mb-6">
                    <item.icon className="w-5 h-5 text-accent" />
                  </div>
                  <h2 className="font-serif text-2xl text-foreground mb-3">{item.title}</h2>
                  <p className="text-muted-foreground leading-relaxed mb-7 flex-1">{item.description}</p>
                  <Link
                    to={item.href}
                    className="inline-flex items-center gap-2 text-sm font-semibold text-canyon hover:text-dark transition-colors"
                  >
                    {item.label} <ArrowRight className="w-4 h-4" />
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="rounded-2xl bg-dark text-creme-light p-7 sm:p-10 lg:p-14 grid lg:grid-cols-[auto_1fr] gap-6 lg:gap-10 items-start">
            <div className="w-12 h-12 rounded-full bg-creme-light/10 flex items-center justify-center">
              <ShieldAlert className="w-6 h-6 text-canyon-light" />
            </div>
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-canyon-light mb-3">
                Adults only
              </p>
              <h2 className="font-serif text-3xl sm:text-4xl mb-4">Tobacco is not an ordinary product.</h2>
              <p className="text-creme-light/75 leading-relaxed">
                Cigarro is intended only for adults of legal smoking age. Tobacco and nicotine products
                carry serious health risks and can be addictive. We do not encourage anyone who does not
                already use tobacco to begin.
              </p>
              <div className="mt-6 flex flex-wrap gap-x-6 gap-y-3 text-sm">
                <Link to="/terms" className="underline underline-offset-4 hover:text-canyon-light">Terms of service</Link>
                <Link to="/privacy" className="underline underline-offset-4 hover:text-canyon-light">Privacy policy</Link>
                <Link to="/contact" className="underline underline-offset-4 hover:text-canyon-light">Contact Cigarro</Link>
              </div>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
