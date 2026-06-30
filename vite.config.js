import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [
    tailwindcss(),
  ],
  base: './', // Ensures relative assets path for portable deployment (GitHub Pages, VPS, etc.)
  build: {
    outDir: 'dist',
  }
});
