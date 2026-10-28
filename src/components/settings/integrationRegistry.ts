/**
 * The integration catalogue. Plan document section 4.3.
 *
 * One declaration per integration drives the card, the form, the validation,
 * and where each value is stored, so adding an integration is one entry here
 * rather than five edits across the panel.
 *
 * ## The split that shapes everything
 *
 * Every field is either a secret or it is not, and the two go to different
 * places. This is not a preference, it is the constraint the whole tab is built
 * around:
 *
 *   not secret   `site_settings.settings.integrations`, read back to the panel
 *   secret       an encrypted table, which does not exist yet
 *
 * A secret must never enter the settings document. That document is returned to
 * the panel whole on every connect and every settings read, so a secret placed
 * there would be handed to any creator session that asks for it. PRD section 8
 * F03 is explicit that "a secret key is never present in any client-side
 * response payload", and `types/site.ts` deliberately has no field for one.
 *
 * `gateway_configs` with AES-256-GCM is backend PRD phase B3 and is not built,
 * so **every secret field is disabled in the panel today**, with the reason on
 * screen. That is half a feature honestly labelled rather than a secret written
 * somewhere it cannot be taken back from.
 *
 * ## One card per gateway, not two
 *
 * The reference layout has separate Stripe and Stripe Sandbox cards. Live
 * against test is already derivable from the key itself, which
 * `gatewayKeys.ts` detects today, so the mode is shown as a badge once a key is
 * pasted. Two cards would let a creator fill in both with nothing on screen
 * saying which one a real checkout uses, and that is a question they would
 * answer by taking a payment.
 */

import type { KeyRole } from "./gatewayKeys";
import type { GatewayId } from "../../types/site";

export type IntegrationId =
  | GatewayId
  | "google_oauth"
  | "github_oauth"
  | "apple_oauth"
  | "discord_oauth"
  // Not in the catalogue: its card is Settings, Config, Email sending (25-custom-smtp.md).
  | "custom_smtp";

/**
 * The three groups the catalogue is shown in.
 *
 * `store` takes money, `auth` identifies a visitor, `utility` is everything
 * else. The grouping is the creator's mental model rather than ours: a creator
 * looking for Stripe and a creator looking for Google sign-in are doing two
 * unrelated jobs and should not have to read past each other.
 */
export type IntegrationCategory = "store" | "auth" | "utility";

export const CATEGORY_LABELS: Record<IntegrationCategory, string> = {
  store: "Payments",
  auth: "Sign in",
  utility: "Utilities",
};

export type IntegrationFieldType = "text" | "password" | "url";

export interface IntegrationField {
  key: string;
  label: string;
  type: IntegrationFieldType;
  placeholder: string;
  required: boolean;
  /**
   * Whether this value must never be returned to the panel once stored.
   *
   * A secret field is write-only from the panel's point of view: the creator
   * types it, it goes to the server, and what comes back is a masked suffix.
   */
  secret: boolean;
  /** One line under the field, when the label is not enough. */
  help?: string;
  /**
   * Which kind of gateway key this field expects, for prefix detection.
   *
   * Declared rather than inferred. `gatewayKeys.ts` can tell a Stripe
   * publishable key from a secret one, but only if it is told which the field
   * wants, and guessing from the field name would be wrong for Lemon Squeezy's
   * store id and Razorpay's key id, which are identifiers rather than keys.
   *
   * Absent on anything that is not a gateway credential. An OAuth client id has
   * no recognisable prefix, so there is nothing to check.
   */
  keyRole?: KeyRole;
  readOnly?: boolean;
  disabled?: boolean;
  copyable?: boolean;
}

/**
 * Does this integration's id name a payment gateway?
 *
 * A guard rather than a cast. The three store ids are exactly `GatewayId`, and
 * narrowing here means `checkKey` is only ever called with something it can
 * actually handle.
 */
export function isGatewayIntegration(
  definition: IntegrationDefinition
): definition is IntegrationDefinition & { id: GatewayId } {
  return definition.category === "store";
}

export interface IntegrationDefinition {
  id: IntegrationId;
  name: string;
  category: IntegrationCategory;
  /** One line on the card. Under about 90 characters, or it wraps to three. */
  description: string;
  fields: ReadonlyArray<IntegrationField>;
  /**
   * The feature that reads these values.
   *
   * Shown on a card whose integration is not consumable yet, so the creator is
   * told why connecting it does nothing rather than discovering it later.
   */
  consumedBy: string;
  /**
   * Whether anything in the product actually uses this yet.
   *
   * The same honesty rule the component picker follows. A card that accepts a
   * key and silently does nothing with it is worse than one that says it is not
   * ready: the creator has no way to tell the two apart.
   */
  available: boolean;
}

/**
 * Stripe's three values.
 *
 * The webhook secret is here rather than hidden behind an advanced toggle
 * because without it the webhook receiver cannot verify a signature, which
 * means it has to either trust an unsigned request or refuse every one. A
 * creator who configures Stripe and skips this has a payment flow that takes
 * money and never grants access.
 */
const STRIPE_FIELDS: ReadonlyArray<IntegrationField> = [
  {
    key: "publishableKey",
    label: "Publishable key",
    type: "text",
    placeholder: "pk_live_ or pk_test_",
    required: true,
    secret: false,
    keyRole: "publishable",
    help: "Safe to expose. It identifies your account in the browser.",
  },
  {
    key: "secretKey",
    label: "Secret key",
    type: "password",
    placeholder: "Paste the secret key",
    required: true,
    secret: true,
    keyRole: "secret",
  },
  {
    key: "webhookSecret",
    label: "Webhook secret",
    type: "password",
    placeholder: "Paste the webhook signing secret",
    required: false,
    secret: true,
    help: "Without this, a payment cannot be verified and access is never granted.",
  },
];

const LEMONSQUEEZY_FIELDS: ReadonlyArray<IntegrationField> = [
  {
    key: "storeId",
    label: "Store ID",
    type: "text",
    placeholder: "12345",
    required: true,
    secret: false,
    keyRole: "identifier",
  },
  {
    key: "apiKey",
    label: "API key",
    type: "password",
    placeholder: "Paste the API key",
    required: true,
    secret: true,
  },
  {
    key: "webhookSecret",
    label: "Signing secret",
    type: "password",
    placeholder: "Paste the signing secret",
    required: false,
    secret: true,
  },
];

const RAZORPAY_FIELDS: ReadonlyArray<IntegrationField> = [
  {
    key: "keyId",
    label: "Key ID",
    type: "text",
    placeholder: "rzp_live_ or rzp_test_",
    required: true,
    secret: false,
    keyRole: "identifier",
  },
  {
    key: "keySecret",
    label: "Key secret",
    type: "password",
    placeholder: "Paste the key secret",
    required: true,
    secret: true,
  },
];

/**
 * OAuth, both providers.
 *
 * The client id is public by design: it travels in the authorize URL, which is
 * in the visitor's address bar. The client secret never leaves the server.
 *
 * The redirect URI is not a field. It is ours, not the creator's: it points at
 * our callback route, and letting a creator type one would mean an attacker who
 * could reach this form could point an OAuth callback at their own host.
 */
const GOOGLE_FIELDS: ReadonlyArray<IntegrationField> = [
  {
    key: "clientId",
    label: "Client ID",
    type: "text",
    placeholder: "000000.apps.googleusercontent.com",
    required: true,
    secret: false,
    help: "From Google Cloud Console > Credentials > OAuth 2.0 Client IDs.",
  },
  {
    key: "clientSecret",
    label: "Client secret",
    type: "password",
    placeholder: "Paste the client secret",
    required: true,
    secret: true,
    help: "Your Google OAuth client secret.",
  },
  {
    key: "redirect_url",
    label: "Redirect URL",
    type: "url",
    placeholder: "Computed automatically",
    required: false,
    secret: false,
    readOnly: true,
    disabled: true,
    copyable: true,
    help: "Add this as an Authorized redirect URI in Google Cloud Console.",
  },
];

const GITHUB_FIELDS: ReadonlyArray<IntegrationField> = [
  {
    key: "clientId",
    label: "Client ID",
    type: "text",
    placeholder: "Ov23li... or Iv1.000000",
    required: true,
    secret: false,
    help: "From GitHub Developer Settings > OAuth Apps > Client ID.",
  },
  {
    key: "clientSecret",
    label: "Client secret",
    type: "password",
    placeholder: "Paste the client secret",
    required: true,
    secret: true,
    help: "Your GitHub OAuth client secret.",
  },
  {
    key: "redirect_url",
    label: "Redirect URL",
    type: "url",
    placeholder: "Computed automatically",
    required: false,
    secret: false,
    readOnly: true,
    disabled: true,
    copyable: true,
    help: "Add this as the Authorization callback URL in your GitHub OAuth App.",
  },
];

const APPLE_FIELDS: ReadonlyArray<IntegrationField> = [
  {
    key: "clientId",
    label: "Services ID",
    type: "text",
    placeholder: "com.example.memberframe.client",
    required: true,
    secret: false,
    help: "Your Services ID, which Apple uses as the client ID. From Apple Developer > Identifiers > Services IDs.",
  },
  {
    key: "teamId",
    label: "Team ID",
    type: "text",
    placeholder: "DEF1234567",
    required: false,
    secret: false,
    help: "From Apple Developer Account > Membership > Team ID.",
  },
  {
    key: "keyId",
    label: "Key ID",
    type: "text",
    placeholder: "ABC1234XYZ",
    required: false,
    secret: false,
    help: "From Apple Developer Account > Certificates, Identifiers & Profiles > Keys.",
  },
  {
    key: "clientSecret",
    label: "Private key",
    type: "password",
    placeholder: "Paste the .p8 key",
    required: true,
    secret: true,
    help: "The contents of your Apple .p8 private key, or a client secret you generated. Used to sign sign-in requests.",
  },
  {
    key: "redirect_url",
    label: "Redirect URL",
    type: "url",
    placeholder: "Computed automatically",
    required: false,
    secret: false,
    readOnly: true,
    disabled: true,
    copyable: true,
    help: "Add this to Return URLs in Apple Developer > Identifiers > Services ID.",
  },
];

const DISCORD_FIELDS: ReadonlyArray<IntegrationField> = [
  {
    key: "clientId",
    label: "Application ID",
    type: "text",
    placeholder: "123456789012345678",
    required: true,
    secret: false,
    help: "Application ID from Discord Developer Portal > General Information.",
  },
  {
    key: "clientSecret",
    label: "Client secret",
    type: "password",
    placeholder: "Paste the client secret",
    required: true,
    secret: true,
    help: "Client Secret from Discord Developer Portal > OAuth2.",
  },
  {
    key: "redirect_url",
    label: "Redirect URL",
    type: "url",
    placeholder: "Computed automatically",
    required: false,
    secret: false,
    readOnly: true,
    disabled: true,
    copyable: true,
    help: "Add this as a Redirect in Discord Developer Portal > OAuth2.",
  },
];

export const INTEGRATIONS: ReadonlyArray<IntegrationDefinition> = [
  {
    id: "stripe",
    name: "Stripe",
    category: "store",
    description: "Cards and over 135 currencies worldwide.",
    fields: STRIPE_FIELDS,
    consumedBy: "payments",
    available: false,
  },
  {
    id: "lemonsqueezy",
    name: "Lemon Squeezy",
    category: "store",
    description: "Payments, subscriptions, and global tax handled for you.",
    fields: LEMONSQUEEZY_FIELDS,
    consumedBy: "payments",
    available: false,
  },
  {
    id: "razorpay",
    name: "Razorpay",
    category: "store",
    description: "Cards, UPI, and net banking for buyers in India.",
    fields: RAZORPAY_FIELDS,
    consumedBy: "payments",
    available: false,
  },
  {
    id: "google_oauth",
    name: "Google sign in",
    category: "auth",
    description: "One click sign in with a Google account.",
    fields: GOOGLE_FIELDS,
    consumedBy: "Google sign in",
    available: true,
  },
  {
    id: "github_oauth",
    name: "GitHub sign in",
    category: "auth",
    description: "One click sign in for a developer audience.",
    fields: GITHUB_FIELDS,
    consumedBy: "GitHub sign in",
    available: true,
  },
  {
    id: "apple_oauth",
    name: "Apple sign in",
    category: "auth",
    description: "Sign in with Apple for iOS, macOS, and web visitors.",
    fields: APPLE_FIELDS,
    consumedBy: "Apple sign in",
    available: true,
  },
  {
    id: "discord_oauth",
    name: "Discord sign in",
    category: "auth",
    description: "One click sign in for gaming and community audiences.",
    fields: DISCORD_FIELDS,
    consumedBy: "Discord sign in",
    available: true,
  },
];

export function findIntegration(id: IntegrationId): IntegrationDefinition {
  const match = INTEGRATIONS.find((integration) => integration.id === id);

  // The id type is a closed union over this list, so a miss means the two have
  // drifted. Fail loudly rather than render a blank card.
  if (!match) throw new Error(`Unknown integration id: ${id}`);

  return match;
}

/** The catalogue grouped for rendering, in a fixed category order. */
export const CATEGORY_ORDER: ReadonlyArray<IntegrationCategory> = ["auth", "store", "utility"];

export function integrationsByCategory(
  catalogue: ReadonlyArray<IntegrationDefinition> = INTEGRATIONS
): Array<{ category: IntegrationCategory; integrations: IntegrationDefinition[] }> {
  return CATEGORY_ORDER.map((category) => ({
    category,
    integrations: catalogue.filter((integration) => integration.category === category),
  })).filter((group) => group.integrations.length > 0);
}

// ============================================================================
// WHAT IS STORED
// ============================================================================

/**
 * One integration's non-secret values, as kept in the settings document.
 *
 * `secretsPresent` is the server's answer about the other half: a list of field
 * keys that have a stored secret, never the secrets. It is what lets a card say
 * "connected" for an integration whose only remaining value the panel is not
 * allowed to see.
 */
export interface StoredIntegration {
  enabled: boolean;
  values: Record<string, string>;
  secretsPresent: string[];
}

export type IntegrationState = Partial<Record<IntegrationId, StoredIntegration>>;

export const EMPTY_STORED_INTEGRATION: StoredIntegration = {
  enabled: false,
  values: {},
  secretsPresent: [],
};

/**
 * Read one integration's stored state out of the settings document.
 *
 * Defensive because the source is a JSON column that nothing validates, and
 * total because the caller renders a card either way. A corrupt entry reads as
 * not configured, which shows the creator an Install button rather than
 * breaking the tab.
 */
export function readStoredIntegration(value: unknown): StoredIntegration {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return { ...EMPTY_STORED_INTEGRATION };
  }

  const record = value as Record<string, unknown>;
  const rawValues = record["values"];
  const rawSecrets = record["secretsPresent"];

  const values: Record<string, string> = {};

  if (typeof rawValues === "object" && rawValues !== null && !Array.isArray(rawValues)) {
    for (const [key, entry] of Object.entries(rawValues)) {
      if (typeof entry === "string") values[key] = entry;
    }
  }

  return {
    enabled: record["enabled"] === true,
    values,
    secretsPresent: Array.isArray(rawSecrets)
      ? rawSecrets.filter((entry): entry is string => typeof entry === "string")
      : [],
  };
}

// ============================================================================
// STATUS AND VALIDATION
// ============================================================================

/**
 * What a card shows.
 *
 * `partial` is the state that matters and the one a simpler model would miss. A
 * creator who filled in the publishable key, hit a disabled secret field, and
 * saved has an integration that looks configured and cannot take a payment.
 * Saying "needs more" is the difference between finding that out here and
 * finding it out at checkout.
 */
export type IntegrationStatus = "not_configured" | "partial" | "connected" | "unavailable";

/**
 * How far through configuring this integration the creator is.
 *
 * Separate from `integrationStatus` and deliberately blind to `available`. The
 * two questions are different and conflating them was a bug: a creator can
 * fully configure Stripe today even though nothing reads it yet, and a status
 * that short-circuits on `available` would report that as "not configured",
 * which would in turn disable the enable switch on every card in the catalogue.
 */
export type ConfigurationState = "none" | "partial" | "complete";

export function configurationState(
  definition: IntegrationDefinition,
  stored: StoredIntegration
): ConfigurationState {
  const required = definition.fields.filter((field) => field.required);

  const missing = required.filter((field) =>
    field.secret
      ? !stored.secretsPresent.includes(field.key)
      : (stored.values[field.key] ?? "").trim() === ""
  );

  if (missing.length === required.length) return "none";
  return missing.length === 0 ? "complete" : "partial";
}

export function integrationStatus(
  definition: IntegrationDefinition,
  stored: StoredIntegration
): IntegrationStatus {
  // Checked first, because "nothing reads this yet" is what a creator most
  // needs to know about a card they are looking at, and it is true whatever
  // they have filled in.
  if (!definition.available) return "unavailable";

  switch (configurationState(definition, stored)) {
    case "none":
      return "not_configured";
    case "complete":
      return "connected";
    case "partial":
      return "partial";
  }
}

export const STATUS_LABELS: Record<IntegrationStatus, string> = {
  not_configured: "Not connected",
  partial: "Needs more",
  connected: "Connected",
  unavailable: "Not ready",
};

/**
 * May this integration be switched on?
 *
 * Only once it holds something. Enabling an integration with no credentials
 * would claim a connection that cannot work, and the card would then show an
 * enabled switch next to a status of "Not connected", which is two parts of
 * the same card disagreeing about the same fact.
 *
 * An unavailable integration is deliberately NOT a reason to refuse. A creator may
 * reasonably configure Stripe and switch it on before the payment flow that
 * reads it exists; the card already says connecting it does nothing yet, and
 * blocking the switch as well would be saying the same thing twice while taking
 * away a choice that costs nothing.
 */
export function canEnable(definition: IntegrationDefinition, stored: StoredIntegration): boolean {
  return configurationState(definition, stored) !== "none";
}

/** The editable draft for one integration's form. Every field as a string. */
export type IntegrationDraft = Record<string, string>;

/**
 * Open the form on what is already stored.
 *
 * Secret fields open empty, always. There is nothing to prefill them with,
 * because the panel is never given a stored secret, and prefilling a
 * placeholder would make "leave it alone" and "replace it" indistinguishable.
 */
export function draftFor(
  definition: IntegrationDefinition,
  stored: StoredIntegration
): IntegrationDraft {
  const draft: IntegrationDraft = {};

  for (const field of definition.fields) {
    draft[field.key] = field.secret ? "" : (stored.values[field.key] ?? "");
  }

  return draft;
}

export interface FieldProblem {
  key: string;
  message: string;
}

/**
 * Check a draft before it is sent.
 *
 * Shape only, never validity. Whether a key works is the server's answer, and
 * refusing to send a key because a client-side rule did not recognise it is how
 * a creator gets told their working key is invalid.
 *
 * A required secret field is not reported as missing while secrets cannot be
 * stored at all: the creator is already told that on screen, and reporting it
 * as their mistake would be blaming them for ours.
 */
export function validateDraft(
  definition: IntegrationDefinition,
  draft: IntegrationDraft,
  stored: StoredIntegration,
  secretsSupported: boolean
): FieldProblem[] {
  const problems: FieldProblem[] = [];

  for (const field of definition.fields) {
    const value = (draft[field.key] ?? "").trim();

    if (field.secret) {
      if (!secretsSupported) continue;
      // Already stored counts as present. A creator editing a publishable key
      // should not have to retype a secret they set last month.
      if (field.required && value === "" && !stored.secretsPresent.includes(field.key)) {
        problems.push({ key: field.key, message: `${field.label} is required.` });
      }
      continue;
    }

    if (field.required && value === "") {
      problems.push({ key: field.key, message: `${field.label} is required.` });
      continue;
    }

    if (field.type === "url" && value !== "" && !/^https?:\/\//i.test(value)) {
      problems.push({ key: field.key, message: "Include https:// at the start." });
    }
  }

  return problems;
}

/**
 * The part of a draft that may be written to the settings document.
 *
 * The single most important function in this file. Every path from the form to
 * storage goes through it, and it copies only the fields the registry declares
 * as not secret. A field added to a definition without `secret: true` is a
 * field that will be stored in a document the panel can read back, which is why
 * `secret` has no default.
 */
export function publicValues(
  definition: IntegrationDefinition,
  draft: IntegrationDraft
): Record<string, string> {
  const values: Record<string, string> = {};

  for (const field of definition.fields) {
    if (field.secret) continue;

    const value = (draft[field.key] ?? "").trim();
    if (value !== "") values[field.key] = value;
  }

  return values;
}

/**
 * The secret half, for whenever there is somewhere to put it.
 *
 * Returns only fields the creator actually typed into, so an untouched secret
 * is left alone rather than overwritten with an empty string. Nothing calls
 * this yet; it exists so the shape of the eventual call is fixed alongside the
 * rule it has to obey.
 */
export function secretValues(
  definition: IntegrationDefinition,
  draft: IntegrationDraft
): Record<string, string> {
  const values: Record<string, string> = {};

  for (const field of definition.fields) {
    if (!field.secret) continue;

    const value = (draft[field.key] ?? "").trim();
    if (value !== "") values[field.key] = value;
  }

  return values;
}
