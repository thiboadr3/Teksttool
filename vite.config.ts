import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  base: "./",
  plugins: [react()],
  root: ".",
  resolve: {
    alias: {
      "@shared": path.resolve(__dirname, "shared"),
      "@renderer": path.resolve(__dirname, "renderer/src")
    }
  },
  build: {
    outDir: "dist-renderer",
    emptyOutDir: true
  }
});
