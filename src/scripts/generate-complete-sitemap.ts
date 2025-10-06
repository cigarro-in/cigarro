#!/usr/bin/env node
/**
 * Complete Sitemap Generation Script
 * Generates comprehensive sitemaps with all database content
 * Usage: npm run generate-complete-sitemap
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { 
  generateCompleteSitemap, 
  generateSitemapIndex,
  generateProductsSitemap,
  generateBlogSitemap
} from '../utils/dynamic-sitemap';

const BASE_URL = process.env.VITE_SITE_URL || 'https://cigarro.in';
const OUTPUT_DIR = join(process.cwd(), 'public');

async function main() {
  console.log('🚀 Generating complete SEO sitemaps...\n');

  try {
    // Ensure output directory exists
    mkdirSync(OUTPUT_DIR, { recursive: true });

    console.log('📄 Generating main sitemap with all content...');
    const mainSitemap = await generateCompleteSitemap(BASE_URL);
    const mainSitemapPath = join(OUTPUT_DIR, 'sitemap.xml');
    writeFileSync(mainSitemapPath, mainSitemap, 'utf-8');
    console.log('✅ Main sitemap generated at: public/sitemap.xml\n');

    console.log('📦 Generating products-specific sitemap...');
    const productsSitemap = await generateProductsSitemap(BASE_URL);
    const productsSitemapPath = join(OUTPUT_DIR, 'sitemap-products.xml');
    writeFileSync(productsSitemapPath, productsSitemap, 'utf-8');
    console.log('✅ Products sitemap generated at: public/sitemap-products.xml\n');

    console.log('📰 Generating blog-specific sitemap...');
    const blogSitemap = await generateBlogSitemap(BASE_URL);
    const blogSitemapPath = join(OUTPUT_DIR, 'sitemap-blog.xml');
    writeFileSync(blogSitemapPath, blogSitemap, 'utf-8');
    console.log('✅ Blog sitemap generated at: public/sitemap-blog.xml\n');

    console.log('📋 Generating sitemap index...');
    const sitemapIndex = await generateSitemapIndex(BASE_URL);
    const sitemapIndexPath = join(OUTPUT_DIR, 'sitemap-index.xml');
    writeFileSync(sitemapIndexPath, sitemapIndex, 'utf-8');
    console.log('✅ Sitemap index generated at: public/sitemap-index.xml\n');

    // Count URLs in main sitemap
    const urlCount = (mainSitemap.match(/<url>/g) || []).length;
    
    console.log('🎉 Complete sitemap generation successful!');
    console.log(`📊 Total URLs indexed: ${urlCount}`);
    console.log('\n📋 Files generated:');
    console.log('  • sitemap.xml (main sitemap with all content)');
    console.log('  • sitemap-products.xml (products only)');
    console.log('  • sitemap-blog.xml (blog posts only)');
    console.log('  • sitemap-index.xml (sitemap index)');
    
    console.log('\n🔗 Submit these URLs to Google Search Console:');
    console.log(`  • ${BASE_URL}/sitemap.xml`);
    console.log(`  • ${BASE_URL}/sitemap-index.xml`);
    
    console.log('\n📈 Next steps:');
    console.log('1. Deploy your site to make sitemaps accessible');
    console.log('2. Submit main sitemap to Google Search Console');
    console.log('3. Submit sitemap index for better organization');
    console.log('4. Monitor indexing status in Search Console');
    console.log('5. Re-run this script after adding new content');

  } catch (error) {
    console.error('❌ Error generating complete sitemaps:', error);
    process.exit(1);
  }
}

main();
