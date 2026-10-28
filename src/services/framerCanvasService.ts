/**
 * The Framer canvas service. PRD task 1.5, feature F01.
 *
 * Everything this plugin does to a creator's project goes through this file:
 * write the component file, then insert an instance of it. Four SDK calls, each
 * of which can fail for a reason the creator can act on, so the whole path
 * returns a tagged outcome rather than throwing.
 *
 * ## It returns an outcome, it does not notify
 *
 * No toast, no banner, no `framer.notify` here. `deployCanvasComponent` reports what
 * happened and the Builder tab decides what the creator sees. That keeps the
 * entire deploy path testable against `createFramerMock` with no DOM, which
 * matters because `jsdom` is not installed and nothing here could otherwise be
 * tested at all.
 *
 * ## It takes a narrow interface, not the `framer` singleton
 *
 * Same convention as `utils/framerMock.ts`: the real `framer` is assignable to
 * `CanvasDeps`, so a call site hands over the singleton unchanged and a test
 * hands over the mock. The assertion at the foot of this file proves the
 * direction holds, so an SDK signature change breaks `tsc --noEmit` here rather
 * than breaking a creator's project silently.
 *
 * ## Permission names are a different namespace from method names
 *
 * `framer.isAllowedTo` takes method keys: `"CodeFile.setFileContent"`.
 * `framer.json` takes permission strings: `"setCodeFileContent"`. PRD task 1.6
 * lists the method keys as though they were permissions. Conflict C3 in
 * `docs/development-docs/01-member-gate.md` section 5.1. The `ProtectedMethod`
 * type below is imported from the SDK precisely so a typo in a method key fails
 * the typecheck.
 */

import { withTimeout } from "../utils/withTimeout";
import { queueCodeFileWrite } from "../utils/codeFileQueue";
import type { Mode, ProtectedMethod, framer } from "framer-plugin";
import type { GeneratedCanvasFile } from "./canvasComponentCodeGenerator";

/**
 * One export of a code file, narrowed to what insertion needs.
 *
 * The SDK's `CodeFileExport` is a union of a component export, which carries
 * `insertURL`, and an override export, which does not. Both satisfy this shape,
 * so the narrowing runs in the safe direction.
 */
export interface CanvasCodeFileExport {
  readonly name: string;
  readonly isDefaultExport: boolean;
  readonly type: string;
  readonly insertURL?: string;
}

/** One problem Framer reports in a code file. `category` 1 is an error. */
export interface CanvasCodeDiagnostic {
  readonly message: string;
  readonly category: number;
  readonly span?: { readonly start: { readonly line: number } };
}

export interface CanvasCodeFile {
  readonly id: string;
  readonly name: string;
  readonly exports: ReadonlyArray<CanvasCodeFileExport>;
  setFileContent(code: string): Promise<CanvasCodeFile>;
  /** Optional: the mock has none. Read only to explain a file that never compiles. */
  typecheck?(): Promise<ReadonlyArray<CanvasCodeDiagnostic>>;
}

export interface CanvasNode {
  readonly id: string;
}

/** Exactly the SDK surface the deploy path touches. */
export interface CanvasDeps {
  readonly mode: Mode;
  isAllowedTo(...methods: [ProtectedMethod, ...ProtectedMethod[]]): boolean;
  getCodeFiles(): Promise<ReadonlyArray<CanvasCodeFile>>;
  createCodeFile(name: string, code: string): Promise<CanvasCodeFile>;
  addComponentInstance(options: Parameters<typeof framer.addComponentInstance>[0]): Promise<CanvasNode>;
  setParent(nodeId: string, parentId: string, index?: number): Promise<void>;
  /** Optional: the mock has none. Framer pushes the file list when a compile finishes. */
  subscribeToCodeFiles?(callback: (codeFiles: ReadonlyArray<CanvasCodeFile>) => void): () => void;
}

/**
 * The method keys the deploy path needs before it touches anything.
 *
 * `getCodeFiles` is absent on purpose: the SDK maps it to an empty permission
 * list, so it is unprotected and declaring it in `framer.json` would ask the
 * creator to approve something Framer does not gate.
 */
export const WRITE_METHODS: [ProtectedMethod, ...ProtectedMethod[]] = [
  "createCodeFile",
  "CodeFile.setFileContent",
  "addComponentInstance",
];

/** Checked separately, because the panel only needs it when reparenting. */
export const REPARENT_METHOD: ProtectedMethod = "setParent";

export type DeployFailureReason =
  | "unsupported_mode"
  | "permission_denied"
  | "write_failed"
  | "no_component_export"
  | "insert_failed";

export interface DeploySuccess {
  ok: true;
  /** Whether an existing file of the same name was overwritten. */
  action: "created" | "updated";
  fileName: string;
  fileId: string;
  /** The inserted instance, for a follow-up selection or reparent. */
  nodeId: string;
  reparented: boolean;
}

export interface DeployFailure {
  ok: false;
  reason: DeployFailureReason;
  /** Short, for a Banner title. */
  title: string;
  /** One sentence saying what happened and what the creator can do. */
  message: string;
  /** Framer's own first error in the file, when it reports one. */
  detail?: string;
}

export type DeployOutcome = DeploySuccess | DeployFailure;

export interface DeployOptions {
  /**
   * Reparent the new instance under this node once it exists.
   *
   * The panel passes nothing today. `setParent` is declared in `framer.json`
   * because task 1.6 is the task that declares it and the manifest is static,
   * and it is implemented and tested here so the permission is not a claim
   * about code that does not exist. Inventing placement behaviour that cannot
   * be verified in Framer would be guessing, so the first real caller arrives
   * with a task that can be checked.
   */
  parentId?: string;
  index?: number;
  /**
   * How long to wait between re-reads while Framer compiles a new file, in
   * milliseconds. Defaults to `EXPORT_RETRY_DELAYS_MS`; the tests pass zeros.
   */
  exportRetryDelaysMs?: ReadonlyArray<number>;
  /** Waits before each save retry. Defaults to `WRITE_RETRY_DELAYS_MS`. */
  writeRetryDelaysMs?: ReadonlyArray<number>;
  /** Optional attributes and control values for the inserted component instance. */
  attributes?: Record<string, unknown>;
}

/**
 * Re-read schedule while a new code file compiles, about 15 seconds in all.
 *
 * Framer compiles in the background, and `createCodeFile` resolves before it
 * finishes, so a large first deploy (Member Pricing, Member Auth) regularly
 * has no exports on the first two reads. Short waits first, so a quick
 * compile still inserts at once.
 */
export const EXPORT_RETRY_DELAYS_MS: ReadonlyArray<number> = [
  150, 250, 400, 600, 800, 1000, 1250, 1500, 2000, 2000, 2500, 2500,
];

/**
 * Re-read schedule for the Builder's inserts, Add to canvas and Create pages,
 * about 60 seconds in all.
 *
 * In a new project Framer's first compile of a file (fetching its packages
 * included) runs well past the 15 second default (2026-10-27). Create pages
 * writes every file first, so they compile side by side and once the first is
 * ready the rest usually are.
 */
export const SCAFFOLD_EXPORT_RETRY_DELAYS_MS: ReadonlyArray<number> = [
  ...EXPORT_RETRY_DELAYS_MS,
  ...Array.from({ length: 15 }, () => 3000),
];

/**
 * The longest one SDK call may take before the deploy stops waiting for it.
 * A call Framer never answers would otherwise hold the Builder's spinner
 * forever; a timed-out call fails like a refused one, with the same message.
 */
export const FRAMER_CALL_TIMEOUT_MS = 20000;

/** Waits before saving a code file again after Framer refused it. */
export const WRITE_RETRY_DELAYS_MS: ReadonlyArray<number> = [1000, 2500];

function call<T>(promise: Promise<T>, label: string): Promise<T> {
  return withTimeout(promise, FRAMER_CALL_TIMEOUT_MS, label);
}

function wait(ms: number): Promise<void> {
  return ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve();
}

/**
 * Modes in which writing to the project makes no sense.
 *
 * `framer.json` declares `modes: ["canvas"]`, so in practice the plugin only
 * opens there. The guard is still explicit: `.agents/rules/` forbids
 * `getCodeFiles()` during `configureManagedCollection` and
 * `syncManagedCollection`, and requiring canvas mode satisfies that by
 * construction rather than by listing the two forbidden modes and hoping a
 * future SDK adds no third.
 */
function isWritableMode(mode: Mode): boolean {
  return mode === "canvas";
}

/**
 * Find the component export that `addComponentInstance` can insert.
 *
 * Framer compiles a code file before it can report what the file exports, so
 * `exports` can be empty on the object returned straight from
 * `createCodeFile`. The file list is the only other source of the same data,
 * so it is re-read on a schedule until the export shows up. If it never does,
 * the deploy stops with a reason the creator can act on, rather than inserting
 * nothing and reporting success.
 */
async function resolveInsertUrl(
  deps: CanvasDeps,
  file: CanvasCodeFile,
  delays: ReadonlyArray<number>
): Promise<{ url: string | null; last: CanvasCodeFile }> {
  const state: { url: string | null; last: CanvasCodeFile; wake: (() => void) | null } = {
    url: pickComponentExport(file),
    last: file,
    wake: null,
  };
  if (state.url) return { url: state.url, last: state.last };

  const isThisFile = (candidate: CanvasCodeFile) => candidate.id === file.id || candidate.name === file.name;

  // Framer pushes the file list when a compile finishes: listen as well as
  // re-read, so a list the re-read gets from a stale cache cannot hide it.
  let unsubscribe: (() => void) | null = null;
  try {
    unsubscribe =
      deps.subscribeToCodeFiles?.((files) => {
        const match = files.find(isThisFile);
        if (!match) return;
        state.last = match;
        const url = pickComponentExport(match);
        if (url) {
          state.url = url;
          state.wake?.();
        }
      }) ?? null;
  } catch {
    unsubscribe = null;
  }

  try {
    for (const delay of [0, ...delays]) {
      if (state.url) break;
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, delay);
        state.wake = () => {
          clearTimeout(timer);
          resolve();
        };
      });
      state.wake = null;
      if (state.url) break;
      try {
        const refreshed = (await call(deps.getCodeFiles(), "Reading code files")).find(isThisFile);
        if (refreshed) {
          state.last = refreshed;
          const url = pickComponentExport(refreshed);
          if (url) state.url = url;
        }
      } catch {
        // A failed read is one missed attempt, not the end of the wait.
      }
    }
  } finally {
    unsubscribe?.();
  }

  return { url: state.url, last: state.last };
}

/**
 * What Framer says about a file that never offered a component, for the
 * message (2026-10-27). "Still compiling" was all a creator saw, whatever the
 * cause: no exports at all, exports but no component, a component with no
 * insert address, or a problem the type check reports. Best effort, never
 * throws, and null only when Framer gave nothing to go on.
 */
async function describeMissingExport(file: CanvasCodeFile, written: CanvasCodeFile): Promise<string | null> {
  const parts: string[] = [];
  const exports = Array.isArray(file.exports) ? file.exports : [];
  // The latest copy for the export list; the type check from whichever copy has one.
  const checked = typeof file.typecheck === "function" ? file : written;
  const components = exports.filter((entry) => entry.type === "component");
  if (exports.length > 0 && components.length === 0) {
    const listed = exports.slice(0, 4).map((entry) => `${entry.name} (${entry.type})`).join(", ");
    parts.push(`Framer lists its exports as ${listed}, with no component among them.`);
  } else if (components.length > 0) {
    parts.push("Framer found the component but gave it no insert address yet.");
  }

  if (typeof checked.typecheck === "function") {
    try {
      const diagnostics = await withTimeout(checked.typecheck(), 10000, "Checking the component");
      // An error first, else the first warning: either can be why it never built.
      const found = diagnostics.find((entry) => entry.category === 1) ?? diagnostics.find((entry) => entry.category === 0);
      if (found) {
        const line = found.span ? ` (line ${found.span.start.line + 1})` : "";
        parts.push(`The first problem it reports: ${found.message.slice(0, 160)}${line}`);
      }
    } catch {
      // No type check answer: the export state alone still says something.
    }
  }

  return parts.length > 0 ? parts.join(" ") : null;
}

function pickComponentExport(file: CanvasCodeFile): string | null {
  const componentExports = file.exports.filter(
    (entry) => entry.type === "component" && typeof entry.insertURL === "string"
  );

  // The default export is the component. A file may also export helpers.
  const preferred =
    componentExports.find((entry) => entry.isDefaultExport) ?? componentExports[0];

  return preferred?.insertURL ?? null;
}

type WriteResult =
  | { ok: true; file: CanvasCodeFile; action: DeploySuccess["action"] }
  | DeployFailure;

/**
 * Create the code file, or overwrite the one with the same name.
 *
 * An unchanged file is left alone only when Framer already offers its
 * component. Skipping every unchanged file (as of earlier on 2026-10-27) meant
 * a file whose first compile failed or stalled was never compiled again: each
 * retry found the same content, wrote nothing, and waited for an export that
 * could not come. Writing identical content may not make Framer compile, so
 * the code is written with its trailing line break toggled: a real change
 * that changes nothing the component does.
 */
async function writeFile(
  deps: CanvasDeps,
  generated: Pick<GeneratedCanvasFile, "fileName" | "code">,
  retryDelaysMs: ReadonlyArray<number> = WRITE_RETRY_DELAYS_MS
): Promise<WriteResult> {
  // Queued, so no other MemberFrame save races this one, and retried, since
  // Framer's save service fails now and then and the next try usually lands
  // (2026-10-28). A retry re-reads the files, so it overwrites rather than
  // creating a second file.
  let result = await queueCodeFileWrite(() => writeFileOnce(deps, generated));
  for (const delay of retryDelaysMs) {
    if (result.ok) break;
    await wait(delay);
    result = await queueCodeFileWrite(() => writeFileOnce(deps, generated));
  }
  return result;
}

async function writeFileOnce(
  deps: CanvasDeps,
  generated: Pick<GeneratedCanvasFile, "fileName" | "code">
): Promise<WriteResult> {
  try {
    const existing = await call(deps.getCodeFiles(), "Reading code files");
    const match = existing.find((candidate) => candidate.name === generated.fileName);

    if (match) {
      const current = "content" in match ? (match as { content?: unknown }).content : undefined;
      const unchanged = current === generated.code || current === `${generated.code}\n`;
      if (unchanged && pickComponentExport(match)) return { ok: true, file: match, action: "updated" };
      const code = unchanged ? (current === generated.code ? `${generated.code}\n` : generated.code) : generated.code;
      return { ok: true, file: await call(match.setFileContent(code), "Saving the component"), action: "updated" };
    }
    return {
      ok: true,
      file: await call(deps.createCodeFile(generated.fileName, generated.code), "Saving the component"),
      action: "created",
    };
  } catch {
    return {
      ok: false,
      reason: "write_failed",
      title: "Could not save the component",
      message: "Framer refused the write. Check that the project is not read only, then try again.",
    };
  }
}

export type WriteCodeFileOutcome = { ok: true; action: DeploySuccess["action"] } | DeployFailure;

/**
 * Write a code file without inserting anything on the canvas.
 *
 * For code used through Framer's Code overrides rather than as a component:
 * the section locks file. Same mode and permission checks as a deploy, minus
 * the insert permission it does not need. Unchanged content is not rewritten,
 * so saving locks without changing them does not touch the project.
 */
export async function writeCodeFile(deps: CanvasDeps, fileName: string, code: string): Promise<WriteCodeFileOutcome> {
  if (!isWritableMode(deps.mode)) {
    return {
      ok: false,
      reason: "unsupported_mode",
      title: "Open the canvas first",
      message: "Code files can only be written while a Framer canvas is open.",
    };
  }

  if (!deps.isAllowedTo("createCodeFile", "CodeFile.setFileContent")) {
    return {
      ok: false,
      reason: "permission_denied",
      title: "Permission needed",
      message: "This Framer project has not granted MemberFrame permission to write code files.",
    };
  }

  try {
    const existing = (await deps.getCodeFiles()).find((file) => file.name === fileName);
    if (existing && "content" in existing && (existing as { content?: unknown }).content === code) {
      return { ok: true, action: "updated" };
    }
  } catch {
    // Fall through to the write, which reports its own failure.
  }

  const written = await writeFile(deps, { fileName, code });
  return written.ok ? { ok: true, action: written.action } : written;
}

/**
 * Write the generated component into the project and insert one instance.
 *
 * Idempotent on the file name. A second deploy overwrites that same file
 * rather than creating a second file, so a creator who adjusts the customizer
 * and clicks again ends with one component and two instances, not two
 * components. Instances already on the canvas keep their own props, because
 * Framer stores those on the node.
 */
export async function deployCanvasComponent(
  deps: CanvasDeps,
  generated: GeneratedCanvasFile,
  options: DeployOptions = {}
): Promise<DeployOutcome> {
  if (!isWritableMode(deps.mode)) {
    return {
      ok: false,
      reason: "unsupported_mode",
      title: "Open the canvas first",
      message: "Components can only be added while a Framer canvas is open.",
    };
  }

  if (!deps.isAllowedTo(...WRITE_METHODS)) {
    return {
      ok: false,
      reason: "permission_denied",
      title: "Permission needed",
      message:
        "This Framer project has not granted MemberFrame permission to add code components.",
    };
  }

  if (options.parentId && !deps.isAllowedTo(REPARENT_METHOD)) {
    return {
      ok: false,
      reason: "permission_denied",
      title: "Permission needed",
      message: "MemberFrame needs permission to move the inserted component into place.",
    };
  }

  const writeRetries = options.writeRetryDelaysMs ?? WRITE_RETRY_DELAYS_MS;
  const written = await writeFile(deps, generated, writeRetries);
  if (!written.ok) return written;
  const { action } = written;
  let { file } = written;

  let insertUrl: string | null = null;
  let lastSeen: CanvasCodeFile = file;

  // Two rounds: a save Framer accepted but never compiled (its save service
  // failed behind it) offers no component however long we wait, and saving
  // again is what a second click did by hand (2026-10-28). The second save
  // toggles the trailing line break, so Framer compiles afresh.
  for (const round of [0, 1]) {
    if (round === 1) {
      const again = await writeFile(deps, generated, writeRetries);
      if (!again.ok) break;
      file = again.file;
      lastSeen = file;
    }
    try {
      const resolved = await resolveInsertUrl(deps, file, options.exportRetryDelaysMs ?? EXPORT_RETRY_DELAYS_MS);
      insertUrl = resolved.url;
      lastSeen = resolved.last;
    } catch {
      insertUrl = null;
    }
    if (insertUrl) break;
  }

  if (!insertUrl) {
    // The file is written and correct, so this is recoverable by hand. Say so,
    // rather than reporting a failure that sounds like nothing happened.
    const detail = await describeMissingExport(lastSeen, file);
    return {
      ok: false,
      reason: "no_component_export",
      title: "Component saved, not inserted",
      message: detail
        ? `${generated.fileName} is in the project but Framer has not offered its component. ${detail}`
        : `${generated.fileName} is in the project, but Framer reports no exports for it yet. Click Add to canvas again: it is saved again so Framer compiles it afresh.`,
      ...(detail ? { detail } : {}),
    };
  }

  let node: CanvasNode;

  try {
    const addOptions: Parameters<typeof deps.addComponentInstance>[0] = {
      url: insertUrl,
      ...(options.parentId ? { parentId: options.parentId } : {}),
      ...(options.attributes ? { attributes: options.attributes as any } : {}),
    };
    node = await call(deps.addComponentInstance(addOptions), "Inserting the component");
    if (options.attributes && typeof (node as any)?.setAttributes === "function") {
      try {
        await call((node as any).setAttributes(options.attributes) as Promise<unknown>, "Sizing the component");
      } catch {
        // Ignored if Framer does not support setAttributes on this instance
      }
    }
  } catch {
    return {
      ok: false,
      reason: "insert_failed",
      title: "Component saved, not inserted",
      message:
        `${generated.fileName} is in the project but the instance could not be placed. Add it from the components panel.`,
    };
  }

  let reparented = false;

  if (options.parentId) {
    try {
      await call(deps.setParent(node.id, options.parentId, options.index), "Placing the component");
      reparented = true;
    } catch {
      // The instance exists and the creator can drag it. Losing the requested
      // placement is not worth discarding a successful insert.
      reparented = false;
    }
  }

  return {
    ok: true,
    action,
    fileName: generated.fileName,
    fileId: file.id,
    nodeId: node.id,
    reparented,
  };
}

/**
 * Compile-time proof that the real SDK satisfies `CanvasDeps`.
 *
 * If Framer renames a call, changes an argument, or stops returning a node with
 * an `id`, this assignment stops compiling. That is the point: the alternative
 * is discovering it when a creator clicks "Add to canvas".
 */
type RealFramerSatisfiesDeps = typeof framer extends CanvasDeps ? true : false;
const _realFramerSatisfiesDeps: RealFramerSatisfiesDeps = true;
void _realFramerSatisfiesDeps;
