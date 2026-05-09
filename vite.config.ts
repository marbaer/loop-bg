import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/loop-bg/",
  plugins: [react()],
  server: { port: Number(process.env.PORT) || 5180 },
  assetsInclude: ["**/*.glsl", "**/*.vert", "**/*.frag"],
});
