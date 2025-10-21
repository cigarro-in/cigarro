# Database Schema Reference - Cigarro Marketplace

**Last Updated:** October 21, 2025

This document contains all tables and their columns for quick reference.

---

## Table of Contents
1. [Addresses](#addresses)
2. [Bank Email Templates](#bank-email-templates)
3. [Blog System](#blog-system)
4. [Brands](#brands)
5. [Cart](#cart)
6. [Categories](#categories)
7. [Combos](#combos)
8. [Delivery & Shipping](#delivery--shipping)
9. [Discounts](#discounts)
10. [Featured Products](#featured-products)
11. [Hero Slides](#hero-slides)
12. [Homepage](#homepage)
13. [Orders](#orders)
14. [Payment Verification](#payment-verification)
15. [Products](#products)
16. [Profiles](#profiles)
17. [Reviews](#reviews)
18. [Site Settings](#site-settings)
19. [Wishlists](#wishlists)

---

## Addresses

### `addresses` (27 columns)
- `id` (uuid NOT NULL)
- `user_id` (uuid NOT NULL)
- `category` (USER-DEFINED)
- `label` (text NOT NULL)
- `is_primary` (boolean)
- `recipient_name` (text NOT NULL)
- `phone` (text NOT NULL)
- `alternate_phone` (text)
- `address_line_1` (text NOT NULL)
- `address_line_2` (text)
- `landmark` (text)
- `area` (text)
- `city` (text NOT NULL)
- `state` (text NOT NULL)
- `postal_code` (text NOT NULL)
- `country` (text)
- `latitude` (numeric)
- `longitude` (numeric)
- `delivery_instructions` (text)
- `preferred_delivery_time` (text)
- `address_quality_score` (integer)
- `verification_status` (USER-DEFINED)
- `usage_count` (integer)
- `last_used_at` (timestamp with time zone)
- `verified_at` (timestamp with time zone)
- `created_at` (timestamp with time zone)
- `updated_at` (timestamp with time zone)

### `saved_addresses` (16 columns)
- `id` (uuid)
- `user_id` (uuid)
- `label` (text)
- `full_name` (text)
- `phone` (text)
- `address` (text)
- `user_provided_address` (text)
- `city` (text)
- `state` (text)
- `pincode` (text)
- `country` (text)
- `latitude` (numeric)
- `longitude` (numeric)
- `is_default` (boolean)
- `created_at` (timestamp with time zone)
- `updated_at` (timestamp with time zone)

---

## Bank Email Templates

### `bank_email_templates` (21 columns)
- `id` (uuid NOT NULL)
- `bank_name` (text NOT NULL)
- `email_domain` (text NOT NULL)
- `subject_pattern` (text)
- `amount_pattern` (text NOT NULL)
- `reference_pattern` (text)
- `sender_vpa_pattern` (text)
- `receiver_vpa_pattern` (text)
- `timestamp_pattern` (text)
- `transaction_id_pattern` (text)
- `is_active` (boolean)
- `priority` (integer)
- `last_tested_at` (timestamp with time zone)
- `success_rate` (numeric)
- `total_attempts` (integer)
- `successful_parses` (integer)
- `sample_email_subject` (text)
- `sample_email_body` (text)
- `notes` (text)
- `created_at` (timestamp with time zone)
- `updated_at` (timestamp with time zone)

---

## Blog System

### `blog_posts` (31 columns)
- `id` (uuid NOT NULL)
- `title` (character varying NOT NULL)
- `slug` (character varying NOT NULL)
- `excerpt` (text)
- `content` (text NOT NULL)
- `featured_image` (text)
- `author_id` (uuid)
- `category_id` (uuid)
- `status` (character varying)
- `published_at` (timestamp with time zone)
- `reading_time` (integer)
- `view_count` (integer)
- `like_count` (integer)
- `is_featured` (boolean)
- `is_pinned` (boolean)
- `sort_order` (integer)
- `meta_title` (character varying)
- `meta_description` (character varying)
- `meta_keywords` (text)
- `canonical_url` (text)
- `og_title` (character varying)
- `og_description` (character varying)
- `og_image` (text)
- `structured_data` (jsonb)
- `social_title` (character varying)
- `social_description` (character varying)
- `social_image` (text)
- `gallery_images` (ARRAY)
- `attachments` (jsonb)
- `created_at` (timestamp with time zone)
- `updated_at` (timestamp with time zone)

### `blog_categories` (9 columns)
- `id` (uuid NOT NULL)
- `name` (character varying NOT NULL)
- `slug` (character varying NOT NULL)
- `description` (text)
- `color` (character varying)
- `is_active` (boolean)
- `sort_order` (integer)
- `created_at` (timestamp with time zone)
- `updated_at` (timestamp with time zone)

### `blog_tags` (7 columns)
- `id` (uuid NOT NULL)
- `name` (character varying NOT NULL)
- `slug` (character varying NOT NULL)
- `color` (character varying)
- `is_active` (boolean)
- `created_at` (timestamp with time zone)
- `updated_at` (timestamp with time zone)

### `blog_post_tags` (4 columns)
- `id` (uuid NOT NULL)
- `post_id` (uuid NOT NULL)
- `tag_id` (uuid NOT NULL)
- `created_at` (timestamp with time zone)

### `blog_comments` (13 columns)
- `id` (uuid NOT NULL)
- `post_id` (uuid NOT NULL)
- `author_id` (uuid)
- `parent_id` (uuid)
- `author_name` (character varying NOT NULL)
- `author_email` (character varying NOT NULL)
- `content` (text NOT NULL)
- `is_approved` (boolean)
- `is_spam` (boolean)
- `ip_address` (inet)
- `user_agent` (text)
- `created_at` (timestamp with time zone)
- `updated_at` (timestamp with time zone)

---

## Brands

### `brands` (15 columns)
- `id` (uuid NOT NULL)
- `name` (character varying NOT NULL)
- `slug` (character varying NOT NULL)
- `description` (text)
- `logo_url` (text)
- `website_url` (text)
- `is_active` (boolean)
- `is_featured` (boolean)
- `sort_order` (integer)
- `meta_title` (character varying)
- `meta_description` (text)
- `meta_keywords` (text)
- `created_at` (timestamp with time zone)
- `updated_at` (timestamp with time zone)
- `heritage` (jsonb)

---

## Cart

### `cart_items` (8 columns)
- `id` (uuid NOT NULL)
- `user_id` (uuid NOT NULL)
- `product_id` (uuid NOT NULL)
- `variant_id` (uuid)
- `combo_id` (uuid)
- `quantity` (integer NOT NULL)
- `created_at` (timestamp with time zone)
- `updated_at` (timestamp with time zone)

---

## Categories

### `categories` (10 columns)
- `id` (uuid NOT NULL)
- `name` (text NOT NULL)
- `slug` (text NOT NULL)
- `description` (text)
- `image` (text)
- `image_alt_text` (text)
- `meta_title` (text)
- `meta_description` (text)
- `created_at` (timestamp with time zone)
- `updated_at` (timestamp with time zone)

### `product_categories` (3 columns)
- `product_id` (uuid NOT NULL)
- `category_id` (uuid NOT NULL)
- `order` (integer)

---

## Combos

### `product_combos` (12 columns)
- `id` (uuid NOT NULL)
- `name` (character varying NOT NULL)
- `slug` (character varying NOT NULL)
- `description` (text)
- `combo_price` (numeric NOT NULL)
- `original_price` (numeric)
- `discount_percentage` (numeric)
- `combo_image` (text)
- `gallery_images` (ARRAY)
- `is_active` (boolean)
- `created_at` (timestamp with time zone)
- `updated_at` (timestamp with time zone)

### `combo_items` (7 columns)
- `id` (uuid NOT NULL)
- `combo_id` (uuid NOT NULL)
- `product_id` (uuid NOT NULL)
- `variant_id` (uuid)
- `quantity` (integer NOT NULL)
- `sort_order` (integer)
- `created_at` (timestamp with time zone)

---

## Delivery & Shipping

### `delivery_zones` (20 columns)
- `id` (uuid NOT NULL)
- `zone_name` (text NOT NULL)
- `zone_type` (USER-DEFINED NOT NULL)
- `postal_code_pattern` (text)
- `state_codes` (ARRAY)
- `city_names` (ARRAY)
- `base_rate` (numeric)
- `per_kg_rate` (numeric)
- `fuel_surcharge_percent` (numeric)
- `peak_season_multiplier` (numeric)
- `standard_delivery_days` (integer)
- `express_delivery_days` (integer)
- `same_day_cutoff_time` (time without time zone)
- `services_available` (ARRAY)
- `cod_available` (boolean)
- `return_pickup_available` (boolean)
- `is_active` (boolean)
- `priority` (integer)
- `created_at` (timestamp with time zone)
- `updated_at` (timestamp with time zone)

### `postal_codes` (29 columns)
- `id` (uuid NOT NULL)
- `postal_code` (text NOT NULL)
- `area` (text)
- `city` (text NOT NULL)
- `district` (text)
- `state` (text NOT NULL)
- `state_code` (text)
- `region` (text)
- `country` (text)
- `latitude` (numeric)
- `longitude` (numeric)
- `is_serviceable` (boolean)
- `zone_type` (USER-DEFINED)
- `standard_delivery_days` (integer)
- `express_delivery_days` (integer)
- `same_day_available` (boolean)
- `overnight_available` (boolean)
- `cod_available` (boolean)
- `return_pickup_available` (boolean)
- `installation_available` (boolean)
- `base_shipping_cost` (numeric)
- `express_shipping_cost` (numeric)
- `free_shipping_threshold` (numeric)
- `delivery_hub` (text)
- `sort_code` (text)
- `restrictions` (jsonb)
- `created_at` (timestamp with time zone)
- `updated_at` (timestamp with time zone)
- `last_verified_at` (timestamp with time zone)

### `pincode_lookup` (9 columns)
- `pincode` (text)
- `city` (text)
- `state` (text)
- `country` (text)
- `is_servicable` (boolean)
- `shipping_method` (text)
- `delivery_time_days` (integer)
- `shipping_cost` (numeric)
- `shipping_description` (text)

### `shipping_companies` (6 columns)
- `id` (uuid NOT NULL)
- `name` (text NOT NULL)
- `website` (text)
- `tracking_url_template` (text)
- `is_active` (boolean)
- `created_at` (timestamp with time zone)

---

## Discounts

### `discounts` (19 columns)
- `id` (uuid NOT NULL)
- `name` (character varying NOT NULL)
- `code` (character varying)
- `type` (character varying NOT NULL)
- `value` (numeric NOT NULL)
- `min_cart_value` (numeric)
- `max_discount_amount` (numeric)
- `applicable_to` (character varying)
- `product_ids` (ARRAY)
- `combo_ids` (ARRAY)
- `variant_ids` (ARRAY)
- `start_date` (timestamp with time zone)
- `end_date` (timestamp with time zone)
- `usage_limit` (integer)
- `usage_count` (integer)
- `is_active` (boolean)
- `created_at` (timestamp with time zone)
- `updated_at` (timestamp with time zone)
- `description` (text)

---

## Featured Products

### `featured_products` (7 columns)
- `id` (uuid NOT NULL)
- `product_id` (uuid)
- `display_order` (integer)
- `is_active` (boolean)
- `featured_type` (character varying)
- `created_at` (timestamp without time zone)
- `updated_at` (timestamp without time zone)

---

## Hero Slides

### `hero_slides` (21 columns)
- `id` (uuid NOT NULL)
- `title` (text NOT NULL)
- `suptitle` (text)
- `description` (text)
- `image_url` (text NOT NULL)
- `mobile_image_url` (text)
- `small_image_url` (text)
- `button_text` (text)
- `button_url` (text)
- `product_name` (text)
- `product_price` (text)
- `product_image_url` (text)
- `is_active` (boolean)
- `sort_order` (integer)
- `created_at` (timestamp with time zone)
- `updated_at` (timestamp with time zone)
- `text_position` (character varying)
- `text_color` (character varying)
- `overlay_opacity` (integer)
- `button_style` (character varying)
- `subtitle` (text)

---

## Homepage

### `homepage_sections` (4 columns)
- `id` (uuid NOT NULL)
- `title` (text NOT NULL)
- `slug` (text NOT NULL)
- `created_at` (timestamp with time zone)

### `homepage_section_categories` (2 columns)
- `section_id` (uuid NOT NULL)
- `category_id` (uuid NOT NULL)

### `homepage_component_config` (8 columns)
- `id` (uuid NOT NULL)
- `component_name` (text NOT NULL)
- `section_id` (uuid)
- `is_enabled` (boolean)
- `display_order` (integer)
- `config` (jsonb)
- `created_at` (timestamp with time zone)
- `updated_at` (timestamp with time zone)

### `section_configurations` (13 columns)
- `id` (uuid NOT NULL)
- `section_name` (text NOT NULL)
- `title` (text)
- `subtitle` (text)
- `description` (text)
- `background_image` (text)
- `button_text` (text)
- `button_url` (text)
- `max_items` (integer)
- `is_enabled` (boolean)
- `config` (jsonb)
- `created_at` (timestamp with time zone)
- `updated_at` (timestamp with time zone)

---

## Orders

### `orders` (51 columns) ⭐ MAIN ORDER TABLE
- `id` (uuid NOT NULL)
- `display_order_id` (text)
- `user_id` (uuid NOT NULL)
- `status` (USER-DEFINED)
- `subtotal` (numeric NOT NULL)
- `tax` (numeric NOT NULL)
- `shipping` (numeric)
- `discount` (numeric)
- `total` (numeric NOT NULL)
- `payment_method` (text NOT NULL)
- `upi_id` (text)
- `payment_confirmed` (boolean)
- `payment_confirmed_at` (timestamp with time zone)
- `payment_verified` (text)
- `payment_verified_at` (timestamp with time zone)
- `payment_verified_by` (uuid)
- `payment_rejection_reason` (text)
- `transaction_id` (text)
- `payment_proof_url` (text)
- `payment_link_email` (text)
- `payment_link_phone` (text)
- `discount_id` (uuid)
- `discount_amount` (numeric)
- `discount_code` (character varying)
- `shipping_name` (text NOT NULL)
- `shipping_address` (text NOT NULL)
- `shipping_city` (text NOT NULL)
- `shipping_state` (text NOT NULL)
- `shipping_zip_code` (text NOT NULL)
- `shipping_country` (text)
- `shipping_phone` (text)
- `shipping_company` (text)
- `tracking_id` (text)
- `tracking_link` (text)
- `tracking_number` (text)
- `shipping_method` (text)
- `shipping_notes` (text)
- `estimated_delivery` (timestamp with time zone)
- `shipped_at` (timestamp with time zone)
- `shipped_by` (uuid)
- `delivered_at` (timestamp with time zone)
- `delivered_by` (uuid)
- `delivery_notes` (text)
- `delivery_proof_url` (text)
- `created_at` (timestamp with time zone)
- `updated_at` (timestamp with time zone)
- `total_decimal` (numeric)
- `payment_verification_id` (uuid)
- `auto_verified` (boolean)
- `verification_attempts` (integer)
- `last_verification_attempt_at` (timestamp with time zone)

### `order_items` (13 columns)
- `id` (uuid NOT NULL)
- `order_id` (uuid NOT NULL)
- `product_id` (uuid NOT NULL)
- `product_name` (text NOT NULL)
- `product_brand` (text NOT NULL)
- `product_price` (numeric NOT NULL)
- `product_image` (text)
- `quantity` (integer NOT NULL)
- `variant_id` (uuid)
- `variant_name` (character varying)
- `combo_id` (uuid)
- `combo_name` (character varying)
- `created_at` (timestamp with time zone)

### `order_tracking_view` (33 columns) - VIEW
- `id` (uuid)
- `display_order_id` (text)
- `user_id` (uuid)
- `status` (USER-DEFINED)
- `subtotal` (numeric)
- `tax` (numeric)
- `shipping` (numeric)
- `total` (numeric)
- `payment_method` (text)
- `payment_confirmed` (boolean)
- `payment_confirmed_at` (timestamp with time zone)
- `payment_verified` (text)
- `transaction_id` (text)
- `shipping_company` (text)
- `tracking_id` (text)
- `tracking_link` (text)
- `shipping_method` (text)
- `shipping_notes` (text)
- `estimated_delivery` (timestamp with time zone)
- `created_at` (timestamp with time zone)
- `updated_at` (timestamp with time zone)
- `shipping_name` (text)
- `shipping_address` (text)
- `shipping_city` (text)
- `shipping_state` (text)
- `shipping_zip_code` (text)
- `shipping_country` (text)
- `shipping_phone` (text)
- `customer_name` (text)
- `customer_email` (text)
- `shipped_by_name` (text)
- `delivered_by_name` (text)
- `verified_by_name` (text)

---

## Payment Verification

### `payment_verifications` (27 columns) ⭐ DETAILED PAYMENT RECORDS
- `id` (uuid NOT NULL)
- `transaction_id` (text NOT NULL)
- `order_id` (uuid)
- `email_subject` (text)
- `email_body` (text)
- `email_from` (text)
- `email_received_at` (timestamp with time zone)
- `email_message_id` (text)
- `bank_name` (text)
- `upi_reference` (text)
- `amount` (numeric)
- `sender_vpa` (text)
- `receiver_vpa` (text)
- `payment_timestamp` (timestamp with time zone)
- `verification_status` (text)
- `verification_method` (text)
- `verified_at` (timestamp with time zone)
- `verified_by` (uuid)
- `amount_match` (boolean)
- `reference_match` (boolean)
- `time_window_match` (boolean)
- `confidence_score` (numeric)
- `raw_email_data` (jsonb)
- `parser_version` (text)
- `error_message` (text)
- `created_at` (timestamp with time zone)
- `updated_at` (timestamp with time zone)

### `payment_verification_logs` (14 columns) ⭐ VERIFICATION ATTEMPTS LOG
- `id` (uuid NOT NULL)
- `order_id` (uuid)
- `transaction_id` (text NOT NULL)
- `amount` (numeric NOT NULL)
- `status` (text NOT NULL)
- `email_found` (boolean)
- `email_parsed` (boolean)
- `amount_matched` (boolean)
- `bank_name` (text)
- `upi_reference` (text)
- `sender_vpa` (text)
- `error_message` (text)
- `created_at` (timestamp with time zone)
- `verified_at` (timestamp with time zone)

---

## Products

### `products` (40 columns) ⭐ MAIN PRODUCT TABLE
- `id` (uuid NOT NULL)
- `name` (text NOT NULL)
- `slug` (text NOT NULL)
- `brand` (text NOT NULL)
- `price` (numeric NOT NULL)
- `description` (text)
- `stock` (integer)
- `is_active` (boolean)
- `rating` (numeric)
- `review_count` (integer)
- `origin` (text)
- `pack_size` (text)
- `specifications` (jsonb)
- `gallery_images` (ARRAY)
- `image_alt_text` (text)
- `meta_title` (text)
- `meta_description` (text)
- `created_at` (timestamp with time zone)
- `updated_at` (timestamp with time zone)
- `image_url` (text)
- `is_featured` (boolean)
- `is_showcase` (boolean)
- `showcase_order` (integer)
- `featured_order` (integer)
- `meta_keywords` (text)
- `canonical_url` (text)
- `og_title` (text)
- `og_description` (text)
- `og_image` (text)
- `twitter_title` (text)
- `twitter_description` (text)
- `twitter_image` (text)
- `structured_data` (jsonb)
- `seo_score` (integer)
- `brand_id` (uuid)
- `short_description` (text)
- `compare_at_price` (numeric)
- `cost_price` (numeric)
- `track_inventory` (boolean)
- `continue_selling_when_out_of_stock` (boolean)

### `product_variants` (23 columns)
- `id` (uuid NOT NULL)
- `product_id` (uuid NOT NULL)
- `variant_name` (character varying NOT NULL)
- `variant_type` (character varying NOT NULL)
- `price` (numeric NOT NULL)
- `weight` (numeric)
- `dimensions` (jsonb)
- `is_active` (boolean)
- `sort_order` (integer)
- `created_at` (timestamp with time zone)
- `updated_at` (timestamp with time zone)
- `variant_slug` (character varying)
- `meta_title` (text)
- `meta_description` (text)
- `meta_keywords` (text)
- `og_title` (text)
- `og_description` (text)
- `structured_data` (jsonb)
- `stock` (integer NOT NULL)
- `attributes` (jsonb)
- `compare_at_price` (numeric)
- `cost_price` (numeric)
- `track_inventory` (boolean)

### `variant_images` (12 columns)
- `id` (uuid NOT NULL)
- `variant_id` (uuid)
- `image_url` (text NOT NULL)
- `alt_text` (text)
- `sort_order` (integer)
- `is_primary` (boolean)
- `created_at` (timestamp with time zone)
- `title` (text)
- `caption` (text)
- `meta_description` (text)
- `lazy_load` (boolean)
- `product_id` (uuid)

### `products_with_discounts` (45 columns) - VIEW
- All columns from `products` table
- `discount_percentage` (integer)
- `profit_margin` (numeric)
- `savings_amount` (numeric)
- `brand_name` (character varying)
- `brand_logo` (text)

### `variants_with_discounts` (29 columns) - VIEW
- All columns from `product_variants` table
- `discount_percentage` (integer)
- `profit_margin` (numeric)
- `savings_amount` (numeric)
- `product_name` (text)
- `product_brand` (text)
- `product_brand_id` (uuid)

---

## Profiles

### `profiles` (6 columns)
- `id` (uuid NOT NULL)
- `email` (text NOT NULL)
- `name` (text NOT NULL)
- `is_admin` (boolean)
- `created_at` (timestamp with time zone)
- `updated_at` (timestamp with time zone)

---

## Reviews

### `product_reviews` (15 columns)
- `id` (uuid NOT NULL)
- `product_id` (uuid NOT NULL)
- `variant_id` (uuid)
- `user_id` (uuid)
- `reviewer_name` (character varying NOT NULL)
- `reviewer_email` (character varying)
- `rating` (integer NOT NULL)
- `title` (character varying)
- `content` (text NOT NULL)
- `is_verified_purchase` (boolean)
- `is_approved` (boolean)
- `helpful_votes` (integer)
- `total_votes` (integer)
- `created_at` (timestamp with time zone)
- `updated_at` (timestamp with time zone)

### `product_seo_analytics` (15 columns)
- `id` (uuid NOT NULL)
- `product_id` (uuid NOT NULL)
- `variant_id` (uuid)
- `page_views` (integer)
- `unique_visitors` (integer)
- `bounce_rate` (numeric)
- `avg_time_on_page` (integer)
- `conversion_rate` (numeric)
- `search_impressions` (integer)
- `search_clicks` (integer)
- `search_position` (numeric)
- `last_crawled` (timestamp with time zone)
- `last_indexed` (timestamp with time zone)
- `created_at` (timestamp with time zone)
- `updated_at` (timestamp with time zone)

---

## Site Settings

### `site_settings` (5 columns)
- `id` (integer NOT NULL)
- `site_name` (text)
- `favicon_url` (text)
- `meta_title` (text)
- `meta_description` (text)

---

## Wishlists

### `user_wishlists` (5 columns)
- `id` (uuid NOT NULL)
- `user_id` (uuid NOT NULL)
- `product_id` (uuid NOT NULL)
- `created_at` (timestamp with time zone)
- `updated_at` (timestamp with time zone)

---

## Quick Reference: Payment Verification Flow

### Tables Used for Payment Verification:
1. **`orders`** - Main order record with payment status fields
2. **`payment_verifications`** - Detailed payment record with email data
3. **`payment_verification_logs`** - Log of verification attempts
4. **`bank_email_templates`** - Email parsing templates

### Key Columns for Payment Updates:

**In `orders` table:**
- `payment_verified` (text) - "YES" when verified
- `payment_verified_at` (timestamp)
- `payment_confirmed` (boolean)
- `payment_confirmed_at` (timestamp)
- `auto_verified` (boolean)
- `verification_attempts` (integer)
- `status` (USER-DEFINED) - Set to 'confirmed'

**In `payment_verification_logs` table:**
- `status` (text) - 'pending', 'verified', 'failed'
- `email_found` (boolean)
- `email_parsed` (boolean)
- `amount_matched` (boolean)
- `bank_name` (text)
- `upi_reference` (text)
- `sender_vpa` (text)

**In `payment_verifications` table:**
- `verification_status` (text) - 'pending', 'verified', 'failed', 'duplicate', 'manual'
- `verification_method` (text) - 'email_parse', 'manual', 'api', 'webhook'
- `amount_match` (boolean)
- `confidence_score` (numeric)
- `raw_email_data` (jsonb)

---

## Total Tables: 41
## Total Views: 3
## Total Columns: ~700+

---

**Note:** This reference is auto-generated from the database schema. Always verify column names and types before making database changes.
