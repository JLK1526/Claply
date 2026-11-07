import { defineConfig } from "vite";

export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
  },
  server: {
    host: "0.0.0.0",
    port: 3000,
    strictPort: true,
    hmr: {
      port: 3000,
    },
  },
});
