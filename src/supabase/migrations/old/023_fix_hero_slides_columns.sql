-- Migration: Add missing columns to hero_slides table
-- Version: 0023
-- Description: Add subtitle, description, mobile_image_url, and small_image_url columns to hero_slides

-- Add missing columns to hero_slides table
ALTER TABLE hero_slides
ADD COLUMN IF NOT EXISTS subtitle TEXT,
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS mobile_image_url TEXT,
ADD COLUMN IF NOT EXISTS small_image_url TEXT,
ADD COLUMN IF NOT EXISTS button_text TEXT,
ADD COLUMN IF NOT EXISTS button_url TEXT,
ADD COLUMN IF NOT EXISTS product_name TEXT,
ADD COLUMN IF NOT EXISTS product_price TEXT,
ADD COLUMN IF NOT EXISTS product_image_url TEXT;

-- Set default values for existing records
UPDATE hero_slides
SET
  subtitle = COALESCE(subtitle, ''),
  description = COALESCE(description, ''),
  mobile_image_url = COALESCE(mobile_image_url, ''),
  small_image_url = COALESCE(small_image_url, ''),
  button_text = COALESCE(button_text, ''),
  button_url = COALESCE(button_url, ''),
  product_name = COALESCE(product_name, ''),
  product_price = COALESCE(product_price, ''),
  product_image_url = COALESCE(product_image_url, '')
WHERE
  subtitle IS NULL OR
  description IS NULL OR
  mobile_image_url IS NULL OR
  small_image_url IS NULL OR
  button_text IS NULL OR
  button_url IS NULL OR
  product_name IS NULL OR
  product_price IS NULL OR
  product_image_url IS NULL;
