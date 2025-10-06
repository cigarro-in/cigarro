# SEO Setup Guide - Cigarro Marketplace

## 📋 Overview

This guide covers the comprehensive SEO implementation for Cigarro, including sitemap generation, robots.txt configuration, structured data, and AI/LLM optimization.

## 🚀 Quick Start

### 1. Generate SEO Files

```bash
# Generate sitemap.xml and robots.txt
npm run generate-sitemap

# Or use the alias
npm run seo
```

### 2. Deploy Files

The following files are automatically generated and should be deployed:

- `public/sitemap.xml` - Dynamic sitemap with all pages
- `public/robots.txt` - Search engine crawling rules
- `llms.txt` - AI/LLM optimization file

## 📁 SEO Files Structure

### 1. **robots.txt** (Root Directory)
- **Location**: `/robots.txt`
- **Purpose**: Controls search engine crawling
- **Features**:
  - Allows all major search engines
  - Blocks admin and private areas
  - Optimized crawl delays for different bots
  - AI/LLM crawler support (GPTBot, Claude, Perplexity)

### 2. **sitemap.xml** (Auto-generated)
- **Location**: `/sitemap.xml`
- **Purpose**: Helps search engines discover all pages
- **Includes**:
  - Static pages (home, products, about, etc.)
  - Dynamic product pages
  - Category pages
  - Brand pages
  - Blog posts
- **Update Frequency**: Generate before each deployment

### 3. **llms.txt** (AI Optimization)
- **Location**: `/llms.txt`
- **Purpose**: Optimizes content for AI/LLM crawlers
- **Contains**:
  - Business information
  - Product categories
  - Key pages and descriptions
  - SEO keywords
  - Technical stack info

## 🛠️ Implementation Details

### Sitemap Generator (`src/utils/sitemap-generator.ts`)

Automatically generates sitemap with:
- **Static pages** with priority and change frequency
- **Products** from Supabase database
- **Categories** with proper URLs
- **Brands** with slugs
- **Blog posts** (published only)

```typescript
import { generateSitemap } from './utils/sitemap-generator';

const sitemap = await generateSitemap('https://cigarro.in');
```

### SEO Head Component (`src/components/seo/SEOHead.tsx`)

Comprehensive SEO meta tags component:

```tsx
import { SEOHead } from '@/components/seo/SEOHead';

<SEOHead
  title="Premium Marlboro Cigarettes"
  description="Buy authentic Marlboro cigarettes online"
  keywords={['marlboro', 'premium cigarettes', 'buy online']}
  type="product"
  price="450"
  brand="Marlboro"
  category="Cigarettes"
/>
```

## 📊 Structured Data

### Implemented Schema Types:

1. **Organization Schema**
   - Company information
   - Contact details
   - Social media links

2. **Product Schema**
   - Product details
   - Pricing information
   - Availability status
   - Brand information

3. **Article Schema**
   - Blog post metadata
   - Author information
   - Publish dates

4. **WebSite Schema**
   - Site search functionality
   - Navigation structure

## 🔍 Search Engine Optimization

### Meta Tags Included:

- ✅ Title tags (optimized)
- ✅ Meta descriptions
- ✅ Keywords
- ✅ Canonical URLs
- ✅ Open Graph (Facebook)
- ✅ Twitter Cards
- ✅ Robots directives
- ✅ Geo tags (India)
- ✅ Mobile optimization

### Robots.txt Configuration:

```
User-agent: *
Allow: /

# Sitemap
Sitemap: https://cigarro.in/sitemap.xml

# Block private areas
Disallow: /admin
Disallow: /checkout
Disallow: /cart

# AI Crawlers
User-agent: GPTBot
Allow: /
Crawl-delay: 2
```

## 🤖 AI/LLM Optimization

### Supported AI Crawlers:

- **GPTBot** (OpenAI/ChatGPT)
- **ChatGPT-User** (ChatGPT browsing)
- **CCBot** (Common Crawl)
- **anthropic-ai** (Claude)
- **Claude-Web** (Claude browsing)
- **PerplexityBot** (Perplexity AI)

### llms.txt Structure:

```
# About Cigarro
[Business description]

# Product Categories
[Category listings]

# Key Pages
> /products
Complete product catalog

# SEO Keywords
[Keyword list]
```

## 📈 Google Search Console Setup

### 1. Submit Sitemap

1. Go to [Google Search Console](https://search.google.com/search-console)
2. Add property: `cigarro.in`
3. Navigate to **Sitemaps**
4. Submit: `https://cigarro.in/sitemap.xml`

### 2. Verify Ownership

Use one of these methods:
- HTML file upload
- Meta tag (already in `<head>`)
- Google Analytics
- Google Tag Manager

### 3. Monitor Performance

Track:
- Indexing status
- Search queries
- Click-through rates
- Mobile usability
- Core Web Vitals

## 🔧 Bing Webmaster Tools

1. Go to [Bing Webmaster Tools](https://www.bing.com/webmasters)
2. Add site: `cigarro.in`
3. Submit sitemap: `https://cigarro.in/sitemap.xml`
4. Verify ownership

## 🎯 SEO Best Practices

### On-Page SEO:

1. **Title Tags**: 50-60 characters
2. **Meta Descriptions**: 150-160 characters
3. **Headers**: Proper H1-H6 hierarchy
4. **Images**: Alt tags and optimized sizes
5. **URLs**: Clean, descriptive slugs
6. **Internal Linking**: Related products/content

### Technical SEO:

1. **Page Speed**: Optimized with Vite
2. **Mobile-First**: Responsive design
3. **HTTPS**: Secure connections
4. **Structured Data**: Schema.org markup
5. **Canonical URLs**: Prevent duplicates
6. **XML Sitemap**: Auto-generated

### Content SEO:

1. **Unique Content**: Original product descriptions
2. **Keywords**: Natural placement
3. **Blog Posts**: Regular updates
4. **User Reviews**: Social proof
5. **FAQ Sections**: Answer queries

## 📱 Mobile Optimization

- ✅ Responsive design
- ✅ Mobile-friendly meta tags
- ✅ Touch-friendly buttons
- ✅ Fast loading times
- ✅ Progressive Web App ready

## 🔄 Maintenance

### Regular Tasks:

1. **Weekly**: Generate new sitemap
2. **Monthly**: Review Search Console data
3. **Quarterly**: Update keywords
4. **Yearly**: SEO audit

### Sitemap Updates:

```bash
# Before each deployment
npm run generate-sitemap

# Verify generation
ls -la public/sitemap.xml
```

## 📊 Analytics Integration

### Google Analytics 4

Add to `index.html`:

```html
<!-- Google Analytics -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-XXXXXXXXXX');
</script>
```

### Google Tag Manager

```html
<!-- Google Tag Manager -->
<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-XXXXXXX');</script>
```

## 🚀 Deployment Checklist

- [ ] Generate sitemap: `npm run generate-sitemap`
- [ ] Verify robots.txt is in public folder
- [ ] Verify llms.txt is in root
- [ ] Update base URL in sitemap generator
- [ ] Submit sitemap to Google Search Console
- [ ] Submit sitemap to Bing Webmaster Tools
- [ ] Verify all meta tags are present
- [ ] Test structured data with [Rich Results Test](https://search.google.com/test/rich-results)
- [ ] Check mobile-friendliness
- [ ] Verify canonical URLs
- [ ] Test page speed with PageSpeed Insights

## 🔗 Useful Links

- [Google Search Console](https://search.google.com/search-console)
- [Bing Webmaster Tools](https://www.bing.com/webmasters)
- [Rich Results Test](https://search.google.com/test/rich-results)
- [PageSpeed Insights](https://pagespeed.web.dev/)
- [Schema.org](https://schema.org/)
- [Open Graph Protocol](https://ogp.me/)

## 📝 Notes

- Sitemap auto-updates with database changes
- Robots.txt blocks admin and private areas
- AI crawlers have optimized crawl delays
- Structured data validates with Google's tools
- Mobile-first indexing ready
- Core Web Vitals optimized

## 🎉 Success Metrics

Track these KPIs:
- **Organic Traffic**: Google Analytics
- **Search Rankings**: Google Search Console
- **Click-Through Rate**: Search Console
- **Indexing Status**: Search Console
- **Core Web Vitals**: PageSpeed Insights
- **Backlinks**: Ahrefs/SEMrush

---

**Last Updated**: 2025-10-06
**Maintained By**: Cigarro Development Team
