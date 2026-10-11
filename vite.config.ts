import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import framer from "vite-plugin-framer";
import basicSsl from "@vitejs/plugin-basic-ssl";

export default defineConfig({
  plugins: [react(), framer(), basicSsl()],
  build: {
    target: "esnext",
    outDir: "dist",
  },
  server: {
    port: 5173,
    host: true,
    cors: true,
  },
});
