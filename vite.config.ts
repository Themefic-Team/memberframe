import { readFileSync } from "node:fs";
import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import framer from "vite-plugin-framer";
import basicSsl from "@vitejs/plugin-basic-ssl";
import { devProxyTarget } from "./src/config/devProxy";
import { stripRemoteCssImports } from "./src/config/stripRemoteCssImports";
import { PRODUCTION_API_BASE_URL, assertProductionApiBaseUrl } from "./src/config/productionApi";
import { stripDevOnlyBlocks } from "./src/config/devOnlyBlocks";

/**
 * Strips the dev-only blocks from the canvas component sources the bundle
 * imports with `?raw`, so a shipped `dist` carries no ngrok wiring. Build only:
 * under `vite dev` the components keep the header for a tunnel backend.
 */
function stripCanvasDevOnlyBlocks(): Plugin {
  return {
    name: "memberframe:strip-canvas-dev-only",
    apply: "build",
    enforce: "pre",
    load(id) {
      const [file, query] = id.split("?");
      if (query !== "raw" || !/[\\/]src[\\/]canvas-components[\\/][^\\/]+\.tsx$/.test(file)) return null;
      return `export default ${JSON.stringify(stripDevOnlyBlocks(readFileSync(file, "utf-8")))};`;
    },
  };
}

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");

  // A shipped bundle talks to one public HTTPS backend, never loopback
  // (Marketplace review problems 2 and 8). Stop the build otherwise.
  if (command === "build") assertProductionApiBaseUrl(PRODUCTION_API_BASE_URL);

  // Only the dev server forwards. A build must never ship a panel that calls
  // its own origin, because nothing is listening for `/api` there.
  const apiProxyTarget =
    command === "serve"
      ? devProxyTarget(env.VITE_API_BASE_URL || env.VITE_APP_BASE_URL)
      : null;

  return {
    plugins: [stripCanvasDevOnlyBlocks(), react(), framer(), basicSsl()],
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
