-- Migration: Update Products Table
-- Version: 0013
-- Description: Removes the redundant 'image' column and relies on the 'gallery_images' array.

-- 1. ALTER PRODUCTS TABLE
------------------------------------------------------------
ALTER TABLE public.products DROP COLUMN IF EXISTS image;
