import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import framer from "vite-plugin-framer";
import basicSsl from "@vitejs/plugin-basic-ssl";
import { devProxyTarget } from "./src/config/devProxy";
import { stripRemoteCssImports } from "./src/config/stripRemoteCssImports";

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");

  // Only the dev server forwards. A build must never ship a panel that calls
  // its own origin, because nothing is listening for `/api` there.
  const apiProxyTarget =
    command === "serve"
      ? devProxyTarget(env.VITE_API_BASE_URL || env.VITE_APP_BASE_URL)
      : null;

  return {
    plugins: [react(), framer(), basicSsl()],
    define: {
      __MF_DEV_API_PROXY__: JSON.stringify(apiProxyTarget !== null),
    },
    // Nothing loads from a CDN: drops remote @imports, such as the Google
    // Fonts one inside Framer's framer.css. Fonts are bundled (styles/fonts.css).
    css: {
      postcss: { plugins: [stripRemoteCssImports()] },
    },
    build: {
      target: "esnext",
      outDir: "dist",
      // Readable source for Marketplace reviewers (audit I4).
      sourcemap: true,
    },
    server: {
      port: 5173,
      host: true,
      cors: true,
      // The panel is an HTTPS iframe inside framer.com, and the browser drops
      // its requests to a plain HTTP loopback port before they are sent. The
      // panel calls this server instead and this forwards them. The reasoning
      // is in `src/config/devProxy.ts`.
      proxy: apiProxyTarget ? { "/api": { target: apiProxyTarget } } : undefined,
    },
  };
});
