/**
 * The integration catalogue.
 *
 * One property matters more than everything else here and most of this file is
 * about it: **a value declared secret must never reach the settings document.**
 * That document is returned to the panel whole on every connect and every
 * settings read, so a Stripe secret key placed in it would be handed to any
 * creator session that asks, and no amount of fixing it later un-leaks it.
 *
 * `publicValues` is the single function every path from the form to storage
 * goes through, so it is tested against the whole catalogue rather than against
 * one example: a field added later without `secret: true` should fail here, not
 * in production.
 */

import { describe, expect, it } from "vitest";
import {
  CATEGORY_ORDER,
  EMPTY_STORED_INTEGRATION,
  canEnable,
  INTEGRATIONS,
  draftFor,
  findIntegration,
  integrationStatus,
  integrationsByCategory,
  isGatewayIntegration,
  publicValues,
  readStoredIntegration,
  secretValues,
  validateDraft,
  type IntegrationDefinition,
  type StoredIntegration,
} from "../src/components/settings/integrationRegistry";

const STRIPE = findIntegration("stripe");

function stored(over: Partial<StoredIntegration> = {}): StoredIntegration {
  return { ...EMPTY_STORED_INTEGRATION, values: {}, secretsPresent: [], ...over };
}

describe("the catalogue itself", () => {
  it("declares secret on every field, with no default", () => {
    // `secret` is required on IntegrationField rather than optional, so this is
    // belt and braces. It is here because the consequence of getting it wrong
    // on one field is a live credential in a document the client reads back.
    for (const integration of INTEGRATIONS) {
      for (const field of integration.fields) {
        expect(typeof field.secret).toBe("boolean");
      }
    }
  });

  it("marks every password field as secret", () => {
    // The two are separate concepts: `type: "password"` is how it renders and
    // `secret: true` is where it goes. A password-rendered field that is not
    // secret would be masked on screen and stored in the clear.
    for (const integration of INTEGRATIONS) {
      for (const field of integration.fields) {
        if (field.type === "password") expect(field.secret).toBe(true);
      }
    }
  });

  it("gives every gateway at least one secret and one public field", () => {
    // A gateway with no public field has nothing to show as configured, and one
    // with no secret would mean its credentials are all safe to expose, which
    // no payment gateway's are.
    for (const integration of INTEGRATIONS.filter(isGatewayIntegration)) {
      expect(integration.fields.some((field) => field.secret)).toBe(true);
      expect(integration.fields.some((field) => !field.secret)).toBe(true);
    }
  });

  it("has unique ids and unique field keys within each integration", () => {
    const ids = INTEGRATIONS.map((integration) => integration.id);
    expect(new Set(ids).size).toBe(ids.length);

    for (const integration of INTEGRATIONS) {
      const keys = integration.fields.map((field) => field.key);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });

  it("declares a key role only where prefix detection can work", () => {
    // `checkKey` takes a GatewayId. A keyRole on a non-gateway integration
    // would be a call that cannot be made.
    for (const integration of INTEGRATIONS) {
      if (isGatewayIntegration(integration)) continue;

      for (const field of integration.fields) {
        expect(field.keyRole).toBeUndefined();
      }
    }
  });

  it("throws on an unknown id rather than rendering a blank card", () => {
    expect(() => findIntegration("nope" as never)).toThrow();
  });

  it("provides all four social OAuth integrations under category 'auth'", () => {
    const authIntegrations = INTEGRATIONS.filter((i) => i.category === "auth");
    const ids = authIntegrations.map((i) => i.id);
    expect(ids).toEqual(["google_oauth", "github_oauth", "apple_oauth", "discord_oauth"]);

    for (const auth of authIntegrations) {
      expect(auth.available).toBe(true);
      const redirectField = auth.fields.find((f) => f.key === "redirect_url");
      expect(redirectField).toBeDefined();
      expect(redirectField?.readOnly).toBe(true);
      expect(redirectField?.disabled).toBe(true);
      expect(redirectField?.copyable).toBe(true);

      const clientIdField = auth.fields.find((f) => f.key === "clientId");
      expect(clientIdField).toBeDefined();
      expect(clientIdField?.secret).toBe(false);

      const secretField = auth.fields.find((f) => f.key === "clientSecret");
      expect(secretField).toBeDefined();
      expect(secretField?.secret).toBe(true);
    }
  });
});

describe("publicValues", () => {
  it("drops every secret field, across the whole catalogue", () => {
    // The guarantee the tab is built around, checked against every integration
    // rather than one, so a field added later is covered without a new test.
    for (const integration of INTEGRATIONS) {
      const draft: Record<string, string> = {};
      for (const field of integration.fields) draft[field.key] = `value-for-${field.key}`;

      const result = publicValues(integration, draft);

      for (const field of integration.fields) {
        if (field.secret) {
          expect(result).not.toHaveProperty(field.key);
        } else {
          expect(result[field.key]).toBe(`value-for-${field.key}`);
        }
      }
    }
  });

  it("drops an empty value rather than storing a blank", () => {
    // Otherwise "cleared" and "never set" are two stored states meaning the
    // same thing, and every consumer has to know both.
    const result = publicValues(STRIPE, { publishableKey: "   " });
    expect(result).not.toHaveProperty("publishableKey");
  });

  it("ignores a key the definition does not declare", () => {
    // A stale form, or a tampered request. Either way the registry is the
    // authority on what this integration stores.
    const result = publicValues(STRIPE, { publishableKey: "pk_live_x", smuggled: "value" });
    expect(result).toEqual({ publishableKey: "pk_live_x" });
  });

  it("trims, because a pasted key often carries whitespace", () => {
    expect(publicValues(STRIPE, { publishableKey: "  pk_live_x  " })).toEqual({
      publishableKey: "pk_live_x",
    });
  });
});

describe("secretValues", () => {
  it("returns only the secret half", () => {
    const result = secretValues(STRIPE, {
      publishableKey: "pk_live_x",
      secretKey: "sk_live_y",
      webhookSecret: "whsec_z",
    });

    expect(result).toEqual({ secretKey: "sk_live_y", webhookSecret: "whsec_z" });
  });

  it("omits an untouched field, so a stored secret is not overwritten with nothing", () => {
    const result = secretValues(STRIPE, { secretKey: "", webhookSecret: "whsec_z" });
    expect(result).toEqual({ webhookSecret: "whsec_z" });
  });
});

describe("draftFor", () => {
  it("opens secret fields empty even when a secret is stored", () => {
    // There is nothing to prefill with, because the panel is never given a
    // stored secret. A placeholder value would make "leave it alone" and
    // "replace it" indistinguishable on save.
    const draft = draftFor(STRIPE, stored({ secretsPresent: ["secretKey"] }));
    expect(draft["secretKey"]).toBe("");
  });

  it("prefills the non-secret fields from storage", () => {
    const draft = draftFor(STRIPE, stored({ values: { publishableKey: "pk_live_x" } }));
    expect(draft["publishableKey"]).toBe("pk_live_x");
  });
});

describe("integrationStatus", () => {
  const available: IntegrationDefinition = { ...STRIPE, available: true };

  it("is unavailable while nothing consumes it", () => {
    expect(integrationStatus(STRIPE, stored())).toBe("unavailable");
  });

  it("is not configured when nothing is set", () => {
    expect(integrationStatus(available, stored())).toBe("not_configured");
  });

  it("is partial when half the required fields are set", () => {
    // The state a simpler model would miss, and the one that matters. A creator
    // who filled the publishable key, hit a disabled secret field, and saved has
    // an integration that looks configured and cannot take a payment.
    expect(
      integrationStatus(available, stored({ values: { publishableKey: "pk_live_x" } }))
    ).toBe("partial");
  });

  it("is connected only when every required field is present", () => {
    expect(
      integrationStatus(
        available,
        stored({ values: { publishableKey: "pk_live_x" }, secretsPresent: ["secretKey"] })
      )
    ).toBe("connected");
  });

  it("does not count an optional field as missing", () => {
    // Stripe's webhook secret is optional in the registry, so its absence must
    // not hold the card at "partial" forever.
    const optional = available.fields.filter((field) => !field.required).map((field) => field.key);
    expect(optional).toContain("webhookSecret");
  });
});

describe("validateDraft", () => {
  const available: IntegrationDefinition = { ...STRIPE, available: true };

  it("reports a missing required public field", () => {
    const problems = validateDraft(available, { publishableKey: "" }, stored(), true);
    expect(problems.map((problem) => problem.key)).toContain("publishableKey");
  });

  it("names the field in words, never the key", () => {
    // PRD section 7.6 rule 4: no raw value reaches a user.
    const problems = validateDraft(available, { publishableKey: "" }, stored(), true);
    expect(problems[0]?.message).toContain("Publishable key");
    expect(problems[0]?.message).not.toContain("publishableKey");
  });

  it("does not blame the creator for a secret we cannot store", () => {
    // While `gateway_configs` does not exist the panel disables secret fields
    // and says why. Reporting the empty field as the creator's mistake would be
    // blaming them for ours.
    const problems = validateDraft(available, { publishableKey: "pk_live_x" }, stored(), false);
    expect(problems).toEqual([]);
  });

  it("requires a secret once there is somewhere to put it", () => {
    const problems = validateDraft(available, { publishableKey: "pk_live_x" }, stored(), true);
    expect(problems.map((problem) => problem.key)).toContain("secretKey");
  });

  it("accepts an already stored secret the creator did not retype", () => {
    // Editing a publishable key must not force retyping a secret set last month.
    const problems = validateDraft(
      available,
      { publishableKey: "pk_live_x" },
      stored({ secretsPresent: ["secretKey"] }),
      true
    );

    expect(problems).toEqual([]);
  });
});

describe("readStoredIntegration", () => {
  it("is total for anything a JSON column might hold", () => {
    // The source is a column nothing validates. A corrupt entry must read as
    // not configured, which shows an Install button rather than breaking the
    // tab.
    for (const input of [null, undefined, 7, "hello", [], { values: 7 }]) {
      const result = readStoredIntegration(input);
      expect(result.enabled).toBe(false);
      expect(result.values).toEqual({});
      expect(result.secretsPresent).toEqual([]);
    }
  });

  it("keeps only the string values", () => {
    const result = readStoredIntegration({
      enabled: true,
      values: { publishableKey: "pk_live_x", broken: 7, alsoBroken: null },
      secretsPresent: ["secretKey", 9],
    });

    expect(result.enabled).toBe(true);
    expect(result.values).toEqual({ publishableKey: "pk_live_x" });
    expect(result.secretsPresent).toEqual(["secretKey"]);
  });
});

describe("integrationsByCategory", () => {
  it("groups in a fixed order and drops empty groups", () => {
    const groups = integrationsByCategory();
    const categories = groups.map((group) => group.category);

    expect(categories).toEqual(CATEGORY_ORDER.filter((category) => categories.includes(category)));
    for (const group of groups) expect(group.integrations.length).toBeGreaterThan(0);
  });

  it("places every integration in exactly one group", () => {
    const grouped = integrationsByCategory().flatMap((group) => group.integrations);
    expect(grouped).toHaveLength(INTEGRATIONS.length);
  });
});

describe("canEnable", () => {
  const available: IntegrationDefinition = { ...STRIPE, available: true };

  it("refuses an integration holding nothing", () => {
    // Otherwise the card shows an enabled switch next to a status of "Not
    // connected", which is two parts of the same card disagreeing about the
    // same fact.
    expect(canEnable(available, stored())).toBe(false);
  });

  it("allows a partly configured one", () => {
    // A creator who has saved the publishable key and cannot yet save the
    // secret should still be able to switch the integration on. Holding the
    // switch hostage to a field the panel itself disabled would be blaming
    // them for our missing table.
    expect(canEnable(available, stored({ values: { publishableKey: "pk_live_x" } }))).toBe(true);
  });

  it("allows a fully configured one", () => {
    expect(
      canEnable(
        available,
        stored({ values: { publishableKey: "pk_live_x" }, secretsPresent: ["secretKey"] })
      )
    ).toBe(true);
  });

  it("does not refuse merely because nothing consumes it yet", () => {
    // `available: false` means connecting it does nothing, which the card
    // already says. Blocking the switch as well would say the same thing twice
    // while taking away a choice that costs nothing.
    expect(canEnable(STRIPE, stored({ values: { publishableKey: "pk_live_x" } }))).toBe(true);
  });
});
