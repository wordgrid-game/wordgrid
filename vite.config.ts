import { defineConfig } from 'vite';
import react, { reactCompilerPreset } from '@vitejs/plugin-react';
import babel from '@rolldown/plugin-babel';
import path from 'node:path';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), babel({ presets: [reactCompilerPreset()] })],
  assetsInclude: ['**/*.txt.gz'],
  resolve: {
    alias: {
      src: path.resolve(import.meta.dirname, 'src'),
      common: path.resolve(import.meta.dirname, 'common'),
      components: path.resolve(import.meta.dirname, 'src/components'),
      pages: path.resolve(import.meta.dirname, 'src/pages'),
    },
  },
  server: {
    proxy: {
      '/auth': 'http://localhost:8210',
    },
  },
});
