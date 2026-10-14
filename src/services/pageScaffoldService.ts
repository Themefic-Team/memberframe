/**
 * Create the pages a membership needs, and put the right component on each.
 *
 * ## Why this exists
 *
 * A membership is not one component, it is a set of pages that refer to each
 * other. The settings document already names them: `loginPath`, `resetPath`,
 * `afterLoginPath`. Before this, a creator read those five fields and then made
 * the pages by hand, and every mismatch between a stored path and a real page
 * is a dead end a visitor finds rather than the creator:
 *
 *   - `loginPath` points at a page that does not exist, so a locked gate sends
 *     the visitor to a 404.
 *   - The reset page exists but has no `<MemberAuth>` on it, so the emailed
 *     link opens a blank page and the token is wasted.
 *   - The dashboard exists but is not gated, so a signed-out visitor sees an
 *     empty account screen instead of being asked to sign in.
 *
 * Every one of those is silent. Creating the pages from the same settings the
 * components are configured from removes the class of problem rather than
 * documenting it.
 *
 * ## It is additive and it never overwrites
 *
 * A page whose path already exists is reported as `skipped`, not replaced. A
 * creator who has built a beautiful login page must not lose it because they
 * clicked a button labelled "create pages", and there is no undo in this
 * direction: `removeNodes` would be destroying work on the creator's say-so
 * when they said something much weaker.
 *
 * ## Same shape as `framerCanvasService`
 *
 * A narrow deps interface rather than the `framer` singleton, and a tagged
 * outcome rather than a throw, so the whole path is testable against a mock
 * with no DOM. `jsdom` is still not installed, so anything that reaches for the
 * singleton directly is untestable in this repository.
 */

import type { Mode, ProtectedMethod, framer } from "framer-plugin";
import type { AuthSettings } from "../types/connection";

/** A page already in the project. Only the path matters for this. */
export interface ExistingWebPage {
  readonly id: string;
  readonly path: string | null;
}

export interface CreatedWebPage {
  readonly id: string;
}

/** Exactly the SDK surface the scaffold path touches. */
export interface ScaffoldDeps {
  readonly mode: Mode;
  isAllowedTo(...methods: [ProtectedMethod, ...ProtectedMethod[]]): boolean;
  createWebPage(pagePath: string): Promise<CreatedWebPage>;
  getNodesWithType(type: "WebPageNode"): Promise<ReadonlyArray<ExistingWebPage>>;
}

/**
 * The method keys this path needs.
 *
 * `getNodesWithType` is absent because the SDK maps it to an empty permission
 * list: it is unprotected, and declaring it in `framer.json` would ask a
 * creator to approve something Framer does not gate.
 */
export const SCAFFOLD_METHODS: [ProtectedMethod, ...ProtectedMethod[]] = ["createWebPage"];

/** Which authored component belongs on a scaffolded page. */
export type ScaffoldComponent = "member_auth" | "member_dashboard" | "none";

export interface MembershipPageSpec {
  id: string;
  /** Site-relative, from the settings document. */
  path: string;
  /** Shown in the panel's list, never written to the project. */
  title: string;
  /** One line saying what the page is for. */
  purpose: string;
  component: ScaffoldComponent;
  /**
   * Whether a signed-out visitor should be able to see it.
   *
   * The dashboard is the only one that must not be: it is the page a member
   * lands on, and an ungated dashboard shows its empty state to the public
   * rather than asking them to sign in. The sign-in page itself obviously has
   * to be reachable signed out, and so does the reset page, which is opened
   * from an email by someone who by definition cannot sign in.
   */
  gated: boolean;
}

/**
 * Normalise a path for comparison.
 *
 * Framer reports a page path with a leading slash and no trailing one. A
 * stored setting may carry either, and comparing the two raw forms is how a
 * creator ends up with both `/login` and `/login/`.
 */
export function normalizePagePath(value: string): string {
  const trimmed = value.trim();
  if (trimmed === "") return "";

  const withLeading = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  // The site root is the one path that is legitimately a bare slash.
  if (withLeading === "/") return "/";

  return withLeading.replace(/\/+$/, "");
}

/**
 * Which pages a membership needs, derived from the settings document.
 *
 * Derived rather than hardcoded, so a creator who set `loginPath` to
 * `/members/sign-in` gets that page and not `/login`. The settings are the
 * single source of truth for where these live; this function only decides what
 * goes on them.
 *
 * Three rules shape the output:
 *
 *   1. The site root is never scaffolded. A creator's home page already
 *      exists and is the last thing we should be putting a sign-in form on.
 *   2. Duplicate paths collapse. `signupPath` defaults to the same value as
 *      `loginPath`, which is the recommended one-page setup, and creating that
 *      page twice would fail the second time.
 *   3. `afterLoginPath` becomes the dashboard only when it is not the root.
 *      Sending members to `/` after sign-in is a legitimate choice, and it
 *      means the creator wants their existing home page, not a new one.
 */
export function membershipPages(settings: AuthSettings): MembershipPageSpec[] {
  const specs: MembershipPageSpec[] = [];
  const seen = new Set<string>();

  const add = (spec: MembershipPageSpec): void => {
    const path = normalizePagePath(spec.path);
    if (path === "" || path === "/") return;
    if (seen.has(path)) return;

    seen.add(path);
    specs.push({ ...spec, path });
  };

  add({
    id: "login",
    path: settings.loginPath,
    title: "Sign in",
    purpose: "Where a locked gate sends a signed-out visitor.",
    component: "member_auth",
    gated: false,
  });

  add({
    id: "signup",
    path: settings.signupPath,
    title: "Sign up",
    purpose: "A separate sign-up page, when it is not the sign-in page.",
    component: "member_auth",
    gated: false,
  });

  add({
    id: "reset",
    path: settings.resetPath,
    title: "Reset password",
    purpose: "The page the emailed reset link opens.",
    component: "member_auth",
    gated: false,
  });

  add({
    id: "dashboard",
    path: settings.afterLoginPath,
    title: "Member dashboard",
    purpose: "Where a member lands after signing in.",
    component: "member_dashboard",
    gated: true,
  });

  return specs;
}

export type PageResult =
  | { path: string; id: string; status: "created"; nodeId: string }
  | { path: string; id: string; status: "skipped"; reason: "already_exists"; nodeId: string }
  | { path: string; id: string; status: "failed"; reason: string };

export type ScaffoldFailureReason = "unsupported_mode" | "permission_denied" | "nothing_to_do";

export interface ScaffoldSuccess {
  ok: true;
  results: PageResult[];
  created: number;
  skipped: number;
  failed: number;
}

export interface ScaffoldFailure {
  ok: false;
  reason: ScaffoldFailureReason;
  title: string;
  message: string;
}

export type ScaffoldOutcome = ScaffoldSuccess | ScaffoldFailure;

/**
 * Create every missing page.
 *
 * Per page rather than all or nothing. A creator whose project already has
 * `/login` should still get `/dashboard`, and one page failing should not
 * discard three that worked. The result says what happened to each, because
 * "3 of 4 created" is information the creator needs and a single boolean is
 * not.
 */
export async function scaffoldMembershipPages(
  deps: ScaffoldDeps,
  specs: ReadonlyArray<MembershipPageSpec>
): Promise<ScaffoldOutcome> {
  if (deps.mode !== "canvas") {
    return {
      ok: false,
      reason: "unsupported_mode",
      title: "Open the canvas first",
      message: "Pages can only be created while a Framer canvas is open.",
    };
  }

  if (!deps.isAllowedTo(...SCAFFOLD_METHODS)) {
    return {
      ok: false,
      reason: "permission_denied",
      title: "Permission needed",
      message: "This Framer project has not granted MemberFrame permission to create pages.",
    };
  }

  if (specs.length === 0) {
    return {
      ok: false,
      reason: "nothing_to_do",
      title: "Nothing to create",
      message: "Set the membership paths in Settings first, then create the pages.",
    };
  }

  // One read, not one per page. Reading inside the loop would also miss nothing,
  // since a page created in this loop is one we already know about, and would
  // cost a round trip per page for it.
  let existing: ReadonlyArray<ExistingWebPage>;

  try {
    existing = await deps.getNodesWithType("WebPageNode");
  } catch {
    // Treat an unreadable project as having no pages. `createWebPage` will
    // refuse a duplicate anyway, and that refusal is reported per page, so the
    // worst case is a clear error rather than a silent overwrite.
    existing = [];
  }

  const byPath = new Map<string, string>();
  for (const page of existing) {
    if (page.path) byPath.set(normalizePagePath(page.path), page.id);
  }

  const results: PageResult[] = [];

  for (const spec of specs) {
    const already = byPath.get(spec.path);

    if (already !== undefined) {
      // Never replaced. See the file header: a creator who has built a login
      // page must not lose it to a button labelled "create pages".
      results.push({
        path: spec.path,
        id: spec.id,
        status: "skipped",
        reason: "already_exists",
        nodeId: already,
      });
      continue;
    }

    try {
      const page = await deps.createWebPage(spec.path);
      byPath.set(spec.path, page.id);
      results.push({ path: spec.path, id: spec.id, status: "created", nodeId: page.id });
    } catch (error) {
      results.push({
        path: spec.path,
        id: spec.id,
        status: "failed",
        reason: error instanceof Error ? error.message : "Framer refused the page.",
      });
    }
  }

  return {
    ok: true,
    results,
    created: results.filter((result) => result.status === "created").length,
    skipped: results.filter((result) => result.status === "skipped").length,
    failed: results.filter((result) => result.status === "failed").length,
  };
}

/**
 * One line summarising the run, for a toast.
 *
 * Under the kit's 45 character toast limit in every branch, which is why the
 * wording is this terse rather than a sentence.
 */
export function scaffoldSummary(outcome: ScaffoldSuccess): string {
  if (outcome.failed > 0) return `${outcome.created} created, ${outcome.failed} failed`;
  if (outcome.created === 0) return "Every page already exists";
  if (outcome.skipped === 0) return `${outcome.created} pages created`;
  return `${outcome.created} created, ${outcome.skipped} kept`;
}

/**
 * Compile-time proof that the real SDK satisfies `ScaffoldDeps`.
 *
 * The same guard `framerCanvasService` carries, and for the same reason: the
 * alternative to a broken build is discovering an SDK signature change when a
 * creator clicks the button.
 */
type RealFramerSatisfiesScaffoldDeps = typeof framer extends ScaffoldDeps ? true : false;
const _realFramerSatisfiesScaffoldDeps: RealFramerSatisfiesScaffoldDeps = true;
void _realFramerSatisfiesScaffoldDeps;
