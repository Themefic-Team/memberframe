/**
 * Nothing in the panel deletes on the first click (product owner, 2026-10-19;
 * Framer's review expects a double check). Every delete, remove, revoke, or
 * disconnect goes through the kit's `<ConfirmDialog>` popup.
 *
 * Read from source, like the other panel structure tests: there is no DOM
 * test environment, and the point is that no file calls the delete straight
 * from a button.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(__dirname, "..", "src", path), "utf8");

/** Each file with a destructive action, and the button handler that must only open the popup. */
const DESTRUCTIVE: ReadonlyArray<{ file: string; opens: ReadonlyArray<string> }> = [
  { file: "components/manage/MemberFlyout.tsx", opens: ['setConfirming("revoke")', 'setConfirming("delete")'] },
  { file: "components/manage/FilesPanel.tsx", opens: ["setConfirmDeleteId(asset.id)"] },
  { file: "components/manage/PaymentsPanel.tsx", opens: ["setConfirmRemove(true)"] },
  { file: "components/manage/TierEditor.tsx", opens: ["setConfirmDelete(true)"] },
  { file: "components/settings/WebhooksPanel.tsx", opens: ["setConfirmingDelete(true)"] },
  { file: "components/settings/CustomFieldsPanel.tsx", opens: ["setRemovingIndex(index)"] },
  { file: "components/settings/PageLocksPanel.tsx", opens: ["setRemovingIndex(index)"] },
  { file: "components/settings/SectionLocksEditor.tsx", opens: ["setRemovingIndex(index)"] },
];

describe("every delete asks first, in a popup", () => {
  it.each(DESTRUCTIVE)("$file opens the ConfirmDialog instead of deleting", ({ file, opens }) => {
    const source = read(file);
    expect(source).toContain("<ConfirmDialog");
    for (const handler of opens) expect(source).toContain(`onClick={() => ${handler}}`);
  });

  it("no two-press buttons or inline confirms are left", () => {
    for (const { file } of DESTRUCTIVE) {
      const source = read(file);
      expect(source).not.toContain('"Confirm delete"');
      expect(source).not.toContain('"Confirm remove"');
      expect(source).not.toContain("member-flyout-confirm");
    }
  });

  it("no trash button calls a delete directly", () => {
    for (const { file } of DESTRUCTIVE) {
      const source = read(file);
      expect(source).not.toMatch(/onClick=\{\(\) => (void )?(remove|handleRemove|onDelete|onDisconnect|deleteAsset|deleteWebhook)\(/);
    }
  });

  it("starts on the safe button, so Enter keeps the thing", () => {
    const dialog = read("components/ui/ConfirmDialog.tsx");
    expect(dialog).toContain("keep.current?.focus()");
    expect(dialog).toContain('variant="danger"');
  });
});
