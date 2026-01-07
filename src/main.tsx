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
    onRegistered(_r: any) {
      // Service worker registered
    },
    onRegisterError(_error: any) {
      // Registration error
    },
    registrationOptions: {
      updateViaCache: 'always',
    },
    immediate: true,
    onNeedRefresh: () => {
      // Need refresh callback
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
