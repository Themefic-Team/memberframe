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

export interface CanvasCodeFile {
  readonly id: string;
  readonly name: string;
  readonly exports: ReadonlyArray<CanvasCodeFileExport>;
  setFileContent(code: string): Promise<CanvasCodeFile>;
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
): Promise<string | null> {
  const fromFile = pickComponentExport(file);
  if (fromFile) return fromFile;

  for (const delay of [0, ...delays]) {
    await wait(delay);
    try {
      const files = await deps.getCodeFiles();
      const refreshed = files.find((candidate) => candidate.id === file.id || candidate.name === file.name);
      const url = refreshed ? pickComponentExport(refreshed) : null;
      if (url) return url;
    } catch {
      // A failed read is one missed attempt, not the end of the wait.
    }
  }

  return null;
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

/** Create the code file, or overwrite the one with the same name. */
async function writeFile(
  deps: CanvasDeps,
  generated: Pick<GeneratedCanvasFile, "fileName" | "code">
): Promise<WriteResult> {
  try {
    const existing = await deps.getCodeFiles();
    const match = existing.find((candidate) => candidate.name === generated.fileName);

    if (match) {
      return { ok: true, file: await match.setFileContent(generated.code), action: "updated" };
    }
    return { ok: true, file: await deps.createCodeFile(generated.fileName, generated.code), action: "created" };
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

  const written = await writeFile(deps, generated);
  if (!written.ok) return written;
  const { file, action } = written;

  let insertUrl: string | null;

  try {
    insertUrl = await resolveInsertUrl(deps, file, options.exportRetryDelaysMs ?? EXPORT_RETRY_DELAYS_MS);
  } catch {
    insertUrl = null;
  }

  if (!insertUrl) {
    // The file is written and correct, so this is recoverable by hand. Say so,
    // rather than reporting a failure that sounds like nothing happened.
    return {
      ok: false,
      reason: "no_component_export",
      title: "Component saved, not inserted",
      message:
        `${generated.fileName} is in the project, but Framer is still compiling it. Click Add to canvas again in a moment, or drag it in from the components panel.`,
    };
  }

  let node: CanvasNode;

  try {
    const addOptions: Parameters<typeof deps.addComponentInstance>[0] = {
      url: insertUrl,
      ...(options.parentId ? { parentId: options.parentId } : {}),
      ...(options.attributes ? { attributes: options.attributes as any } : {}),
    };
    node = await deps.addComponentInstance(addOptions);
    if (options.attributes && typeof (node as any)?.setAttributes === "function") {
      try {
        await (node as any).setAttributes(options.attributes);
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
      await deps.setParent(node.id, options.parentId, options.index);
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
