import { useEffect } from 'react';
import { generateSitemap } from '../../utils/sitemap-generator';

/**
 * Sitemap Route Component
 * Generates and serves dynamic XML sitemap
 */
export function SitemapRoute() {
  useEffect(() => {
    const serveSitemap = async () => {
      try {
        const sitemap = await generateSitemap('https://cigarro.in');
        
        // Set proper headers for XML
        const blob = new Blob([sitemap], { type: 'application/xml' });
        const url = URL.createObjectURL(blob);
        
        // Download or serve the sitemap
        const link = document.createElement('a');
        link.href = url;
        link.download = 'sitemap.xml';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } catch (error) {
        console.error('Error generating sitemap:', error);
      }
    };

    serveSitemap();
  }, []);

  return (
    <div className="main-container section">
      <div className="text-center py-16">
        <h1 className="text-3xl font-bold mb-4">Sitemap Generated</h1>
        <p className="text-muted-foreground">Your sitemap.xml has been generated and downloaded.</p>
      </div>
    </div>
  );
}
