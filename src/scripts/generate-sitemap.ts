#!/usr/bin/env node
/**
 * Sitemap Generation Script
 * Run this script to generate sitemap.xml and robots.txt
 * Usage: npm run generate-sitemap
 */

import { writeFileSync } from 'fs';
import { join } from 'path';
import { generateSitemap, generateRobotsTxt } from '../utils/sitemap-generator';

const BASE_URL = process.env.VITE_SITE_URL || 'https://cigarro.in';

async function main() {
  console.log('🚀 Generating SEO files...\n');

  try {
    // Generate sitemap
    console.log('📄 Generating sitemap.xml...');
    const sitemap = await generateSitemap(BASE_URL);
    const sitemapPath = join(process.cwd(), 'public', 'sitemap.xml');
    writeFileSync(sitemapPath, sitemap, 'utf-8');
    console.log('✅ Sitemap generated at: public/sitemap.xml\n');

    // Generate robots.txt
    console.log('🤖 Generating robots.txt...');
    const robotsTxt = await generateRobotsTxt(BASE_URL);
    const robotsPath = join(process.cwd(), 'public', 'robots.txt');
    writeFileSync(robotsPath, robotsTxt, 'utf-8');
    console.log('✅ Robots.txt generated at: public/robots.txt\n');

    console.log('🎉 SEO files generated successfully!');
    console.log('\nNext steps:');
    console.log('1. Deploy your site to make the files accessible');
    console.log('2. Submit sitemap to Google Search Console: https://search.google.com/search-console');
    console.log('3. Submit sitemap to Bing Webmaster Tools: https://www.bing.com/webmasters');
    console.log('4. Verify robots.txt at: ' + BASE_URL + '/robots.txt');
    console.log('5. Verify sitemap at: ' + BASE_URL + '/sitemap.xml');
  } catch (error) {
    console.error('❌ Error generating SEO files:', error);
    process.exit(1);
  }
}

main();
