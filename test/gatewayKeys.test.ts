/**
 * Gateway key detection, masking, and the no-storage rule. PRD task 2.4, F03.
 *
 * The last describe block is the one that matters most. The obvious way to make
 * the gateway vault convenient is to persist the draft the way the panel already
 * persists the active tab, which would put a live Stripe secret key in a
 * browser-origin store indefinitely. Nothing on screen would look wrong and
 * every gate would stay green, so the only thing that catches it is a test that
 * reads the source.
 */

import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  GATEWAY_AVAILABILITY,
  VAULT_FIELDS,
  checkKey,
  detectKey,
  isTestKey,
  keyProblemMessage,
  maskKey,
} from "../src/components/settings/gatewayKeys";

describe("detectKey: the prefixes F03 specifies", () => {
  it("reads a Stripe publishable key, live and test", () => {
    expect(detectKey("pk_live_abc123456")).toEqual({
      gateway: "stripe",
      role: "publishable",
      mode: "live",
    });
    expect(detectKey("pk_test_abc123456").mode).toBe("test");
  });

  it("reads a Razorpay key id, live and test", () => {
    expect(detectKey("rzp_live_abc123456")).toEqual({
      gateway: "razorpay",
      role: "identifier",
      mode: "live",
    });
    expect(detectKey("rzp_test_abc123456").mode).toBe("test");
  });

  it("reads a Stripe secret key, which F03's own list omits", () => {
    // CONFLICT C13. F03 lists pk_live_ and pk_test_ as the Stripe markers, and
    // those are publishable prefixes, while the vault asks for a secret key
    // too. Stripe secret keys begin sk_ and restricted keys begin rk_.
    expect(detectKey("sk_live_abc123456")).toEqual({
      gateway: "stripe",
      role: "secret",
      mode: "live",
    });
    expect(detectKey("rk_test_abc123456")).toEqual({
      gateway: "stripe",
      role: "secret",
      mode: "test",
    });
  });

  it("attributes nothing to an unprefixed string", () => {
    // Lemon Squeezy API keys and Razorpay key secrets carry no prefix at all,
    // so "unrecognised" cannot mean "wrong".
    expect(detectKey("eyJhbGciOiJIUzI1NiJ9")).toEqual({
      gateway: null,
      role: null,
      mode: null,
    });
  });

  it("treats an empty value as nothing rather than as a problem", () => {
    expect(detectKey("")).toEqual({ gateway: null, role: null, mode: null });
    expect(detectKey("   ").gateway).toBeNull();
  });

  it("reports no mode when the key says neither live nor test", () => {
    expect(detectKey("pk_abc123456").mode).toBeNull();
  });
});

describe("isTestKey", () => {
  it("flags a test key on every gateway that marks one", () => {
    // F03: "Test keys route to gateway test mode and are clearly labelled in
    // the UI." A creator shipping with test keys takes no money.
    expect(isTestKey("pk_test_abc123456")).toBe(true);
    expect(isTestKey("sk_test_abc123456")).toBe(true);
    expect(isTestKey("rzp_test_abc123456")).toBe(true);
  });

  it("does not flag a live key or an unprefixed one", () => {
    expect(isTestKey("pk_live_abc123456")).toBe(false);
    expect(isTestKey("eyJhbGciOiJIUzI1NiJ9")).toBe(false);
    expect(isTestKey("")).toBe(false);
  });
});

describe("maskKey", () => {
  it("shows four characters and no more", () => {
    // F03: secrets are "never returned to the client, only a masked suffix".
    // This is the only function in the repository that renders any part of a
    // key, so its bound is the bound.
    const masked = maskKey("sk_live_51H8xQrAbCdEf4242");

    expect(masked).toBe("****4242");
    expect(masked).not.toContain("51H8xQr");
  });

  it("does not leak a short key whole", () => {
    expect(maskKey("abcd")).toBe("****");
    expect(maskKey("ab")).toBe("**");
  });

  it("reveals nothing for an empty value", () => {
    expect(maskKey("")).toBe("");
  });

  it("never returns more than four real characters, whatever the input", () => {
    for (const key of ["x".repeat(200), "sk_live_" + "9".repeat(64), "rzp_test_abcdefgh"]) {
      const masked = maskKey(key);
      const revealed = masked.replace(/\*/g, "");

      expect(revealed.length).toBeLessThanOrEqual(4);
    }
  });
});

describe("checkKey: it guides rather than validates", () => {
  it("accepts an empty field, because an unconfigured gateway is normal", () => {
    expect(checkKey("", "stripe", "publishable").problem).toBeNull();
  });

  it("accepts an unrecognised but plausible key", () => {
    // A client-side regex that rejects a working key is worse than one that
    // accepts a broken key, because the server catches the second.
    expect(checkKey("eyJhbGciOiJIUzI1NiJ9xxxx", "lemonsqueezy", "secret").problem).toBeNull();
  });

  it("catches whitespace, which is a paste artefact rather than a key", () => {
    expect(checkKey("pk_live_abc 123", "stripe", "publishable").problem).toBe("whitespace");
  });

  it("catches a half-finished paste", () => {
    expect(checkKey("pk_l", "stripe", "publishable").problem).toBe("too_short");
  });

  it("catches a key pasted into the wrong gateway", () => {
    expect(checkKey("rzp_live_abc123456", "stripe", "publishable").problem).toBe("wrong_gateway");
    expect(checkKey("pk_live_abc123456", "razorpay", "identifier").problem).toBe("wrong_gateway");
  });

  it("catches a secret key pasted into the publishable field", () => {
    // The practical consequence of C13: without recognising sk_, this paste
    // would be sent to the server as a publishable key.
    expect(checkKey("sk_live_abc123456", "stripe", "publishable").problem).toBe("wrong_role");
  });

  it("accepts each key in its own field", () => {
    expect(checkKey("pk_live_abc123456", "stripe", "publishable").problem).toBeNull();
    expect(checkKey("sk_live_abc123456", "stripe", "secret").problem).toBeNull();
    expect(checkKey("rzp_live_abc123456", "razorpay", "identifier").problem).toBeNull();
  });
});

describe("keyProblemMessage", () => {
  it("returns null when there is nothing to say", () => {
    // So a caller can pass it straight to FieldRow's error prop.
    expect(keyProblemMessage(checkKey("", "stripe", "publishable"))).toBeNull();
  });

  it("writes every message as a sentence with no raw value in it", () => {
    // PRD section 7.6 rules 4 and 6.
    const checks = [
      checkKey("pk_live_abc 123", "stripe", "publishable"),
      checkKey("pk_l", "stripe", "publishable"),
      checkKey("rzp_live_abc123456", "stripe", "publishable"),
      checkKey("sk_live_abc123456", "stripe", "publishable"),
    ];

    for (const check of checks) {
      const message = keyProblemMessage(check);

      expect(message).toBeTruthy();
      expect(message?.endsWith(".")).toBe(true);
      expect(message).not.toMatch(/lemonsqueezy|wrong_gateway|wrong_role|too_short|publishable key id/);
    }
  });

  it("names the gateway in words, not as its id", () => {
    const message = keyProblemMessage(checkKey("rzp_live_abc123456", "stripe", "publishable"));

    expect(message).toContain("Razorpay");
  });

  it("never echoes the key itself back into a message", () => {
    // A field error that quotes the key puts a secret on screen and into any
    // screenshot the creator then sends to support.
    const secret = "sk_live_supersecretvalue123";
    const message = keyProblemMessage(checkKey(secret, "razorpay", "identifier"));

    expect(message).not.toContain(secret);
    expect(message).not.toContain("supersecret");
  });
});

describe("the vault's field list", () => {
  it("covers all six fields F03's configuration flow names", () => {
    expect(VAULT_FIELDS).toHaveLength(6);
    expect(VAULT_FIELDS.map((field) => field.field)).toEqual([
      "stripePublishableKey",
      "stripeSecretKey",
      "lemonSqueezyStoreId",
      "lemonSqueezyApiKey",
      "razorpayKeyId",
      "razorpayKeySecret",
    ]);
  });

  it("marks every secret field as secret, so none renders readable", () => {
    const secretFields = VAULT_FIELDS.filter((field) => field.secret).map((field) => field.field);

    expect(secretFields).toEqual([
      "stripeSecretKey",
      "lemonSqueezyApiKey",
      "razorpayKeySecret",
    ]);
  });

  it("never puts a real-looking secret in a placeholder", () => {
    // A placeholder is rendered in plain text, so it must not look like
    // something a creator could mistake for a stored value.
    for (const field of VAULT_FIELDS) {
      expect(field.placeholder).not.toMatch(/^(sk|rk)_(live|test)_\w{8,}/);
    }
  });

  it("lists Stripe as available now and the other two with their task", () => {
    // F03: Phase 1 is Stripe, Phase 2 is Lemon Squeezy and Razorpay. They are
    // shown disabled rather than hidden, because hiding them presents the
    // product as Stripe-only, which is the limitation F03 exists to beat.
    const byGateway = new Map(GATEWAY_AVAILABILITY.map((entry) => [entry.gateway, entry]));

    expect(byGateway.get("stripe")?.available).toBe(true);
    expect(byGateway.get("lemonsqueezy")?.available).toBe(false);
    expect(byGateway.get("razorpay")?.available).toBe(false);
    expect(byGateway.get("lemonsqueezy")?.task).toBe("3.1");
    expect(byGateway.get("razorpay")?.task).toBe("3.2");
  });
});

describe("no secret is ever persisted client side", () => {
  /**
   * Read the whole settings subtree, comments stripped.
   *
   * This is a grep dressed as a test, and it is the only mechanism that will
   * notice when someone adds a convenience that saves the vault across panel
   * reopens. The PRD does not state this rule: it follows from S1, and it is
   * the one decision in F03 that could quietly become a breach.
   */
  function settingsSources(): ReadonlyArray<[string, string]> {
    const dir = path.join(process.cwd(), "src", "components", "settings");

    return readdirSync(dir)
      .filter((name) => name.endsWith(".ts") || name.endsWith(".tsx"))
      .map((name) => {
        const raw = readFileSync(path.join(dir, name), "utf-8");
        const code = raw.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");
        return [name, code] as [string, string];
      });
  }

  const sources = settingsSources();

  it("found the files it claims to be checking", () => {
    // A test that silently scans an empty list passes forever.
    expect(sources.length).toBeGreaterThanOrEqual(2);
  });

  it("uses no browser storage API anywhere in the settings subtree", () => {
    for (const [name, code] of sources) {
      expect(code, `${name} must not use localStorage`).not.toContain("localStorage");
      expect(code, `${name} must not use sessionStorage`).not.toContain("sessionStorage");
      expect(code, `${name} must not use indexedDB`).not.toContain("indexedDB");
      expect(code, `${name} must not use document.cookie`).not.toContain("document.cookie");
    }
  });

  it("uses no plugin data API anywhere in the settings subtree", () => {
    // setPluginData is not permitted until task 5.6 in any case, and a key is
    // not what it should first be used for.
    for (const [name, code] of sources) {
      expect(code, `${name} must not use setPluginData`).not.toContain("setPluginData");
    }
  });

  it("logs nothing from the settings subtree", () => {
    // A console.log of a draft object during debugging is how a secret ends up
    // in a screen recording.
    for (const [name, code] of sources) {
      expect(code, `${name} must not log`).not.toMatch(/console\.(log|info|warn|error|debug)/);
    }
  });

  it("keeps the Settings tab itself free of storage calls too", () => {
    const raw = readFileSync(
      path.join(process.cwd(), "src", "components", "tabs", "SettingsTab.tsx"),
      "utf-8"
    );
    const code = raw.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");

    expect(code).not.toContain("localStorage");
    expect(code).not.toContain("sessionStorage");
    expect(code).not.toContain("setPluginData");
  });
});
