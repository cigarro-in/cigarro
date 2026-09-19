import { Link, useLocation } from 'react-router-dom';
import { ArrowRight, Mail, MessageCircleQuestion, PackageSearch, RotateCcw } from 'lucide-react';
import { SEOHead } from '../../components/seo/SEOHead';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import { siteConfig } from '../../config/site';

const helpTopics = [
  {
    icon: PackageSearch,
    title: 'An existing order',
    description: 'Include your order number and the phone number used at checkout so we can identify it.',
  },
  {
    icon: MessageCircleQuestion,
    title: 'A product question',
    description: 'Send the product name or page link and tell us exactly what you need to know.',
  },
  {
    icon: RotateCcw,
    title: 'A damaged or incorrect item',
    description: 'Include your order number and clear photos. Review the returns policy before writing.',
  },
];

export function ContactPage() {
  const location = useLocation();
  const supportEmail = siteConfig.email.support;

  return (
    <>
      <SEOHead
        title="Contact Cigarro | Order and Product Support"
        description="Contact Cigarro for help with an order, a product listing, shipping or using the online store. Email support@cigarro.in."
        url={`https://cigarro.in${location.pathname}`}
        type="website"
        keywords={['contact Cigarro', 'Cigarro support', 'Cigarro order help']}
      />

      <main className="min-h-screen bg-background pb-20 md:pb-12">
        <section className="border-b border-border/30 bg-creme-light/40">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 lg:py-24">
            <div className="max-w-4xl">
              <p className="mb-5 text-xs sm:text-sm font-semibold uppercase tracking-[0.22em] text-canyon">
                Contact Cigarro
              </p>
              <h1 className="font-serif text-foreground text-4xl sm:text-6xl lg:text-7xl leading-[0.98] tracking-tight">
                Tell us what you need help with.
              </h1>
              <p className="mt-7 max-w-2xl text-lg sm:text-xl leading-relaxed text-muted-foreground">
                Questions about an order, a product listing or the website are all welcome. Send the
                useful details in your first message and we can give you a clearer answer.
              </p>
            </div>
          </div>
        </section>

        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20">
          <div className="grid lg:grid-cols-[0.9fr_1.1fr] gap-8 lg:gap-14 items-start">
            <Card className="border-2 border-accent/25 bg-accent/5 overflow-hidden">
              <CardContent className="p-7 sm:p-9">
                <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center mb-6">
                  <Mail className="w-6 h-6 text-accent" />
                </div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-canyon mb-3">
                  Email support
                </p>
                <h2 className="font-serif text-3xl sm:text-4xl text-foreground mb-4">
                  Email us directly.
                </h2>
                <p className="text-muted-foreground leading-relaxed mb-7">
                  Email is the current support channel for Cigarro. Send your question with the relevant
                  product link or order number and we will reply with the information available to us.
                </p>
                <Button asChild size="lg" className="w-full sm:w-auto bg-dark text-creme-light hover:bg-canyon">
                  <a href={`mailto:${supportEmail}`}>
                    Email {supportEmail} <ArrowRight className="ml-2 w-4 h-4" />
                  </a>
                </Button>
              </CardContent>
            </Card>

            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-canyon mb-4">
                Help us help you
              </p>
              <h2 className="font-serif text-3xl sm:text-5xl leading-tight text-foreground mb-7">
                Put the right details in your message.
              </h2>
              <div className="space-y-4">
                {helpTopics.map((topic) => (
                  <div key={topic.title} className="flex gap-4 p-5 sm:p-6 rounded-xl border border-border/40 bg-card">
                    <div className="w-10 h-10 rounded-full bg-muted/40 flex items-center justify-center shrink-0">
                      <topic.icon className="w-5 h-5 text-accent" />
                    </div>
                    <div>
                      <h3 className="font-sans text-lg font-bold text-foreground mb-1">{topic.title}</h3>
                      <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">{topic.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="rounded-2xl bg-dark text-creme-light p-7 sm:p-10 lg:p-12">
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
              <div className="md:col-span-2">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-canyon-light mb-3">
                  Before you write
                </p>
                <h2 className="font-serif text-3xl sm:text-4xl">The answer may already be here.</h2>
              </div>
              <div>
                <h3 className="font-semibold mb-3">Delivery</h3>
                <Link to="/shipping" className="inline-flex items-center gap-2 text-sm text-creme-light/70 hover:text-canyon-light">
                  Read shipping policy <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
              <div>
                <h3 className="font-semibold mb-3">Problems with an item</h3>
                <Link to="/returns" className="inline-flex items-center gap-2 text-sm text-creme-light/70 hover:text-canyon-light">
                  Read returns policy <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
