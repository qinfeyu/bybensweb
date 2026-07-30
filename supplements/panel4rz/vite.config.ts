import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/supplements/panel4rz/',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  }
});
