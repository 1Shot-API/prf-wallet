import { defineConfig } from "vite";

export default defineConfig({
  root: ".",
  server: {
    port: 5174,
    strictPort: true,
  },
  build: {
    outDir: "dist",
  },
});
