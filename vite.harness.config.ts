import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

// Separate Vite config for the server-side export harness.
// Output goes to dist-harness/ with base "/" (served by Express, not the CDN).
export default defineConfig({
  base: "/",
  plugins: [react()],
  assetsInclude: ["**/*.glsl", "**/*.vert", "**/*.frag"],
  build: {
    outDir: "dist-harness",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        harness: resolve(__dirname, "harness.html"),
      },
    },
  },
});
