
import { defineConfig } from "vite";
import { resolve } from "path";
import react from "@vitejs/plugin-react";
import { copyFileSync } from 'fs';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'copy-manifest',
      writeBundle() {
        try {
          copyFileSync('./public/manifest.json', './dist/manifest.json');
        } catch (e) {
          console.warn('Could not copy manifest.json:', e.message);
        }
      }
    }
  ],
  base: '/',
  
  // ===== ALIAS PATHS ENTERPRISE =====
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
      "@components": resolve(__dirname, "./src/components"),
      "@pages": resolve(__dirname, "./src/pages"),
      "@contexts": resolve(__dirname, "./src/contexts"),
      "@services": resolve(__dirname, "./src/services"),
      "@stores": resolve(__dirname, "./src/stores"),
      "@utils": resolve(__dirname, "./src/utils"),
      "@hooks": resolve(__dirname, "./src/hooks"),
    },
  },
  
  // ===== BUILD CONFIGURATION ENTERPRISE ===== 
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: 'terser',
    target: 'es2020',
    cssCodeSplit: true,
    
    // ===== ROLLUP OPTIONS ENTERPRISE =====
    rollupOptions: {
      output: {
        // ===== ENTERPRISE BUNDLE SPLITTING STRATEGY =====
        manualChunks: {
          // Core Framework - Highest Priority
          'vendor-react': ['react', 'react-dom'],
          
          // Router - Load Early  
          'vendor-router': ['react-router-dom'],
          
          // UI & Animation - Medium Priority
          'vendor-ui': ['framer-motion', 'lucide-react', 'react-hot-toast'],
          
          // Charts & Data Visualization - Lazy Load
          'vendor-charts': ['recharts', 'd3-scale'],
          
          // Backend & Data - Background Load
          'vendor-supabase': ['@supabase/supabase-js'],
          
          // Forms & Validation
          'vendor-forms': ['react-hook-form', '@hookform/resolvers', 'zod'],
          
          // Date & Utilities
          'vendor-utils': ['date-fns', 'clsx', 'uuid'],
          
          // State Management  
          'vendor-state': ['zustand'],
          
          // Logging & Analytics
          'vendor-analytics': ['winston', 'winston-daily-rotate-file'],
          
          // Network & Realtime
          'vendor-network': ['socket.io-client', 'ws'],
        },
        // ===== FILE NAMING STRATEGY ENTERPRISE =====
        chunkFileNames: (chunkInfo) => {
          const name = chunkInfo.name;
          
          // Vendor chunks - predictable loading order
          if (name.startsWith('vendor-')) {
            return 'assets/vendor/[name]-[hash].js';
          }
          
          // Feature-based chunks
          return 'assets/chunks/[name]-[hash].js';
        },
        assetFileNames: (assetInfo) => {
          // 🎨 ORGANIZAR ASSETS POR TIPO
          const extType = assetInfo.name.split('.').pop();
          
          if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(extType)) {
            return 'assets/images/[name]-[hash][extname]';
          }
          if (/css/i.test(extType)) {
            return 'assets/styles/[name]-[hash][extname]';
          }
          if (/woff2?|ttf|eot/i.test(extType)) {
            return 'assets/fonts/[name]-[hash][extname]';
          }
          
          return 'assets/misc/[name]-[hash][extname]';
        }
      }
    },
    // ===== CHUNK SIZE OPTIMIZATION =====
    chunkSizeWarningLimit: 1000, // Adjusted for enterprise bundles
    
    // ===== TERSER ENTERPRISE OPTIMIZATION =====
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        passes: 2,
        unsafe_comps: true,
        unsafe_math: true,
        pure_funcs: ['console.info', 'console.debug', 'console.warn']
      },
      mangle: {
        safari10: true,
        toplevel: true,
      },
      format: {
        comments: false,
      },
    }
  },
  
  // ===== DEV SERVER ENTERPRISE =====
  server: {
    host: "0.0.0.0",
    port: 3000,
    strictPort: true,
    
    // ===== HMR CONFIGURATION - FIX WEBSOCKET =====
    hmr: {
      port: 3000,
      host: 'localhost',
      clientPort: 3000,
    },
    
    // ===== SECURITY HEADERS ENTERPRISE =====
    headers: {
      'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' https://*.supabase.co; font-src 'self' data:; connect-src 'self' *.supabase.co *.n8n.cloud wss: ws:;",
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
    }
  },
  
  // ===== OPTIMIZATION DEPENDENCIES =====
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      '@supabase/supabase-js',
      'recharts',
      'framer-motion',
      'lucide-react',
      'date-fns',
      'react-hot-toast',
      'clsx',
      'zustand',
    ],
    exclude: [
      // Exclude problematic dependencies
    ],
  }
});
