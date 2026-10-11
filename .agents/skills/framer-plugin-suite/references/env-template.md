# Company Framer Plugin Environment Variables Reference Guide

This document defines the standardized environment configuration for all company Framer plugins.

> [!CAUTION]
> **100% Frontend Security Boundary**:
> Framer plugins execute entirely in the user's browser/iframe. **NEVER** expose backend secret keys (`sk_live_*`, `STRIPE_SECRET_KEY`), database credentials, or email SMTP passwords in any frontend repository or `.env` file. All sensitive actions must be performed by the backend server.

---

## 1. Standard Frontend Environment Variables (`.env.example`)

Create a `.env.example` in each new plugin repository root:

```env
# -----------------------------------------------------------------------------
# Base API URL of your plugin backend server
# -----------------------------------------------------------------------------
VITE_API_BASE_URL="https://api.yourplugin.framefic.com"

# -----------------------------------------------------------------------------
# Stripe Publishable Key (Safe for client-side iframe)
# Development: pk_test_... | Production: pk_live_...
# -----------------------------------------------------------------------------
VITE_STRIPE_PUBLISHABLE_KEY="pk_test_51SfPJ4H2b0OUghR3vHZWKgOQ3CsgGZSkhKm1yg9NbKMXxFHG0XJXYtDVNUgy96L54hKVjKKLgflY6PzRkCO4LLEQ00ZNSlGSpo"

# -----------------------------------------------------------------------------
# Environment Mode: "development" | "production"
# -----------------------------------------------------------------------------
VITE_PLUGIN_MODE="development"
```

---

## 2. Dynamic Fallback Implementation (`src/config/backend.ts`)

To ensure the plugin remains functional during Framer sandbox previews even if `.env` is unconfigured:

```typescript
export const BACKEND_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string) || "https://api.yourplugin.framefic.com";

export const STRIPE_PUBLISHABLE_KEY =
  (import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string) || "";

export const buildApiUrl = (endpoint: string): string => {
  const base = BACKEND_BASE_URL.replace(/\/+$/, "");
  const path = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  return `${base}${path}`;
};
```

---

## 3. Dynamic Key Loading Pattern (Recommended)

Rather than hardcoding even the publishable key into `.env`, company plugins dynamically fetch the active publishable key on startup:

```typescript
// Fetches key securely from backend
const response = await fetch(buildApiUrl("/api/payment-config"));
const { publishableKey } = await response.json();
```
This enables zero-downtime key rotation from Stripe Dashboard without rebuilding or re-submitting plugin releases to the Framer Marketplace.
