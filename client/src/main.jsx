import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'sonner';

import App from './App.jsx';
import ErrorBoundary from './components/layout/ErrorBoundary.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { CartProvider } from './context/CartContext.jsx';
import { WishlistProvider } from './context/WishlistContext.jsx';
import { SettingsProvider } from './context/SettingsContext.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter
      // Opt in to the v7 behaviours now so the upgrade is a no-op later:
      // startTransition-wrapped navigation, and v7 relative path resolution
      // inside splat routes. Without these, React Router logs a warning on
      // every boot and silently changes navigation semantics on upgrade.
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <SettingsProvider>
        <AuthProvider>
          <CartProvider>
            <WishlistProvider>
              <App />
              <Toaster
                position="bottom-right"
                offset={20}
                toastOptions={{
                  classNames: {
                    toast:
                      'rounded-xl! border-line! bg-paper! text-ink! font-sans! shadow-none!',
                    title: 'text-[14px]! font-medium! text-ink!',
                    description: 'text-[13px]! text-muted!',
                    actionButton: 'rounded-full! bg-ink! text-paper!',
                    cancelButton: 'rounded-full! bg-surface-muted! text-ink!',
                    error: 'border-danger/40!',
                    success: 'border-success/40!',
                  },
                }}
              />
            </WishlistProvider>
          </CartProvider>
        </AuthProvider>
      </SettingsProvider>
    </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
);
