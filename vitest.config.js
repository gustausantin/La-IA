import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    // Configuración de testing de clase mundial 🏆
    environment: 'jsdom',
    
    // Setup files que se ejecutan antes de cada test
    setupFiles: ['./src/test/setup.js'],
    
    // Archivos a incluir en los tests
    include: [
      'src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
      'tests/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'
    ],
    
    // Cobertura de código (coverage)
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        '**/*.config.js',
        '**/vite.config.js',
        '**/vitest.config.js',
        'dist/',
        'coverage/',
      ],
      // Objetivos de cobertura para app de clase mundial
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 85,
          statements: 85
        }
      }
    },
    
    // Globals para evitar imports repetitivos
    globals: true,
    
    // Watch mode para desarrollo
    watch: false,
    
    // Reporter más limpio
    reporter: ['verbose', 'html'],
    
    // Timeouts generosos para tests complejos
    testTimeout: 10000,
    hookTimeout: 10000,
    
    // Pool de workers para tests paralelos
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
        minThreads: 1,
        maxThreads: 4,
      }
    },
    
    // Configuración de mocks
    mockReset: true,
    clearMocks: true,
    restoreMocks: true,
    
    // Configuración de paths
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@pages': path.resolve(__dirname, './src/pages'),
      '@utils': path.resolve(__dirname, './src/utils'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
      '@services': path.resolve(__dirname, './src/services'),
      '@stores': path.resolve(__dirname, './src/stores'),
      '@test': path.resolve(__dirname, './src/test'),
    }
  },
  
  // Resolver paths para imports
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@pages': path.resolve(__dirname, './src/pages'),
      '@utils': path.resolve(__dirname, './src/utils'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
      '@services': path.resolve(__dirname, './src/services'),
      '@stores': path.resolve(__dirname, './src/stores'),
      '@test': path.resolve(__dirname, './src/test'),
    }
  }
})
