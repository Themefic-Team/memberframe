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
import type { PasswordPolicy } from "../utils/credentials";

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
  /**
   * The site's password rules for sign up and reset (05-member-auth.md 13).
   * Absent from an older server; read through `readPasswordPolicy`.
   */
  passwordPolicy?: PasswordPolicy;
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
/** "signed_in" or any tier key, built in or custom. Conflict C9, resolved. */
export type GatedPageTier = "signed_in" | "free_member" | "tier_1" | "tier_2" | "vip" | (string & {});

export interface GatedPageRule {
  path: string;
  enabled: boolean;
  /** "members" when absent: the page is for those the tier choice lets in. "others": for everyone else. */
  audience?: "members" | "others";
  requiredTier: GatedPageTier;
  fallbackAction: GatedPageFallbackAction;
  redirectPath?: string;
}

/**
 * A section lock: a layer named "Lock: <name>" follows this rule on the live
 * site. Development doc: docs/development-docs/19-section-locks.md
 */
export interface SectionLockRule {
  /** Unique per site, ignoring case. Letters, digits, spaces, and - _ . only. */
  name: string;
  enabled: boolean;
  /** "members": shown to those with access. "others": shown to everyone without it. */
  audience: "members" | "others";
  /** "signed_in" or a tier key, the same as a page lock. */
  requiredTier: GatedPageTier;
  /** What the people the rule does not show the layer to get instead. */
  lockedAction: "hide" | "blur";
}

export interface SiteSettingsDocument {
  version: number;
  auth: AuthSettings;
  branding: BrandingSettings;
  canvas: CanvasSettings;
  /** Keyed by integration id. See `components/settings/integrationRegistry.ts`. */
  integrations: Record<string, StoredIntegrationSettings>;
  gatedPages?: GatedPageRule[];
  /** Optional: a backend older than section locks omits it. */
  sectionLocks?: SectionLockRule[];
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
  /** Replaced wholesale, like gatedPages. */
  sectionLocks?: SectionLockRule[];
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
  /** Empty for a site created since 2026-10-28: the name is no longer read from Framer. */
  siteName: string;
  /** This project's own id, kept in its plugin data to spot a duplicate. Never sent to the server. */
  framerProjectId: string;
  creatorEmail: string;
  creatorName: string;
  /** From Google sign in on the account page (F19). Absent shows initials. */
  creatorAvatarUrl?: string;
  allowedOrigins: string[];
}

/**
 * What the plugin reads from the Framer SDK about the open project: its id,
 * and nothing else (Marketplace review, 2026-10-28). The id never leaves the
 * panel. It keys this browser's token and tells a duplicated project apart
 * from the original (`storedSiteIdFor` in `connectionStore.ts`). The Framer
 * user, the project name, and the published domains are not read at all.
 */
export interface FramerProjectContext {
  projectId: string;
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
