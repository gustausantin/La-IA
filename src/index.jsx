
import React from "react";
import ReactDOM from "react-dom/client";
import { Toaster } from "react-hot-toast";
import { AuthProvider } from "./contexts/AuthContext";
import App from "./App.jsx";
import "./index.css";
import logger from "./utils/logger.js";

logger.info('🚀 Starting React application...');

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
