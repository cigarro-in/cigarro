-- Product ratings (SEO aggregateRating pipeline).
-- Run this in the Supabase dashboard SQL editor, then product pages will emit
-- aggregateRating JSON-LD automatically once review_count > 0.
alter table public.products
  add column if not exists rating_value numeric(2, 1) null
    check (rating_value >= 0 and rating_value <= 5),
  add column if not exists review_count integer not null default 0
    check (review_count >= 0);
