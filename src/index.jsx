
import React from "react";
import ReactDOM from "react-dom/client";
import { Toaster } from "react-hot-toast";
import { AuthProvider } from "./contexts/AuthContext";
import App from "./App.jsx";
import "./index.css";
import logger from "./utils/logger.js";

logger.info('🚀 Starting React application...');

// 🔥 Limpiar Service Worker y caché en desarrollo (solo si está en localhost)
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
  // Limpiar Service Workers
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      registrations.forEach((registration) => {
        registration.unregister();
        logger.info('🧹 Service Worker desregistrado en modo desarrollo');
      });
    });
  }
  
  // Limpiar todas las cachés
  if ('caches' in window) {
    caches.keys().then((names) => {
      names.forEach((name) => {
        caches.delete(name);
        logger.info('🧹 Caché eliminada en modo desarrollo:', name);
      });
    });
  }
}

const root = ReactDOM.createRoot(document.getElementById("root"));

root.render(
  <AuthProvider>
    <App />
    <Toaster 
      position="top-right"
      toastOptions={{
        duration: 4000,
        style: {
          background: '#363636',
          color: '#fff',
        },
      }}
    />
  </AuthProvider>
);

logger.info('✅ React app rendered');
