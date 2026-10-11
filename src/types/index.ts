/**
 * MemberFrame — Central TypeScript Data Models & Contracts
 * 100% In-Framer Cockpit Architecture
 */

export type MembershipInterval = "monthly" | "yearly" | "one-time";

export interface MembershipTier {
  id: string;
  name: string;
  price: number;
  currency: string;
  interval: MembershipInterval;
  description: string;
  features: string[];
  stripePriceId?: string;
  lemonVariantId?: string;
  razorpayPlanId?: string;
  isPopular?: boolean;
  colorBadge?: string;
  trialDays?: number;
}

export type MemberStatus = "active" | "trialing" | "past_due" | "canceled";

export interface MemberRecord {
  id: string;
  email: string;
  tierId: string;
  tierName: string;
  status: MemberStatus;
  joinedAt: string;
  amountPaid: number;
  currency: string;
  country?: string;
  avatarUrl?: string;
  provider?: "stripe" | "lemon" | "razorpay" | "manual";
  metadata?: Record<string, unknown>;
}

export type GateFallbackBehavior = "blur" | "hide" | "redirect" | "metered";

export interface GateConfig {
  id: string;
  name: string;
  protectedNodeId?: string;
  allowedTierIds: string[];
  fallbackBehavior: GateFallbackBehavior;
  redirectUrl?: string;
  blurPreview: boolean;
  blurAmountPx: number;
  previewTextRatio: number;
  ctaButtonText: string;
  customOverlayTitle?: string;
  customOverlayMessage?: string;
}

export interface FramerSiteTelemetry {
  siteId?: string;
  siteName?: string;
  siteUrl?: string;
  framerUserId?: string;
  userEmail?: string;
  mode?: "canvas" | "image" | "hosted";
  componentsCount?: number;
}

export interface PaymentGatewaySettings {
  stripePublishableKey: string;
  stripeAccountId?: string;
  lemonApiKey?: string;
  lemonStoreId?: string;
  razorpayKeyId?: string;
  defaultCurrency: string;
  testMode: boolean;
}

export type FramerThemeMode = "dark" | "light";

export interface PluginStoragePayload {
  tiers: MembershipTier[];
  gates: GateConfig[];
  settings: PaymentGatewaySettings;
  telemetry?: FramerSiteTelemetry;
  lastUpdated: string;
}
