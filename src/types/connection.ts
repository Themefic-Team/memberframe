/**
 * The connection between one Framer project and one MemberFrame site.
 *
 * Nothing in the plugin works before this exists. The Builder tab has no site
 * key to bake into a generated component, the Manage tab has no site to list
 * members of, and the Settings tab has no document to write. So the Connect
 * tab is the first thing a creator uses and every other tab reads its result.
 *
 * ## What is a secret here and what is not
 *
 * `siteKey` is **public**. It is baked into every generated canvas component
 * and therefore readable in the page source of any published site, exactly like
 * a Stripe publishable key. It identifies a tenant; the origin allowlist is
 * what authorizes. Backend PRD section 3.2.
 *
 * `token` is **a credential**. It reads and writes every member of every site
 * this creator owns. It is kept out of this interface deliberately: see
 * `services/connectionStore.ts`, which holds it separately so that a `console
 * .log(connection)` or a serialized error cannot carry it.
 */

import type { CustomFieldDefinition } from "../utils/customFields";

/** What the settings document holds. Mirrors `backend/src/lib/siteSettings.ts`. */
export interface AuthSettings {
  loginPath: string;
  signupPath: string;
  resetPath: string;
  afterLoginPath: string;
  afterLogoutPath: string;
  allowRegistration: boolean;
  defaultMethod: "password" | "otp";
  requirePasswordStrength: boolean;
  rememberMeDays: number;
}

export interface BrandingSettings {
  displayName: string;
  supportEmail: string;
}

export interface CanvasSettings {
  lastDeployedAt: string | null;
  deployedComponents: string[];
}

/**
 * The whole document, as one object.
 *
 * One JSON column in the database rather than a column per switch, which is a
 * deliberate instruction and the reasoning is in the backend module. What it
 * means here is that the panel reads and writes a document, and that a panel
 * running an older version must send only the keys it knows: the server merges
 * per key, so a partial write is safe and a whole-document write from a stale
 * panel would silently revert whatever it has not heard of.
 */
/**
 * One integration's stored, non-secret configuration.
 *
 * `values` holds only what the registry declares as not secret: publishable
 * keys, store ids, client ids. **A secret never appears here.** This document
 * is returned to the panel whole on every connect and every settings read, so
 * a secret placed in it would be handed to any creator session that asks.
 *
 * `secretsPresent` is the server's answer about the other half, a list of
 * field keys it holds a secret for and never the secrets themselves. It is what
 * lets a card show "connected" for an integration whose remaining value the
 * panel is not allowed to see.
 */
export interface StoredIntegrationSettings {
  enabled: boolean;
  values: Record<string, string>;
  secretsPresent: string[];
}

export type GatedPageFallbackAction = "redirect" | "blur" | "custom_card";
export type GatedPageTier = "signed_in" | "free_member" | "tier_1" | "tier_2" | "vip";

export interface GatedPageRule {
  path: string;
  enabled: boolean;
  requiredTier: GatedPageTier;
  fallbackAction: GatedPageFallbackAction;
  redirectPath?: string;
}

export interface SiteSettingsDocument {
  version: number;
  auth: AuthSettings;
  branding: BrandingSettings;
  canvas: CanvasSettings;
  /** Keyed by integration id. See `components/settings/integrationRegistry.ts`. */
  integrations: Record<string, StoredIntegrationSettings>;
  gatedPages?: GatedPageRule[];
  /**
   * FP-09. Ordered, and the order is what members' forms render in. Optional
   * because a backend older than FP-09 omits it, and read through
   * `readDefinitions` rather than trusted, blocker B8.
   */
  customFields?: CustomFieldDefinition[];
}

/** A patch. Every section and every field optional, because a write is a merge. */
export interface SiteSettingsPatch {
  auth?: Partial<AuthSettings>;
  branding?: Partial<BrandingSettings>;
  canvas?: Partial<CanvasSettings>;
  gatedPages?: GatedPageRule[];
  /**
   * Replaced wholesale, unlike every other section. The list is the
   * configuration: deleting a field has to be expressible, and a per-key merge
   * cannot express it.
   */
  customFields?: CustomFieldDefinition[];
  /**
   * Merged per integration id, so saving one cannot disturb another.
   *
   * `secretsPresent` is absent from the patch type on purpose: it is the
   * server's statement about what it holds, and a client that could assert it
   * could make a card claim a connection that does not exist.
   */
  integrations?: Record<string, { enabled: boolean; values: Record<string, string> }>;
}

/**
 * What the plugin knows about the connected site.
 *
 * Persisted in Framer plugin data, so it survives the panel closing and follows
 * the project rather than the machine. No credential is in here.
 */
export interface SiteConnection {
  siteId: string;
  /** Public. See the file header. */
  siteKey: string;
  siteName: string;
  framerProjectId: string;
  creatorEmail: string;
  creatorName: string;
  allowedOrigins: string[];
}

/**
 * What the plugin learned from the Framer SDK about the open project.
 *
 * `creatorEmail` is absent on purpose and that absence is the reason the
 * connect flow needs an email step at all: blocker B7 records that
 * `framer.getCurrentUser()` exposes a name and an id and no address. So the
 * creator types one, and a typed address is a claim until a code proves it.
 */
export interface FramerProjectContext {
  projectId: string;
  projectName: string;
  creatorName: string | null;
  /** From `getPublishInfo()`. Production and staging, whichever exist. */
  publishedOrigins: string[];
  /** True when the SDK could not be reached, for example in a browser preview. */
  unavailable: boolean;
}

/**
 * Where the Connect tab is in the handshake.
 *
 * A union rather than a set of booleans, so "checking and also connected" is
 * not representable. The two error-ish states carry their message rather than
 * sitting beside a separate `error` field that could be stale.
 */
export type ConnectionState =
  | { status: "loading" }
  | { status: "disconnected" }
  | { status: "code_sent"; email: string }
  | { status: "connected"; connection: SiteConnection; settings: SiteSettingsDocument };

/** The one thing a connected panel passes to every site-scoped call. */
export interface SiteScope {
  siteId: string;
  siteKey: string;
}
