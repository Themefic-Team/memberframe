# Framer Plugin Boilerplate Scaffolding Runbook

This runbook outlines how an AI agent or developer bootstraps a brand-new Framer plugin repository from scratch using the unified architecture.

---

## Step 1: Initialize Repository & Dependencies

Run in terminal:
```bash
npm create vite@latest my-plugin -- --template react-ts
cd my-plugin
npm install framer-plugin @stripe/stripe-js @stripe/react-stripe-js lucide-react vite-plugin-mkcert
npm install -D vite-plugin-framer @types/node
```

Update `package.json` scripts:
```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "pack": "npx framer-plugin-tools@latest pack"
  }
}
```

---

## Step 2: Configure Vite (`vite.config.ts`)

```typescript
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import framer from "vite-plugin-framer"
import mkcert from "vite-plugin-mkcert"

export default defineConfig({
  plugins: [react(), framer(), mkcert()],
  build: {
    target: "esnext",
  },
})
```

---

## Step 3: Configure Framer Manifest (`framer.json`)

Create `framer.json` in the plugin root:
```json
{
  "id": "generate-unique-6-char-hex",
  "name": "My Plugin Name",
  "modes": ["canvas"],
  "permissions": [
    "createCodeFile",
    "CodeFile.setFileContent",
    "CodeFile.remove",
    "addComponentInstance",
    "setParent",
    "Node.remove",
    "setPluginData"
  ],
  "icon": "/icon.png"
}
```

---

## Step 4: Import Design Tokens & Structure

1. Copy [design-tokens.css](design-tokens.css) to `src/styles/variables.css`.
2. Implement `src/config/backend.ts`:
   ```typescript
   export const BACKEND_BASE_URL = import.meta.env.VITE_BACKEND_URL || "https://api.myplugin.framefic.com";
   export const buildBackendUrl = (path: string) => `${BACKEND_BASE_URL.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
   ```
3. Implement `src/lib/framer/project.ts`:
   ```typescript
   import { framer } from "framer-plugin";

   export async function getSiteInfo() {
     try {
       const projectInfo = await framer.getProjectInfo();
       const user = await framer.getPluginUser?.().catch(() => null);
       return {
         siteId: projectInfo.id,
         siteName: (projectInfo as any).name || null,
         siteUrl: (projectInfo as any).url || null,
         userId: user?.id || null,
         userName: user?.name || null,
         userEmail: user?.email || null,
       };
     } catch {
       return {
         siteId: "dev_local_site",
         siteName: "Development Project",
         siteUrl: null,
         userId: null,
         userName: null,
         userEmail: null,
       };
     }
   }
   ```
4. Copy `features/auth/` and `features/payment/` from the reference architecture.
5. In `src/components/home/`, implement standard Home tab components from [plugin-components.md](plugin-components.md):
   - `HeroCard` (AI welcome hero with `.primary-cta`)
   - `HelpRow` & `HelpTile` (Guide, Contact us, Changelog with New dot)
   - `FrameficCard` (More from company ecosystem links)
6. In `App.tsx`:
   - Initialize window: `framer.showUI({ position: "top right", width: 360, height: 640 })`
   - Wire `useAuth()` and `usePaymentFlow()`
   - Add the `enforceLockState` background auto-patcher.
   - Wire `Navbar`, `StickyTrialBanner`, and `AuthModal` / `PaymentModal`.

---

## Step 5: Verification & Packaging

```bash
# Run local SSL dev server for Framer Canvas
npm run dev

# Package plugin for Framer Marketplace review
npm run pack
```
This produces `plugin.zip` containing the manifest and compiled assets ready for the Framer Marketplace.
