import React, { useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { useRegisterSW } from 'virtual:pwa-register/react'

// Suppress react-beautiful-dnd defaultProps deprecation warning
// This is a known issue with the library and React 18+
const originalError = console.error;
console.error = (...args) => {
  if (args[0]?.includes?.('defaultProps will be removed')) {
    return;
  }
  originalError.apply(console, args);
};

const UpdateSW = () => {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r: any) {
      // console.log('SW Registered: ' + r)
    },
    onRegisterError(error: any) {
      // console.log('SW registration error', error)
    },
    // Add auto-update configuration
    registrationOptions: {
      updateViaCache: 'always',
    },
    // Check for updates periodically
    immediate: true,
    onNeedRefresh: () => {
      // console.log('SW needs refresh')
    },
  })

  const close = () => {
    setNeedRefresh(false)
  }

  useEffect(() => {
    if (needRefresh) {
      updateServiceWorker(true)
    }
  }, [needRefresh, updateServiceWorker])

  return null
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
    <UpdateSW />
  </React.StrictMode>,
)
