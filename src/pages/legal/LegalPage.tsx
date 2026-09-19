import { Link, useLocation } from 'react-router-dom';
import { AlertTriangle, ArrowRight, FileText, RotateCcw, Shield, Truck } from 'lucide-react';
import { SEOHead } from '../../components/seo/SEOHead';
import { Card, CardContent } from '../../components/ui/card';

const policyLinks = [
  {
    icon: FileText,
    title: 'Terms of Service',
    description: 'The rules that apply when you browse the website, create an account or place an order.',
    href: '/terms',
  },
  {
    icon: Shield,
    title: 'Privacy Policy',
    description: 'What personal information we collect, why we use it and how to make a data request.',
    href: '/privacy',
  },
  {
    icon: Truck,
    title: 'Shipping Policy',
    description: 'Delivery availability, shipping options, tracking and age verification information.',
    href: '/shipping',
  },
  {
    icon: RotateCcw,
    title: 'Returns and Refunds',
    description: 'What to do when an order arrives damaged, defective or different from what you ordered.',
    href: '/returns',
  },
];

export function LegalPage() {
  const location = useLocation();

  return (
    <>
      <SEOHead
        title="Cigarro Policies | Terms, Privacy, Shipping and Returns"
        description="Find Cigarro's terms of service, privacy policy, shipping information and returns and refunds policy."
        url={`https://cigarro.in${location.pathname}`}
        type="website"
        keywords={['Cigarro policies', 'Cigarro terms', 'Cigarro privacy', 'Cigarro shipping', 'Cigarro returns']}
      />

      <main className="min-h-screen bg-background pb-20 md:pb-12">
        <section className="border-b border-border/30 bg-creme-light/40">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
            <p className="mb-5 text-xs sm:text-sm font-semibold uppercase tracking-[0.22em] text-canyon">
              Policies
            </p>
            <h1 className="font-serif text-foreground text-4xl sm:text-6xl leading-[1.02] tracking-tight max-w-4xl">
              The important information, without the fine-print maze.
            </h1>
            <p className="mt-6 max-w-2xl text-lg sm:text-xl leading-relaxed text-muted-foreground">
              Start with the policy that matches your question. Each page explains the current position
              and how to contact Cigarro when you need help.
            </p>
          </div>
        </section>

        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20">
          <Card className="mb-8 border-2 border-accent/20 bg-accent/5">
            <CardContent className="p-6 sm:p-7 flex items-start gap-4">
              <AlertTriangle className="w-6 h-6 text-accent shrink-0 mt-0.5" />
              <div>
                <h2 className="font-sans text-lg font-bold text-foreground mb-2">Adults of legal smoking age only</h2>
                <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
                  Tobacco and nicotine products carry serious health risks and can be addictive. Age
                  verification may be required before an order is accepted or delivered.
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="grid md:grid-cols-2 gap-5">
            {policyLinks.map((policy) => (
              <Link key={policy.href} to={policy.href} className="group">
                <Card className="h-full border-2 border-border/40 bg-card group-hover:border-accent/40 transition-colors">
                  <CardContent className="p-7 sm:p-8">
                    <div className="w-11 h-11 rounded-full bg-muted/40 flex items-center justify-center mb-6">
                      <policy.icon className="w-5 h-5 text-accent" />
                    </div>
                    <h2 className="font-serif text-2xl sm:text-3xl text-foreground mb-3">{policy.title}</h2>
                    <p className="text-muted-foreground leading-relaxed mb-6">{policy.description}</p>
                    <span className="inline-flex items-center gap-2 text-sm font-semibold text-canyon">
                      Read policy <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                    </span>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
