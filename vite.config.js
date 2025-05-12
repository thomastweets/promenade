import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  root: 'src',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'src/index.html'),
        about: path.resolve(__dirname, 'src/about.html'),
        artworks: path.resolve(__dirname, 'src/artworks.html'),
        help: path.resolve(__dirname, 'src/help.html'),
      },
      output: {
        assetFileNames: 'assets/[name].[hash][extname]',
        chunkFileNames: 'js/[name].[hash].js',
        entryFileNames: 'js/[name].[hash].js',
      },
    },
  },
  publicDir: '../public', // Only for static files
  server: {
    watch: {
      // Use polling to ensure changes in copied CSS are detected
      usePolling: true,
      interval: 100,
    },
    // Optional: open browser on start
    // open: true,
  },
}); 