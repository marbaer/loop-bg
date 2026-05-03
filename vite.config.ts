import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/loop-bg/",
  plugins: [react()],
  server: { port: 5173 },
  assetsInclude: ["**/*.glsl", "**/*.vert", "**/*.frag"],
});
