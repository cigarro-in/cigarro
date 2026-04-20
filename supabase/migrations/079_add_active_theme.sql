-- Add active_theme column to site_settings
-- Used by the theme system to determine which storefront template renders

ALTER TABLE site_settings
  ADD COLUMN IF NOT EXISTS active_theme TEXT NOT NULL DEFAULT 'classic';
