/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_APP_NAME: string
  readonly VITE_APP_URL: string
  readonly VITE_APP_ENV: string
  readonly VITE_ENABLE_ANALYTICS: string
  readonly VITE_ENABLE_ERROR_REPORTING: string
  readonly VITE_PAYMENT_GATEWAY_KEY: string
  readonly VITE_GOOGLE_ANALYTICS_ID: string
  readonly VITE_SENTRY_DSN: string
  readonly VITE_ENABLE_ADMIN_PANEL: string
  readonly VITE_ENABLE_BLOG: string
  readonly VITE_ENABLE_WISHLIST: string
  readonly VITE_API_TIMEOUT: string
  readonly VITE_MAX_FILE_SIZE: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
