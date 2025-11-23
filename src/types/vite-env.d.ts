/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

declare module 'virtual:pwa-register/react' {
  import type { Dispatch, SetStateAction } from 'react'
  import type { RegisterSWOptions } from 'vite-plugin-pwa/types'

  export interface RegisterSWHook {
    needRefresh: [boolean, Dispatch<SetStateAction<boolean>>]
    offlineReady: [boolean, Dispatch<SetStateAction<boolean>>]
    updateServiceWorker: (reloadPage?: boolean) => Promise<void>
  }

  export function useRegisterSW(options?: RegisterSWOptions & { registrationOptions?: any }): RegisterSWHook
}


// Augment React definitions to include fetchpriority
import 'react';

declare module 'react' {
  interface ImgHTMLAttributes<T> extends HTMLAttributes<T> {
    fetchpriority?: 'high' | 'low' | 'auto';
  }
}

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
