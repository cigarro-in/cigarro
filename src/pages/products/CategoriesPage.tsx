import { useOrgInfo } from '../../lib/org/OrgContext';
import { useCategoriesHub } from '../../hooks/data/useCatalog';
import { useStoreSettings } from '../../hooks/data/useStoreSettings';
import { Product } from '../../hooks/useCart';
import { useInlineStatus, InlineStatus } from '../../components/common/InlineStatus';
import { ProductCard } from '../../components/products/ProductCard';
import { useCart } from '../../hooks/useCart';
import { SEOHead } from '../../components/seo/SEOHead';
import { hubSeo, hubItemListJsonLd } from '../../lib/seo/hubSeo';
import { BreadcrumbSchema } from '../../components/seo/BreadcrumbSchema';

// Categories hub (classic theme). Derived from the catalog on the first render,
// so the server render lists every category with products.
export function CategoriesPage() {
  const { addToCart, isLoading } = useCart();
  const { status: opStatus, setError: setOpError, setOk: setOpOk } = useInlineStatus();
  const { primaryHost } = useOrgInfo();
  const { settings: store } = useStoreSettings();
  const { categories, loading } = useCategoriesHub();
  const seo = hubSeo('/categories', store.name);
  const site = `https://${primaryHost}`;

  const handleAddToCart = async (product: Product) => {
    try {
      await addToCart(product);
      setOpOk(`${product.name} added to cart`);
    } catch (error) {
      setOpError('Failed to add to cart');
    }
  };

  return (
    <>
      <SEOHead
        title={seo.title}
        titleVerbatim
        description={seo.description}
        url="/categories"
        extraJsonLd={[
          hubItemListJsonLd(
            seo.listName,
            categories.map((c) => ({ name: c.name, url: `${site}/category/${c.slug}` })),
          ),
        ]}
      />
      <BreadcrumbSchema items={[{ name: 'Home', url: `${site}/` }, { name: seo.crumb, url: `${site}/categories` }]} />

      <div className="py-12 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h1 className="font-serif-premium text-4xl sm:text-5xl text-foreground">Our Categories</h1>
            <p className="font-sans-premium text-lg text-muted-foreground mt-4">
              Explore our curated categories of premium products.
            </p>
          </div>
          <div className="mb-8">
            <InlineStatus status={opStatus} />
          </div>

        <div className="space-y-16">
          {loading
            ? null
            : categories.map(category => (
            <section key={category.id}>
              <h2 className="font-serif-premium text-2xl sm:text-3xl text-foreground mb-4 sm:mb-6">{category.name}</h2>
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-8">
                {category.products.map((product, index) => (
                  <ProductCard
                    key={product.id}
                    product={product as unknown as Product}
                    variant="default"
                    onAddToCart={(p) => handleAddToCart(p)}
                    isLoading={isLoading}
                    index={index}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
    </>
  );
}
