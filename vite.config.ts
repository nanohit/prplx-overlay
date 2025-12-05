import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  
  // Base URL for production builds
  base: './',
  
  // Build configuration
  build: {
    // Output to dist folder
    outDir: 'dist',
    
    // Ensure assets are properly handled
    assetsDir: 'assets',
    
    // Generate source maps for debugging (can be disabled for production)
    sourcemap: false,
    
    // Minify for production
    minify: 'esbuild',
    
    // Rollup options for bundling
    rollupOptions: {
      output: {
        // Ensure proper chunk splitting
        manualChunks: {
          vendor: ['react', 'react-dom'],
          markdown: ['react-markdown', 'rehype-katex', 'remark-gfm', 'remark-math'],
          syntax: ['react-syntax-highlighter'],
        },
      },
    },
    
    // Target modern browsers (Electron uses Chromium)
    target: 'esnext',
    
    // Increase chunk size warning limit
    chunkSizeWarningLimit: 1000,
  },
  
  // Resolve aliases
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  
  // Server configuration for development
  server: {
    port: 5180,
    strictPort: true,
    host: true,
  },
  
  // Preview server configuration
  preview: {
    port: 5180,
    strictPort: true,
  },
  
  // Optimization
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-markdown', 'lucide-react'],
    exclude: ['electron'],
  },
  
  // Define globals for Electron
  define: {
    // Prevent vite from replacing these in code
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production'),
  },
})
