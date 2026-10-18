import { describe, expect, it } from "vitest";
import {
  createFramerMock,
  MockPluginClosedError,
  PLUGIN_DATA_BYTE_LIMIT,
  pluginDataByteLength,
} from "../src/utils/framerMock";

/**
 * PRD task 0.8 acceptance: unit tests run with no Framer desktop app.
 *
 * Nothing here imports the `framer` singleton as a value, only as a type, so
 * the suite never tries to reach a parent window. That is the whole point of
 * the mock and the first thing worth proving.
 */
describe("Framer SDK mock", () => {
  it("defaults to canvas mode", () => {
    expect(createFramerMock().mode).toBe("canvas");
  });

  it("returns only fields the real SDK returns", async () => {
    const framer = createFramerMock();

    const project = await framer.getProjectInfo();
    const user = await framer.getCurrentUser();

    expect(Object.keys(project).sort()).toEqual(["apiVersion1Id", "id", "name"]);
    expect(Object.keys(user).sort()).toEqual(["apiVersion1Id", "id", "initials", "name"]);

    // Regression guards. The company reference mock returns both of these and
    // the SDK does not. See the header of framerMock.ts.
    expect("slug" in project).toBe(false);
    expect("email" in user).toBe(false);
  });

  it("fills every required field of Publish", async () => {
    const { production } = await createFramerMock().getPublishInfo();

    expect(production).not.toBeNull();
    expect(Object.keys(production ?? {}).sort()).toEqual([
      "currentPageUrl",
      "deploymentTime",
      "optimizationStatus",
      "url",
    ]);
  });

  it("records showUI calls", async () => {
    const framer = createFramerMock();

    await framer.showUI({ position: "top right", width: 360, height: 640 });

    expect(framer.calls.showUI).toEqual([{ position: "top right", width: 360, height: 640 }]);
  });

  it("throws from closePlugin, like the real SDK", () => {
    const framer = createFramerMock();

    expect(() => framer.closePlugin("Done")).toThrow(MockPluginClosedError);
    expect(framer.calls.closePlugin).toEqual([{ message: "Done" }]);
  });

  it("lets a test deny every permission", () => {
    const framer = createFramerMock({ isAllowedTo: () => false });

    expect(framer.isAllowedTo("setPluginData")).toBe(false);
    expect(createFramerMock().isAllowedTo("setPluginData")).toBe(true);
  });
});

describe("plugin data store", () => {
  it("round-trips a value and reports a miss as null", async () => {
    const framer = createFramerMock();

    await framer.setPluginData("memberframe.tiers", "[]");

    expect(await framer.getPluginData("memberframe.tiers")).toBe("[]");
    expect(await framer.getPluginData("memberframe.absent")).toBeNull();
  });

  it("deletes on a null value", async () => {
    const framer = createFramerMock();

    await framer.setPluginData("memberframe.tiers", "[]");
    await framer.setPluginData("memberframe.tiers", null);

    expect(await framer.getPluginData("memberframe.tiers")).toBeNull();
    expect(framer.pluginData.size).toBe(0);
  });

  it("rejects a value over the 2kB limit", async () => {
    const framer = createFramerMock();
    const tooBig = "a".repeat(PLUGIN_DATA_BYTE_LIMIT + 1);

    await expect(framer.setPluginData("memberframe.big", tooBig)).rejects.toThrow(/2048 byte limit/);
    expect(framer.pluginData.has("memberframe.big")).toBe(false);
  });

  it("accepts a value exactly at the limit", async () => {
    const framer = createFramerMock();

    await framer.setPluginData("memberframe.exact", "a".repeat(PLUGIN_DATA_BYTE_LIMIT));

    expect(framer.pluginData.size).toBe(1);
  });

  it("measures the limit in UTF-8 bytes, not UTF-16 code units", async () => {
    const framer = createFramerMock();

    // 1024 three-byte characters: 1024 code units, 3072 bytes. A String.length
    // check would wave this through and Framer would reject it.
    const japanese = "日".repeat(1024);

    expect(japanese.length).toBeLessThan(PLUGIN_DATA_BYTE_LIMIT);
    expect(pluginDataByteLength(japanese)).toBe(3072);
    await expect(framer.setPluginData("memberframe.jp", japanese)).rejects.toThrow(
      /3072 bytes/
    );
  });
});

describe("code files", () => {
  it("starts empty and returns what was created", async () => {
    const framer = createFramerMock();

    expect(await framer.getCodeFiles()).toEqual([]);

    await framer.createCodeFile("MemberAuth.tsx", "export default function MemberAuth() {}");
    const files = await framer.getCodeFiles();

    expect(files).toHaveLength(1);
    expect(files[0]?.name).toBe("MemberAuth.tsx");
    expect(framer.calls.createCodeFile).toEqual([
      { name: "MemberAuth.tsx", code: "export default function MemberAuth() {}" },
    ]);
  });

  it("rewrites content in place, which F19 Pro-Lock patching depends on", async () => {
    const framer = createFramerMock();
    const file = await framer.createCodeFile("Gate.tsx", "const IS_LOCKED = true;");

    await file.setFileContent("const IS_LOCKED = false;");

    const [stored] = await framer.getCodeFiles();
    expect(stored?.content).toBe("const IS_LOCKED = false;");
  });

  it("removes a file from the list", async () => {
    const framer = createFramerMock();
    const file = await framer.createCodeFile("Gate.tsx", "");

    await file.remove();

    expect(await framer.getCodeFiles()).toEqual([]);
  });

  it.each(["configureManagedCollection", "syncManagedCollection"] as const)(
    "refuses getCodeFiles in %s mode",
    async (mode) => {
      const framer = createFramerMock({ mode });

      await expect(framer.getCodeFiles()).rejects.toThrow(/Check framer.mode first/);
    }
  );
});
