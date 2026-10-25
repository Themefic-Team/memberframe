/**
 * The webhook settings, redesigned 2026-10-22: each part in its own titled
 * well, events and plans as the locks' tick tiles, the secret beside its own
 * buttons, and the long preview folded away.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const panel = readFileSync(join(__dirname, "..", "src", "components", "settings", "WebhooksPanel.tsx"), "utf8");
const css = readFileSync(join(__dirname, "..", "src", "styles", "settings.css"), "utf8");

describe("the webhook settings", () => {
  it("shows no delivery log and no Working or Failing status (2026-10-25)", () => {
    expect(panel).not.toContain("Recent deliveries");
    expect(panel).not.toContain("fetchWebhookDeliveries");
    expect(panel).not.toContain("lastDelivery");
    expect(panel).not.toMatch(/"Working"|"Failing"/);
    expect(panel).toContain('ok ? "Test sent"');
  });

  it("puts each part in a titled well", () => {
    for (const title of ["Destination", "Send when", "For members on", "Fields sent", "Signing secret"]) {
      expect(panel, title).toContain(`title="${title}"`);
    }
    expect(css).toMatch(/\.webhook-section \{[^}]*background: var\(--framer-color-bg-secondary\);/);
  });

  it("uses the locks' tick tiles for events and plans, with a count, not plain checkboxes", () => {
    expect(panel).not.toContain("<Checkbox");
    expect(panel).toContain('className={cn("tier-option", item.checked && "is-checked", disabled && "is-locked")}');
    expect(panel).toContain("meta={`${draft.events.length} of ${WEBHOOK_EVENTS.length} selected`}");
    // All plans is no plan ticked; picking it clears them.
    expect(panel).toContain('if (key === "__all__") return onChange({ ...draft, tiers: [] });');
  });

  it("keeps the secret's show and copy buttons beside it, and Save and Send test together", () => {
    const secret = panel.slice(panel.indexOf('title="Signing secret"'));
    expect(secret).toContain('label="Copy secret"');
    expect(secret).toContain('label={revealed ? "Hide secret" : "Show secret"}');
    const actions = panel.slice(panel.indexOf('<div className="webhook-actions">', panel.indexOf("const WebhookCard")));
    expect(actions.slice(0, actions.indexOf("</div>"))).toContain("Send test");
  });

  it("shows the address's host under the name, and folds the preview away", () => {
    expect(panel).toContain('<span className="webhook-card-host">{hostOf(hook.url)}</span>');
    expect(panel).toContain('<details className="webhook-preview-details">');
  });
});
