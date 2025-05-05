import { defineConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import path from 'path';

export default defineConfig({
  root: '.',
  build: {
    outDir: 'public',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        about: path.resolve(__dirname, 'about.html'),
        artworks: path.resolve(__dirname, 'artworks.html'),
        help: path.resolve(__dirname, 'help.html'),
      },
      output: {
        assetFileNames: 'assets/[name].[hash][extname]',
        chunkFileNames: 'js/[name].[hash].js',
        entryFileNames: 'js/[name].[hash].js',
      },
    },
  },
  plugins: [
    viteStaticCopy({
      targets: [
        { src: 'assets', dest: '' },
        { src: 'artworks', dest: '' },
        { src: 'css', dest: '' },
      ],
    }),
  ],
  publicDir: false, // We'll copy everything explicitly
}); 