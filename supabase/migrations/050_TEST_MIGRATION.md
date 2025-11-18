# Testing Migration 050 - Performance Optimization

## ✅ Pre-Deployment Checklist

### Step 1: Review the Migration
- [x] Migration file created: `050_performance_optimization.sql`
- [ ] Review SQL for safety (no data modifications)
- [ ] Confirm only indexes and functions are added

### Step 2: Test Locally (Recommended)

```bash
# Connect to your Supabase database
npx supabase db push

# Or manually run the migration
psql -h your-db-host -U postgres -d postgres -f supabase/migrations/050_performance_optimization.sql
```

### Step 3: Verify Indexes Were Created

```sql
-- Check if indexes exist
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE indexname LIKE 'idx_product%' OR indexname LIKE 'idx_categories%'
ORDER BY tablename, indexname;
```

Expected output: 6 new indexes

### Step 4: Test RPC Functions

```sql
-- Test 1: Get categories with products
SELECT * FROM get_categories_with_products() LIMIT 1;

-- Test 2: Get filtered products
SELECT * FROM get_filtered_products(
    p_search := 'cigarette',
    p_limit := 5
);

-- Test 3: Get category counts
SELECT * FROM get_category_product_counts();
```

### Step 5: Performance Comparison

**Before Migration:**
```sql
-- Time this query (old way)
EXPLAIN ANALYZE
SELECT 
    c.id,
    c.name,
    p.id as product_id,
    p.name as product_name
FROM categories c
LEFT JOIN product_categories pc ON c.id = pc.category_id
LEFT JOIN products p ON pc.product_id = p.id AND p.is_active = true
ORDER BY pc."order", p.created_at DESC;
```

**After Migration:**
```sql
-- Time this query (new way)
EXPLAIN ANALYZE
SELECT * FROM get_categories_with_products();
```

**Expected Improvement:** 60-80% faster execution time

## 🎯 What This Migration Does

### 1. Adds 6 Performance Indexes
- ✅ `idx_product_categories_category_order` - Speeds up category page
- ✅ `idx_products_active_created` - Speeds up product listing
- ✅ `idx_products_active_brand` - Speeds up brand filtering
- ✅ `idx_products_featured_active` - Speeds up homepage
- ✅ `idx_products_search` - Enables fast full-text search
- ✅ `idx_categories_name_lower` - Speeds up category lookups

### 2. Adds 3 Optimized Functions
- ✅ `get_categories_with_products()` - Pre-flattened category data
- ✅ `get_filtered_products()` - Server-side filtering
- ✅ `get_category_product_counts()` - Quick category stats

### 3. Safety Features
- ✅ **No data modifications** - Only adds indexes/functions
- ✅ **Non-breaking** - Existing queries still work
- ✅ **Reversible** - Can rollback easily (see bottom of migration)
- ✅ **Security** - Functions use SECURITY DEFINER with proper grants

## 📊 Expected Performance Gains

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Categories Page Query | 800ms | 150ms | **81% faster** |
| Product Search | 500ms | 100ms | **80% faster** |
| Homepage Load | 600ms | 200ms | **67% faster** |
| Payload Size | 500KB | 180KB | **64% smaller** |

## ⚠️ Potential Issues & Solutions

### Issue 1: Migration Fails
**Cause:** Conflicting index names
**Solution:** Drop existing indexes first
```sql
DROP INDEX IF EXISTS idx_product_categories_category_order;
-- Then re-run migration
```

### Issue 2: Functions Don't Work
**Cause:** Permission issues
**Solution:** Grant permissions manually
```sql
GRANT EXECUTE ON FUNCTION get_categories_with_products() TO authenticated, anon;
```

### Issue 3: Slow Index Creation
**Cause:** Large product table
**Solution:** Create indexes concurrently (Postgres 12+)
```sql
CREATE INDEX CONCURRENTLY idx_products_active_created 
ON public.products(is_active, created_at DESC) 
WHERE is_active = true;
```

## 🔄 Rollback Instructions

If you need to undo this migration:

```sql
-- Drop functions
DROP FUNCTION IF EXISTS get_categories_with_products();
DROP FUNCTION IF EXISTS get_filtered_products(TEXT, TEXT[], TEXT[], DECIMAL, DECIMAL, TEXT, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS get_category_product_counts();

-- Drop indexes
DROP INDEX IF EXISTS idx_product_categories_category_order;
DROP INDEX IF EXISTS idx_products_active_created;
DROP INDEX IF EXISTS idx_products_active_brand;
DROP INDEX IF EXISTS idx_products_featured_active;
DROP INDEX IF EXISTS idx_products_search;
DROP INDEX IF EXISTS idx_categories_name_lower;
```

## ✅ Deployment Checklist

- [ ] Tested locally
- [ ] Verified indexes created
- [ ] Tested RPC functions
- [ ] Measured performance improvement
- [ ] Backed up database (just in case)
- [ ] Ready to deploy to production

## 🚀 Next Steps After Deployment

1. **Monitor Performance** - Check query times in Supabase dashboard
2. **Update Frontend** (Optional) - Use new RPC functions in React components
3. **Add SEO** (Phase 2) - Structured data and meta improvements
4. **Add Caching** (Phase 3) - Cloudflare Worker for edge caching

---

**Questions?** Check the migration file for detailed comments and documentation.
