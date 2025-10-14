# Sitemap System

## 🎯 Overview

**ZERO-FRICTION** dynamic sitemap system for Cigarro.in. The sitemap automatically updates from your database with no manual intervention required.

## ✨ How It Works

- **Dynamic**: Sitemap is generated on-demand from live database
- **Automatic**: Updates whenever you add/edit products
- **Fast**: Cached for 1 hour for performance
- **Reliable**: Fallback sitemap if database is unavailable

## 🚀 Usage

**Nothing to do!** Just visit: `https://cigarro.in/sitemap.xml`

The sitemap automatically includes:
- All active products
- All categories  
- Static pages (homepage, products, etc.)

## 🔧 Manual Generation (Optional)

If you need to generate a static sitemap file:

```bash
cd scripts
node generate-sitemap.js
```

## 📋 What Gets Included

### ✅ Actual Content From Database:
- **Products** - All active products with images
- **Categories** - All categories with metadata  
- **Brands** - All unique brands from products
- **Static Pages** - Real routes only (homepage, products, cart, etc.)

### ❌ What's Excluded:
- Draft/inactive products
- Test/placeholder data
- Temporary routes
- Development-only pages
- User-specific pages (login, orders, profile)

## 🔧 Configuration

Edit `generate-sitemap.js` to customize:

```javascript
const BASE_URL = 'https://cigarro.in';
const MAX_URLS_PER_SITEMAP = 50000;
```

### Static Pages Configuration:

```javascript
const staticPages = [
  { url: '/', priority: 1.0, changefreq: 'daily' },
  { url: '/products', priority: 0.9, changefreq: 'daily' },
  // Add more real routes here
];
```

## 📁 Output

- `public/sitemap.xml` - Main sitemap
- `sitemap.xml` - Copy in root directory
- `sitemap-1.xml, sitemap-2.xml` - For sites >50k URLs

## 🔑 Environment Setup

Required environment variables:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
# OR
SUPABASE_SERVICE_KEY=your_service_key (for better performance)
```

## 📊 SEO Features

✅ **Google Best Practices**
- Priority scoring (0.0 - 1.0)
- Change frequency hints
- ISO 8601 date formatting
- XML escaping
- Image sitemap support

✅ **Automatic Handling**
- Splits into multiple sitemaps if >50k URLs
- Generates sitemap index
- Proper XML namespaces
- Image tags with titles

## 🔄 When to Regenerate

Run the script whenever you:
- Add new products
- Create new categories
- Add new brands
- Update static pages
- Before deploying to production

## 🤖 Automated Generation

Add to your deployment pipeline:

```json
// package.json
{
  "scripts": {
    "generate:sitemap": "node scripts/generate-sitemap.js",
    "prebuild": "npm run generate:sitemap"
  }
}
```

## 📍 Submission

After generation, submit to:
- **Google Search Console**: https://search.google.com/search-console
- **Bing Webmaster Tools**: https://www.bing.com/webmasters

Your sitemap URL: **https://cigarro.in/sitemap.xml**

## 🐛 Troubleshooting

**Error: Supabase credentials not found**
- Check your `.env` file
- Ensure `VITE_SUPABASE_URL` and key are set

**Empty sitemap generated**
- Check database connection
- Verify products are marked as `is_active: true`
- Check console output for errors

**Sitemap not updating**
- Delete old sitemap files
- Run script again
- Clear CDN cache if using one

## 📝 Best Practices

1. **Keep It Current** - Regenerate monthly or after major updates
2. **No Test Data** - Only include production content
3. **Validate** - Use Google's Sitemap Validator
4. **Monitor** - Check Search Console for crawl errors
5. **Compress** - Enable gzip for sitemap.xml on server

## ✨ Production Quality Checklist

- [x] No placeholder/dummy data
- [x] All URLs are real and accessible
- [x] Proper XML formatting
- [x] Image URLs are absolute
- [x] Dates are current and valid
- [x] Priority/frequency values are logical
- [x] Sitemap is validated
- [x] Submitted to search engines

---

**Last Updated**: October 14, 2025  
**Maintained By**: Cigarro Development Team
