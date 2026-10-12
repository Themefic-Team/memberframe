/**
 * Framer Plugin SDK mock. PRD task 0.8, PRD section 16.1 layer 1.
 *
 * Unit tests must run with no Framer desktop app and no iframe parent. The real
 * `framer` singleton posts messages to a parent window on first use, so nothing
 * that touches it can be tested directly. Code under test takes this mock
 * instead.
 *
 * ## Typed against the SDK, not against the reference sample
 *
 * `.agents/skills/framer-plugin-suite/references/tdd-and-verification.md`
 * section 2 gives an untyped sample mock. Three of its return shapes do not
 * match `framer-plugin` 3.10.3:
 *
 *   1. `getProjectInfo()` returns a `slug`. `ProjectInfo` has `name`, `id`, and
 *      `apiVersion1Id`. There is no `slug`.
 *   2. `getCurrentUser()` returns an `email`. `User` has `name`, `id`,
 *      `apiVersion1Id`, `initials`, and an optional `avatarUrl`. There is no
 *      `email`. See the ledger blocker on PRD section 13: the telemetry table
 *      sources `userEmail` from `getCurrentUser()` and the SDK cannot supply it.
 *   3. `getPublishInfo()` returns `production: { url }`. `Publish` also requires
 *      `deploymentTime`, `optimizationStatus`, and `currentPageUrl`.
 *
 * A mock that returns fields the SDK never returns is worse than no mock: the
 * tests pass and production reads `undefined`. So the method signatures below
 * are `Pick`ed from the real `framer` type. If the SDK changes a signature, this
 * file stops compiling and `tsc --noEmit` says so. That is the point.
 *
 * ## Scope
 *
 * Only the calls MemberFrame actually makes. `FramerPluginAPI` has several
 * hundred members and a mock claiming to implement all of them would be a lie.
 * Widen `SdkMembers` when a feature needs another call.
 *
 * Widened by task 1.5 with the four canvas calls the F01 deploy path needs:
 * `createCodeFile`, `CodeFile.setFileContent`, `addComponentInstance`, and
 * `setParent`. `MockCodeFile` gained `exports`, because `insertURL` lives there
 * and insertion is impossible without it.
 */

import type { framer, Mode, ProjectInfo, PublishInfo, UIOptions, User } from "framer-plugin";

/**
 * The SDK calls reproduced with their exact real signatures.
 *
 * `closePlugin` is typed `(message?, options?) => never` by the SDK because it
 * throws `FramerPluginClosedError`. The mock throws too, so a caller that
 * forgets to let the throw escape fails in a test rather than in Framer.
 */
type SdkMembers = Pick<
  typeof framer,
  | "mode"
  | "getProjectInfo"
  | "getPublishInfo"
  | "getCurrentUser"
  | "isAllowedTo"
  | "showUI"
  | "hideUI"
  | "notify"
  | "closePlugin"
  | "getPluginData"
  | "setPluginData"
>;

/**
 * A code file narrowed to the members MemberFrame reads and writes.
 *
 * The real `CodeFile` is a class with private fields and a constructor that
 * needs a `PluginEngine`, so it cannot be instantiated in a test. The narrowing
 * runs the safe direction: a real `CodeFile` satisfies this interface, so
 * production code that accepts `MockCodeFile` accepts both. The compile-time
 * assertion at the bottom of this file proves it.
 *
 * Convention for F19 Pro-Lock and F20 telemetry: service functions take
 * `MockCodeFile`, never `CodeFile`. That keeps them testable without a cast.
 */
/**
 * One export of a code file.
 *
 * The SDK's `CodeFileExport` is a union: a component export carries an
 * `insertURL` and an override export does not. Both are assignable to this
 * shape, so the narrowing runs the same safe direction as `MockCodeFile`.
 *
 * `insertURL` is what `addComponentInstance` consumes, and Framer only knows it
 * after it has compiled the file. Widened in task 1.5 for that reason.
 */
export interface MockCodeFileExport {
  readonly name: string;
  readonly isDefaultExport: boolean;
  readonly type: string;
  readonly insertURL?: string;
}

export interface MockCodeFile {
  readonly id: string;
  readonly name: string;
  readonly path: string;
  readonly content: string;
  readonly exports: ReadonlyArray<MockCodeFileExport>;
  setFileContent(code: string): Promise<MockCodeFile>;
  remove(): Promise<void>;
}

/** A canvas node, narrowed to the one member the deploy path reads. */
export interface MockCanvasNode {
  readonly id: string;
}

interface CanvasMembers {
  getCodeFiles(): Promise<readonly MockCodeFile[]>;
  createCodeFile(name: string, code: string): Promise<MockCodeFile>;
  addComponentInstance(options: { url: string }): Promise<MockCanvasNode>;
  setParent(nodeId: string, parentId: string, index?: number): Promise<void>;
}

/** Everything the mock recorded, for assertions. */
export interface MockCallLog {
  showUI: UIOptions[];
  hideUI: number;
  notify: Array<{ message: string; hasButton: boolean }>;
  getPluginData: string[];
  setPluginData: Array<{ key: string; value: string | null }>;
  getCodeFiles: number;
  createCodeFile: Array<{ name: string; code: string }>;
  setFileContent: Array<{ id: string; code: string }>;
  addComponentInstance: Array<{ url: string }>;
  setParent: Array<{ nodeId: string; parentId: string; index?: number }>;
  closePlugin: Array<{ message?: string }>;
}

export interface FramerMock extends SdkMembers, CanvasMembers {
  /** Every call the mock saw. */
  readonly calls: MockCallLog;
  /** The backing store for `getPluginData` and `setPluginData`. Seed it directly. */
  readonly pluginData: Map<string, string>;
}

/**
 * Thrown by the mock's `closePlugin`, mirroring `FramerPluginClosedError`.
 * The SDK documents that error as safe to ignore, so production code wraps the
 * call. Tests assert on this class to prove the wrap exists.
 */
export class MockPluginClosedError extends Error {
  constructor(message = "Plugin closed.") {
    super(message);
    this.name = "MockPluginClosedError";
  }
}

/**
 * Modes in which `getCodeFiles` is not available.
 *
 * `.agents/rules/framer-sdd-standards.md`: always check `framer.mode` before
 * `framer.getCodeFiles()`, and never call it during a managed-collection mode.
 * The mock rejects instead of returning an empty array, so a missing guard
 * fails a test rather than silently reading zero files and concluding the site
 * has no components.
 */
const CODE_FILES_FORBIDDEN_MODES: ReadonlySet<Mode> = new Set<Mode>([
  "configureManagedCollection",
  "syncManagedCollection",
]);

/** PRD section 11. Framer caps a single `setPluginData` value at 2kB. */
export const PLUGIN_DATA_BYTE_LIMIT = 2048;

/**
 * UTF-8 byte length, not `String.length`.
 *
 * `String.length` counts UTF-16 code units, so a value full of multi-byte
 * characters passes a 2048 check and then fails in Framer. A creator naming a
 * tier in Japanese is enough to hit this.
 */
export function pluginDataByteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

const DEFAULT_PROJECT_INFO: ProjectInfo = {
  id: "test-site-id-123",
  name: "Test Framer Project",
  apiVersion1Id: "v1-test-site-id-123",
};

const DEFAULT_USER: User = {
  id: "user-123",
  name: "Alex Designer",
  apiVersion1Id: "v1-user-123",
  initials: "AD",
};

const DEFAULT_PUBLISH_INFO: PublishInfo = {
  production: {
    url: "https://example.framer.app",
    currentPageUrl: "https://example.framer.app/",
    deploymentTime: 0,
    optimizationStatus: "optimized",
  },
  staging: null,
};

function emptyCallLog(): MockCallLog {
  return {
    showUI: [],
    hideUI: 0,
    notify: [],
    getPluginData: [],
    setPluginData: [],
    getCodeFiles: 0,
    createCodeFile: [],
    setFileContent: [],
    addComponentInstance: [],
    setParent: [],
    closePlugin: [],
  };
}

/**
 * Build a stand-in for the `framer` singleton.
 *
 * `overrides` is spread last, matching the company reference signature, so any
 * member can be replaced wholesale:
 *
 * ```ts
 * const framer = createFramerMock({ mode: "syncManagedCollection" });
 * const framer = createFramerMock({ isAllowedTo: () => false });
 * ```
 *
 * Overriding a member also opts out of its call log entry, because the log is
 * written by the default implementation.
 */
export function createFramerMock(overrides: Partial<FramerMock> = {}): FramerMock {
  const calls = emptyCallLog();
  const pluginData = new Map<string, string>();
  let nextCodeFileId = 0;
  let nextNodeId = 0;
  const codeFiles: MockCodeFile[] = [];
  const mode: Mode = overrides.mode ?? "canvas";

  function makeCodeFile(name: string, code: string): MockCodeFile {
    const id = `code-file-${nextCodeFileId++}`;
    let content = code;

    /**
     * The default export, as Framer reports it once the file has compiled.
     *
     * A test covering the not-yet-compiled case overrides `createCodeFile`
     * wholesale and returns a file with no exports, which is the real SDK
     * behaviour right after creation.
     */
    const exportEntry: MockCodeFileExport = {
      name: name.replace(/\.tsx?$/, ""),
      isDefaultExport: true,
      type: "component",
      insertURL: `https://framer.com/m/${id}.js`,
    };

    const file: MockCodeFile = {
      id,
      name,
      path: `/code/${name}`,
      exports: [exportEntry],
      get content() {
        return content;
      },
      async setFileContent(next: string) {
        calls.setFileContent.push({ id, code: next });
        content = next;
        return file;
      },
      async remove() {
        const index = codeFiles.indexOf(file);
        if (index !== -1) {
          codeFiles.splice(index, 1);
        }
      },
    };

    return file;
  }

  const mock: FramerMock = {
    mode,
    calls,
    pluginData,

    getProjectInfo: async () => DEFAULT_PROJECT_INFO,
    getPublishInfo: async () => DEFAULT_PUBLISH_INFO,
    getCurrentUser: async () => DEFAULT_USER,

    // Permissive by default. A test proving the UI disables a control passes
    // `isAllowedTo: () => false`.
    isAllowedTo: () => true,

    showUI: async (options?: UIOptions) => {
      calls.showUI.push(options ?? {});
    },

    hideUI: async () => {
      calls.hideUI += 1;
    },

    notify: (message, options) => {
      calls.notify.push({ message, hasButton: Boolean(options?.button) });
      return { close: async () => {} };
    },

    closePlugin: (message?: string) => {
      calls.closePlugin.push({ message });
      throw new MockPluginClosedError(message);
    },

    getPluginData: async (key: string) => {
      calls.getPluginData.push(key);
      return pluginData.get(key) ?? null;
    },

    setPluginData: async (key: string, value: string | null) => {
      calls.setPluginData.push({ key, value });

      if (value === null) {
        pluginData.delete(key);
        return;
      }

      const bytes = pluginDataByteLength(value);
      if (bytes > PLUGIN_DATA_BYTE_LIMIT) {
        throw new Error(
          `setPluginData("${key}") is ${bytes} bytes, over the ${PLUGIN_DATA_BYTE_LIMIT} byte limit. Compress differentially, PRD section 11.`
        );
      }

      pluginData.set(key, value);
    },

    getCodeFiles: async () => {
      calls.getCodeFiles += 1;

      if (CODE_FILES_FORBIDDEN_MODES.has(mock.mode)) {
        throw new Error(
          `getCodeFiles() is not available in "${mock.mode}" mode. Check framer.mode first.`
        );
      }

      return codeFiles;
    },

    createCodeFile: async (name: string, code: string) => {
      calls.createCodeFile.push({ name, code });
      const file = makeCodeFile(name, code);
      codeFiles.push(file);
      return file;
    },

    addComponentInstance: async (options: { url: string }) => {
      calls.addComponentInstance.push({ url: options.url });
      return { id: `node-${nextNodeId++}` };
    },

    setParent: async (nodeId: string, parentId: string, index?: number) => {
      calls.setParent.push({ nodeId, parentId, index });
    },

    ...overrides,
  };

  return mock;
}

/**
 * Compile-time proof that `MockCodeFile` is a true subset of the SDK class, so
 * production code written against the narrow interface also accepts the real
 * thing. If the SDK renames a member this assignment fails and the build stops.
 */
type RealCodeFileSatisfiesMock = Awaited<ReturnType<typeof framer.getCodeFiles>>[number] extends
  Omit<MockCodeFile, "setFileContent">
  ? true
  : false;

const _realCodeFileSatisfiesMock: RealCodeFileSatisfiesMock = true;
void _realCodeFileSatisfiesMock;
