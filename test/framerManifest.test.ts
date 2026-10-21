/**
 * framer.json's permissions must be the SDK's permission names, not its
 * method names. They usually match, but not always: removing nodes is the
 * method `removeNodes` and the permission `removeNodes2`. Framer refuses to
 * load a plugin that declares an unknown permission ("Failed to load
 * MemberFrame"), which is how this was found (2026-10-20).
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sdk = readFileSync(join(__dirname, "..", "node_modules", "framer-plugin", "dist", "index.d.ts"), "utf8");
const manifest = JSON.parse(readFileSync(join(__dirname, "..", "framer.json"), "utf8")) as { permissions: string[] };

/** Every permission name in the SDK's method-to-permission map: the strings inside `readonly x: ["..."]`. */
const permissionNames = new Set(
  [...sdk.matchAll(/readonly [\w".]+: \[([^\]]*)\];/g)].flatMap((match) =>
    [...match[1].matchAll(/"([^"]+)"/g)].map((name) => name[1])
  )
);

describe("framer.json", () => {
  it("declares only permission names the SDK knows", () => {
    expect(permissionNames.size).toBeGreaterThan(20);
    for (const permission of manifest.permissions) expect(permissionNames, permission).toContain(permission);
  });

  it("asks for node removal by its permission name", () => {
    expect(manifest.permissions).toContain("removeNodes2");
    expect(manifest.permissions).not.toContain("removeNodes");
  });
});
