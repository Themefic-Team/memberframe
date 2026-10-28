/**
 * The Framer canvas service. PRD task 1.5, feature F01.
 *
 * Layer 1 of the PRD section 16.1 triad. Nothing here imports the `framer`
 * singleton: per CLAUDE.md it posts to a parent window that does not exist in a
 * test, so the deploy path takes the narrow `CanvasDeps` interface and these
 * tests hand it `createFramerMock`.
 *
 * The service is the only code in the repo that writes to a creator's project,
 * so the failure paths are the point. Every one of them has to leave the
 * creator with something they can act on, and none of them may report success
 * for a deploy that did not land.
 */

import { describe, expect, it } from "vitest";
import {
  EXPORT_RETRY_DELAYS_MS,
  REPARENT_METHOD,
  SCAFFOLD_EXPORT_RETRY_DELAYS_MS,
  WRITE_METHODS,
  WRITE_RETRY_DELAYS_MS,
  deployCanvasComponent,
  type CanvasDeps,
} from "../src/services/framerCanvasService";
import { generateMeteredPaywallCode } from "../src/services/canvasComponentCodeGenerator";
import { createFramerMock, type FramerMock, type MockCodeFile } from "../src/utils/framerMock";
import { DEFAULT_METERED_PAYWALL_CONFIG } from "../src/types/canvas";

const generated = generateMeteredPaywallCode(DEFAULT_METERED_PAYWALL_CONFIG);

/**
 * The mock satisfies the narrow interface, so this is a cast-free handover and
 * the compiler is checking the same shape production passes.
 */
function deps(mock: FramerMock): CanvasDeps {
  return mock;
}

describe("deployCanvasComponent: the happy path", () => {
  it("creates the file and inserts one instance", async () => {
    const mock = createFramerMock();
    const outcome = await deployCanvasComponent(deps(mock), generated);

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    expect(outcome.action).toBe("created");
    expect(outcome.fileName).toBe("MeteredPaywall.tsx");
    expect(outcome.nodeId).toBeTruthy();
    expect(mock.calls.createCodeFile).toHaveLength(1);
    expect(mock.calls.addComponentInstance).toHaveLength(1);
  });

  it("writes the generated code, not a placeholder", async () => {
    const mock = createFramerMock();
    await deployCanvasComponent(deps(mock), generated);

    expect(mock.calls.createCodeFile[0].code).toBe(generated.code);
    expect(mock.calls.createCodeFile[0].name).toBe("MeteredPaywall.tsx");
  });

  it("inserts by the component export's own URL", async () => {
    const mock = createFramerMock();
    await deployCanvasComponent(deps(mock), generated);

    const files = await mock.getCodeFiles();
    const expected = files[0].exports[0].insertURL;

    expect(mock.calls.addComponentInstance[0].url).toBe(expected);
  });

  it("passes attributes to addComponentInstance when provided", async () => {
    const mock = createFramerMock();
    const attrs = { controls: { assetId: "ast_test123", buttonText: "Download Kit" } };
    await deployCanvasComponent(deps(mock), generated, { attributes: attrs });

    expect(mock.calls.addComponentInstance[0].attributes).toEqual(attrs);
  });
});

describe("deployCanvasComponent: a second deploy updates rather than duplicating", () => {
  it("overwrites the existing file and reports updated", async () => {
    const mock = createFramerMock();
    await deployCanvasComponent(deps(mock), generated);

    const second = generateMeteredPaywallCode({
      ...DEFAULT_METERED_PAYWALL_CONFIG,
      cardTitle: "Second pass",
    });
    const outcome = await deployCanvasComponent(deps(mock), second);

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    expect(outcome.action).toBe("updated");
    expect(mock.calls.createCodeFile).toHaveLength(1);
    expect(mock.calls.setFileContent).toHaveLength(1);

    // One component file, two instances. A creator adjusting the customizer and
    // clicking again must not end up with MeteredPaywall.tsx and MeteredPaywall 2.tsx.
    const files = await mock.getCodeFiles();
    expect(files).toHaveLength(1);
    expect(files[0].content).toContain("Second pass");
    expect(mock.calls.addComponentInstance).toHaveLength(2);
  });

  it("leaves an unchanged file alone, so Framer does not compile it again", async () => {
    const mock = createFramerMock();
    await deployCanvasComponent(deps(mock), generated);
    const outcome = await deployCanvasComponent(deps(mock), generated);

    expect(outcome.ok).toBe(true);
    expect(mock.calls.setFileContent).toHaveLength(0);
    expect(mock.calls.addComponentInstance).toHaveLength(2);
  });

  it("matches the existing file by name, ignoring unrelated code files", async () => {
    const mock = createFramerMock();
    await mock.createCodeFile("SomeoneElse.tsx", "export default function X() { return null; }");
    await deployCanvasComponent(deps(mock), generated);

    const files = await mock.getCodeFiles();
    expect(files).toHaveLength(2);
    expect(mock.calls.setFileContent).toHaveLength(0);
  });
});

describe("deployCanvasComponent: it refuses before it touches anything", () => {
  it("stops outside canvas mode", async () => {
    // .agents/rules/ forbids getCodeFiles() during a managed collection mode.
    // Requiring canvas mode satisfies that without enumerating forbidden modes.
    const mock = createFramerMock({ mode: "syncManagedCollection" });
    const outcome = await deployCanvasComponent(deps(mock), generated);

    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;

    expect(outcome.reason).toBe("unsupported_mode");
    expect(mock.calls.getCodeFiles).toBe(0);
    expect(mock.calls.createCodeFile).toHaveLength(0);
  });

  it("stops when the project has not granted the write permissions", async () => {
    const mock = createFramerMock({ isAllowedTo: () => false });
    const outcome = await deployCanvasComponent(deps(mock), generated);

    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;

    expect(outcome.reason).toBe("permission_denied");
    expect(mock.calls.createCodeFile).toHaveLength(0);
  });

  it("asks for the three write methods by their SDK method keys", async () => {
    // Conflict C3: framer.json takes permission strings and isAllowedTo takes
    // method keys. Asserting the method keys here means a future edit that
    // pastes the framer.json strings in by mistake fails this test instead of
    // failing silently in Framer, where isAllowedTo would answer about a
    // method that does not exist.
    const asked: string[][] = [];
    const mock = createFramerMock({
      isAllowedTo: (...methods) => {
        asked.push([...methods]);
        return true;
      },
    });

    await deployCanvasComponent(deps(mock), generated);

    expect(asked[0]).toEqual([
      "createCodeFile",
      "CodeFile.setFileContent",
      "addComponentInstance",
    ]);
    expect(WRITE_METHODS).toHaveLength(3);
    expect(WRITE_METHODS).not.toContain("getCodeFiles");
  });

  it("refuses a reparent it is not allowed to perform", async () => {
    const mock = createFramerMock({
      isAllowedTo: (...methods) => !methods.includes(REPARENT_METHOD),
    });

    const outcome = await deployCanvasComponent(deps(mock), generated, { parentId: "frame-1" });

    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;

    expect(outcome.reason).toBe("permission_denied");
    expect(mock.calls.createCodeFile).toHaveLength(0);
  });
});

describe("deployCanvasComponent: the insert URL may not be ready yet", () => {
  /**
   * Framer compiles a code file before it can report what it exports, so
   * `exports` can be empty on the object `createCodeFile` hands back while the
   * same file in `getCodeFiles()` already carries it. The service re-reads for
   * exactly this case.
   */
  /** A file Framer never compiles: no exports, however it is read or saved again. */
  function uncompiled(file: MockCodeFile, exports: MockCodeFile["exports"] = []): MockCodeFile {
    return {
      ...file,
      exports,
      setFileContent: async (code: string) => uncompiled(await file.setFileContent(code), exports),
    };
  }

  function mockWithDelayedExports(everReady: boolean): FramerMock {
    const base = createFramerMock();

    return createFramerMock({
      // createCodeFile always hands back a file whose exports are not known
      // yet, which is the behaviour being modelled.
      createCodeFile: async (name: string, code: string) => {
        const stored = await base.createCodeFile(name, code);
        return { ...stored, exports: [] };
      },
      // The list is where they turn up, unless the file never compiles at all.
      getCodeFiles: async () => {
        const files = await base.getCodeFiles();
        return everReady ? files : files.map((file) => uncompiled(file));
      },
    });
  }

  it("re-reads the file list and recovers", async () => {
    const mock = mockWithDelayedExports(true);
    const outcome = await deployCanvasComponent(deps(mock), generated);

    expect(outcome.ok).toBe(true);
    expect(mock.calls.addComponentInstance).toHaveLength(1);
  });

  it("keeps re-reading while Framer compiles, then inserts", async () => {
    const base = createFramerMock();
    let reads = 0;
    const mock = createFramerMock({
      createCodeFile: async (name: string, code: string) => ({ ...(await base.createCodeFile(name, code)), exports: [] }),
      // Two reads to find the file, then four more while it compiles.
      getCodeFiles: async () => {
        const files = await base.getCodeFiles();
        reads += 1;
        return reads >= 6 ? files : files.map((file) => ({ ...file, exports: [] }));
      },
    });

    const outcome = await deployCanvasComponent(deps(mock), generated, { exportRetryDelaysMs: [0, 0, 0, 0, 0, 0] });

    expect(outcome.ok).toBe(true);
    expect(mock.calls.addComponentInstance).toHaveLength(1);
  });

  it("waits a bounded time by default", () => {
    const total = EXPORT_RETRY_DELAYS_MS.reduce((sum, ms) => sum + ms, 0);
    expect(total).toBeGreaterThanOrEqual(10_000);
    expect(total).toBeLessThanOrEqual(20_000);
  });

  it("waits longer, still bounded, when Create pages places several at once", () => {
    const total = SCAFFOLD_EXPORT_RETRY_DELAYS_MS.reduce((sum, ms) => sum + ms, 0);
    expect(total).toBeGreaterThanOrEqual(45_000);
    expect(total).toBeLessThanOrEqual(90_000);
  });

  it("says the file was saved but not inserted when the export never appears", async () => {
    const mock = mockWithDelayedExports(false);
    const outcome = await deployCanvasComponent(deps(mock), generated, { exportRetryDelaysMs: [0, 0] });

    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;

    expect(outcome.reason).toBe("no_component_export");
    // The file really is in the project, so the copy must not imply otherwise.
    expect(outcome.message).toContain("MeteredPaywall.tsx is in the project");
    expect(mock.calls.addComponentInstance).toHaveLength(0);
  });

  it("names Framer's own first error when the file never compiles", async () => {
    const base = createFramerMock();
    // Every file object Framer hands back can typecheck, however it was read.
    const typecheck = async () => [
      { message: "A warning", category: 0 },
      { message: "Cannot find module 'lucide-react'.", category: 1, span: { start: { line: 4 } } },
    ];
    const broken = (file: MockCodeFile): MockCodeFile => ({
      ...file,
      exports: [],
      typecheck,
      setFileContent: async (code: string) => broken(await file.setFileContent(code)),
    } as MockCodeFile);
    const mock = createFramerMock({
      createCodeFile: async (name: string, code: string) => broken(await base.createCodeFile(name, code)),
      getCodeFiles: async () => (await base.getCodeFiles()).map(broken),
    });
    const outcome = await deployCanvasComponent(deps(mock), generated, { exportRetryDelaysMs: [0] });

    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.reason).toBe("no_component_export");
    expect(outcome.detail).toBe("The first problem it reports: Cannot find module 'lucide-react'. (line 5)");
    expect(outcome.message).toContain("MeteredPaywall.tsx is in the project but Framer has not offered its component.");
  });

  it("says what Framer exports when none of it is a component", async () => {
    const base = createFramerMock();
    const helperOnly = (file: MockCodeFile) => uncompiled(file, [{ name: "helper", isDefaultExport: false, type: "override" }]);
    const mock = createFramerMock({
      createCodeFile: async (name: string, code: string) => helperOnly(await base.createCodeFile(name, code)),
      getCodeFiles: async () => (await base.getCodeFiles()).map(helperOnly),
    });
    const outcome = await deployCanvasComponent(deps(mock), generated, { exportRetryDelaysMs: [0] });

    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.detail).toBe("Framer lists its exports as helper (override), with no component among them.");
  });

  it("saves an unchanged file again when Framer offers no component, so a stalled compile restarts", async () => {
    const base = createFramerMock();
    await base.createCodeFile(generated.fileName, generated.code);
    const noExports = createFramerMock({
      getCodeFiles: async () => (await base.getCodeFiles()).map((file) => uncompiled(file)),
    });
    // Same content, no component, so it is written with the line break toggled;
    // still none after the wait, so it is saved once more, toggled back.
    // The file object comes from the first mock, so its saves are recorded there.
    await deployCanvasComponent(deps(noExports), generated, { exportRetryDelaysMs: [0] });
    expect(base.calls.setFileContent.map((call) => call.code)).toEqual([`${generated.code}\n`, generated.code]);
  });

  it("saves once more by itself when the first save never compiles, then inserts", async () => {
    // Framer's save service failed behind an accepted save (2026-10-28): no
    // component until the file is saved again, which a second click used to do.
    const base = createFramerMock();
    let saved = false;
    const mock = createFramerMock({
      createCodeFile: async (name: string, code: string) => uncompiled(await base.createCodeFile(name, code)),
      getCodeFiles: async () => {
        const files = await base.getCodeFiles();
        return saved
          ? files
          : files.map((file) => ({
              ...uncompiled(file),
              setFileContent: async (code: string) => {
                saved = true;
                return file.setFileContent(code);
              },
            }));
      },
    });
    const outcome = await deployCanvasComponent(deps(mock), generated, { exportRetryDelaysMs: [0] });

    expect(outcome.ok).toBe(true);
    expect(mock.calls.addComponentInstance).toHaveLength(1);
  });

  it("inserts as soon as Framer pushes the compiled file, without waiting out the schedule", async () => {
    const base = createFramerMock();
    let push: ((files: ReadonlyArray<MockCodeFile>) => void) | null = null;
    const mock = createFramerMock({
      createCodeFile: async (name: string, code: string) => ({ ...(await base.createCodeFile(name, code)), exports: [] }),
      getCodeFiles: async () => (await base.getCodeFiles()).map((file) => uncompiled(file)),
    });
    const withPush: CanvasDeps = {
      ...deps(mock),
      getCodeFiles: mock.getCodeFiles,
      createCodeFile: mock.createCodeFile,
      addComponentInstance: mock.addComponentInstance,
      setParent: mock.setParent,
      isAllowedTo: mock.isAllowedTo,
      subscribeToCodeFiles: (callback) => {
        push = callback as (files: ReadonlyArray<MockCodeFile>) => void;
        return () => {
          push = null;
        };
      },
    };
    const started = Date.now();
    const outcome = deployCanvasComponent(withPush, generated, { exportRetryDelaysMs: [60_000] });
    setTimeout(() => void base.getCodeFiles().then((files) => push?.(files)), 20);
    const result = await outcome;

    expect(result.ok).toBe(true);
    expect(Date.now() - started).toBeLessThan(5_000);
  });

  it("ignores an override export, which carries no insert URL", async () => {
    const overrideOnly: MockCodeFile = {
      id: "code-file-override",
      name: "MeteredPaywall.tsx",
      path: "/code/MeteredPaywall.tsx",
      content: generated.code,
      exports: [{ name: "withGate", isDefaultExport: false, type: "override" }],
      setFileContent: async () => overrideOnly,
      remove: async () => {},
    };

    const mock = createFramerMock({
      createCodeFile: async () => overrideOnly,
      getCodeFiles: async () => [],
    });

    const outcome = await deployCanvasComponent(deps(mock), generated, { exportRetryDelaysMs: [0, 0] });

    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.reason).toBe("no_component_export");
  });
});

describe("deployCanvasComponent: SDK failures", () => {
  it("reports a write failure without claiming the component landed", async () => {
    const mock = createFramerMock({
      createCodeFile: async () => {
        throw new Error("read only project");
      },
    });

    const outcome = await deployCanvasComponent(deps(mock), generated, { writeRetryDelaysMs: [0, 0] });

    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;

    expect(outcome.reason).toBe("write_failed");
    expect(mock.calls.addComponentInstance).toHaveLength(0);
  });

  it("saves again when Framer refuses the first save, as its save service does now and then", async () => {
    // 2026-10-28: a 502 from Framer's modules service, "Connection error". The
    // first click failed and the second worked; the retry is that second click.
    const base = createFramerMock();
    let attempts = 0;
    const mock = createFramerMock({
      createCodeFile: async (name: string, code: string) => {
        attempts += 1;
        if (attempts === 1) throw new Error("ServiceError.UnknownError: Connection error");
        return base.createCodeFile(name, code);
      },
      getCodeFiles: base.getCodeFiles,
    });

    const outcome = await deployCanvasComponent(deps(mock), generated, { writeRetryDelaysMs: [0, 0] });

    expect(outcome.ok).toBe(true);
    expect(attempts).toBe(2);
    expect(mock.calls.addComponentInstance).toHaveLength(1);
  });

  it("retries the save a bounded number of times", () => {
    expect(WRITE_RETRY_DELAYS_MS.length).toBeGreaterThan(0);
    expect(WRITE_RETRY_DELAYS_MS.reduce((sum, ms) => sum + ms, 0)).toBeLessThanOrEqual(5_000);
  });

  it("reports an insert failure and says the file is already saved", async () => {
    const mock = createFramerMock({
      addComponentInstance: async () => {
        throw new Error("canvas refused");
      },
    });

    const outcome = await deployCanvasComponent(deps(mock), generated);

    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;

    expect(outcome.reason).toBe("insert_failed");
    expect(outcome.message).toContain("in the project");

    // The write happened. A creator told only "insert failed" would reasonably
    // click again and would then be told the file was updated, which is fine,
    // but the copy has to match what is actually on disk.
    const files = await mock.getCodeFiles();
    expect(files).toHaveLength(1);
  });

  it("keeps a successful insert even when the reparent fails", async () => {
    const mock = createFramerMock({
      setParent: async () => {
        throw new Error("parent is not a container");
      },
    });

    const outcome = await deployCanvasComponent(deps(mock), generated, { parentId: "frame-1" });

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    // The instance exists and the creator can drag it. Discarding a successful
    // insert over a lost placement would be the worse outcome.
    expect(outcome.reparented).toBe(false);
    expect(outcome.nodeId).toBeTruthy();
  });
});

describe("deployCanvasComponent: reparenting", () => {
  it("moves the new instance under the requested parent", async () => {
    const mock = createFramerMock();
    const outcome = await deployCanvasComponent(deps(mock), generated, {
      parentId: "frame-1",
      index: 2,
    });

    expect(outcome.ok && outcome.reparented).toBe(true);
    expect(mock.calls.setParent).toHaveLength(1);
    expect(mock.calls.setParent[0]).toEqual({
      nodeId: mock.calls.setParent[0].nodeId,
      parentId: "frame-1",
      index: 2,
    });
  });

  it("reparents the node it just inserted, not some other node", async () => {
    const mock = createFramerMock();
    const outcome = await deployCanvasComponent(deps(mock), generated, { parentId: "frame-1" });

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(mock.calls.setParent[0].nodeId).toBe(outcome.nodeId);
  });
});

describe("every failure outcome is something a creator can act on", () => {
  const failures = [
    createFramerMock({ mode: "syncManagedCollection" }),
    createFramerMock({ isAllowedTo: () => false }),
    createFramerMock({
      createCodeFile: async () => {
        throw new Error("nope");
      },
    }),
    createFramerMock({
      addComponentInstance: async () => {
        throw new Error("nope");
      },
    }),
  ];

  it("gives every failure a title and a sentence, and leaks no enum value", async () => {
    for (const mock of failures) {
      const outcome = await deployCanvasComponent(deps(mock), generated);

      expect(outcome.ok).toBe(false);
      if (outcome.ok) continue;

      // PRD section 7.6 rule 4: never surface a raw enum value to a user. The
      // reason code is for the caller to branch on, never for the screen.
      expect(outcome.title.length).toBeGreaterThan(0);
      expect(outcome.message.endsWith(".")).toBe(true);
      expect(outcome.message).not.toContain(outcome.reason);
      expect(outcome.title).not.toContain("_");
    }
  });
});
