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
export type ScaffoldComponent =
  | "member_auth"
  | "member_login"
  | "member_register"
  | "member_password_reset"
  | "member_dashboard"
  | "member_pricing"
  | "none";

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

export interface MembershipPagesOptions {
  includePricing?: boolean;
  includeRegistration?: boolean;
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
 *      `loginPath`, which is the recommended one-page setup, unless a dedicated
 *      registration page is requested or configured.
 *   3. `afterLoginPath` becomes the dashboard only when it is not the root.
 *      Sending members to `/` after sign-in is a legitimate choice, and it
 *      means the creator wants their existing home page, not a new one.
 */
export function membershipPages(
  settings?: AuthSettings | null,
  options?: MembershipPagesOptions
): MembershipPageSpec[] {
  const specs: MembershipPageSpec[] = [];
  const seen = new Set<string>();

  const auth: AuthSettings = settings ?? {
    loginPath: "/login",
    signupPath: "/login",
    resetPath: "/reset-password",
    afterLoginPath: "/dashboard",
    afterLogoutPath: "/",
    allowRegistration: true,
    defaultMethod: "password",
    requirePasswordStrength: true,
    rememberMeDays: 30,
  };

  const add = (spec: MembershipPageSpec): void => {
    const path = normalizePagePath(spec.path);
    if (path === "" || path === "/") return;
    if (seen.has(path)) return;

    seen.add(path);
    specs.push({ ...spec, path });
  };

  const signupPath =
    auth.signupPath && auth.signupPath !== auth.loginPath && auth.signupPath !== "/"
      ? auth.signupPath
      : options?.includeRegistration
        ? "/signup"
        : auth.signupPath;

  // Each page gets the screen it is named for. The one exception is the
  // one-page setup, where sign up shares the login path: that page keeps the
  // combined component, or a visitor would have nowhere to register.
  const hasSignupPage = normalizePagePath(signupPath) !== normalizePagePath(auth.loginPath);

  add({
    id: "login",
    path: auth.loginPath,
    title: "Sign in / Login",
    purpose: "Where a locked gate sends a signed-out visitor.",
    component: hasSignupPage ? "member_login" : "member_auth",
    gated: false,
  });

  add({
    id: "signup",
    path: signupPath,
    title: "Sign up / Registration",
    purpose: "Dedicated registration page for new members to create accounts.",
    component: "member_register",
    gated: false,
  });

  add({
    id: "reset",
    path: auth.resetPath,
    title: "Reset password / OTP",
    purpose: "The page the emailed reset link or OTP opens.",
    // Asks for the email with no token in the URL, and sets the new password
    // when the emailed link brings one.
    component: "member_password_reset",
    gated: false,
  });

  add({
    id: "dashboard",
    path: auth.afterLoginPath && auth.afterLoginPath !== "/" ? auth.afterLoginPath : "/dashboard",
    title: "Member dashboard",
    purpose: "Where a member lands after signing in.",
    component: "member_dashboard",
    gated: true,
  });

  if (options?.includePricing) {
    add({
      id: "pricing",
      path: "/pricing",
      title: "Member pricing",
      purpose: "Membership plans, tier benefits, and checkout table.",
      component: "member_pricing",
      gated: false,
    });
  }

  return specs;
}

/** Which Settings path each predefined page answers to. */
const AUTH_PATH_FOR_PAGE: Readonly<Record<string, "loginPath" | "signupPath" | "resetPath" | "afterLoginPath">> = {
  login: "loginPath",
  signup: "signupPath",
  reset: "resetPath",
  dashboard: "afterLoginPath",
};

/**
 * The Settings paths to save once Create pages has run (product owner,
 * 2026-10-27): each page that now exists becomes the path its setting points
 * at, so a creator never has to copy `/signup` or `/dashboard` into Settings
 * by hand. Only real changes come back, and a page that failed to create
 * changes nothing. After sign out is never touched: no page is made for it.
 */
export function authPathsForPages(
  results: ReadonlyArray<PageResult>,
  auth: Pick<AuthSettings, "loginPath" | "signupPath" | "resetPath" | "afterLoginPath"> | null | undefined
): Partial<AuthSettings> {
  const patch: Partial<AuthSettings> = {};
  for (const result of results) {
    if (result.status === "failed") continue;
    const key = AUTH_PATH_FOR_PAGE[result.id];
    if (!key) continue;
    const path = normalizePagePath(result.path);
    if (path === "" || path === "/") continue;
    if (normalizePagePath(auth?.[key] ?? "") !== path) patch[key] = path;
  }
  return patch;
}

export type PageResult =
  | { path: string; id: string; status: "created"; nodeId: string; component?: ScaffoldComponent }
  | { path: string; id: string; status: "skipped"; reason: "already_exists"; nodeId: string; component?: ScaffoldComponent }
  | { path: string; id: string; status: "failed"; reason: string; component?: ScaffoldComponent };

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
        component: spec.component,
      });
      continue;
    }

    try {
      const page = await deps.createWebPage(spec.path);
      byPath.set(spec.path, page.id);
      results.push({
        path: spec.path,
        id: spec.id,
        status: "created",
        nodeId: page.id,
        component: spec.component,
      });
    } catch (error) {
      results.push({
        path: spec.path,
        id: spec.id,
        status: "failed",
        reason: error instanceof Error ? error.message : "Framer refused the page.",
        component: spec.component,
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
 * The Spacing a scaffolded component starts with.
 *
 * Many templates lay their header over the page (`position: absolute`, top 0),
 * so content placed at the top of a new page sits underneath it. A top margin
 * clears a typical header and the bottom one keeps the component off the
 * footer. It is the component's own Spacing control, so a creator whose header
 * is not overlaid sets it back to 0 in the properties panel.
 */
export const SCAFFOLD_COMPONENT_SPACING = { margin: "120px 0px 80px 0px" } as const;

/** A child of a web page, narrowed to what finding its breakpoint needs. */
export interface PageChildNode {
  readonly id: string;
  readonly isBreakpoint?: boolean;
  readonly isPrimaryBreakpoint?: boolean;
  readonly layout?: string | null;
}

export interface BreakpointDeps {
  getChildren(nodeId: string): Promise<ReadonlyArray<PageChildNode>>;
}

/** Where a scaffolded component goes, and how its parent lays it out. */
export interface PageContentParent {
  readonly id: string;
  /** `"stack"` or `"grid"` flows the child; anything else needs absolute placement. */
  readonly layout: string | null;
}

/**
 * Re-read schedule while Framer builds a new page's breakpoints, about 3
 * seconds in all. `createWebPage` can resolve before the Desktop frame exists.
 */
export const BREAKPOINT_RETRY_DELAYS_MS: ReadonlyArray<number> = [0, 150, 300, 500, 800, 1200];

/**
 * Find the frame a page's content belongs in: its primary breakpoint.
 *
 * A web page's direct children are its breakpoint frames (Desktop, Tablet,
 * Phone). Anything parented to the `WebPageNode` itself sits beside them as a
 * loose canvas layer: it floats at the page's top left in the editor and is
 * never rendered on the published site. So a component scaffolded onto a page
 * must go into the Desktop frame, and the other breakpoints inherit it.
 *
 * Returns null when no breakpoint shows up, so the caller can report that
 * rather than parenting to the page and producing an invisible component.
 */
export async function findPageContentParent(
  deps: BreakpointDeps,
  pageId: string,
  delays: ReadonlyArray<number> = BREAKPOINT_RETRY_DELAYS_MS
): Promise<PageContentParent | null> {
  for (const delay of delays) {
    if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));

    let children: ReadonlyArray<PageChildNode>;
    try {
      children = await deps.getChildren(pageId);
    } catch {
      continue;
    }

    const breakpoints = children.filter((child) => child.isBreakpoint === true);
    const primary = breakpoints.find((child) => child.isPrimaryBreakpoint === true) ?? breakpoints[0];
    if (primary) return { id: primary.id, layout: primary.layout ?? null };
  }

  return null;
}

/* ==========================================================================
   PAGE CHROME: the site's own header and footer on a scaffolded page
   ========================================================================== */

/**
 * A breakpoint child, narrowed to what finding a header and footer needs.
 * `kind` is "component" for a component instance, which is how nearly every
 * template builds its navigation and footer.
 */
export interface ChromeNode {
  readonly id: string;
  readonly name: string | null;
  readonly kind: "component" | "frame" | "other";
  readonly position: string | null;
}

/** A page's breakpoint frame with the layout a scaffolded page should copy. */
export interface ChromeBreakpoint {
  readonly id: string;
  readonly isBreakpoint: boolean;
  readonly isPrimaryBreakpoint: boolean;
  readonly layout: string | null;
  /** Stack and size attributes, already picked: written to the new page as they are. */
  readonly layoutAttributes: Record<string, unknown>;
}

export interface PageChromeDeps {
  getNodesWithType(type: "WebPageNode"): Promise<ReadonlyArray<ExistingWebPage>>;
  getBreakpoints(pageId: string): Promise<ReadonlyArray<ChromeBreakpoint>>;
  getChildren(nodeId: string): Promise<ReadonlyArray<ChromeNode>>;
  cloneNode(nodeId: string): Promise<{ readonly id: string } | null>;
  setParent(nodeId: string, parentId: string, index?: number): Promise<void>;
  setAttributes(nodeId: string, attributes: Record<string, unknown>): Promise<unknown>;
  removeNodes(nodeIds: string[]): Promise<void>;
}

/** The header and footer of an existing page, and the layout that holds them. */
export interface PageChrome {
  readonly sourcePageId: string;
  readonly header: ChromeNode | null;
  readonly footer: ChromeNode | null;
  readonly layoutAttributes: Record<string, unknown>;
}

const HEADER_NAME = /\b(nav|navbar|navigation|header|menu|top ?bar)\b/i;
const FOOTER_NAME = /\bfooter\b/i;
/** Names that say a first or last component is page content, not chrome. */
const CONTENT_NAME = /\b(hero|section|content|main|banner|cta|article|post)\b/i;

/**
 * Which children of a page's primary breakpoint are its header and footer.
 *
 * A name that says so wins wherever the child sits. Otherwise the first and
 * last children count when they are component instances whose name does not
 * read as content: a template's navigation and footer are components, its
 * hero and sections usually are not, and when they are, they are named so.
 * A page with a single child has no chrome to speak of.
 */
export function pickPageChrome(children: ReadonlyArray<ChromeNode>): { header: ChromeNode | null; footer: ChromeNode | null } {
  if (children.length < 2) return { header: null, footer: null };

  const looksLikeChrome = (node: ChromeNode | undefined): node is ChromeNode =>
    node !== undefined && node.kind === "component" && !CONTENT_NAME.test(node.name ?? "");

  const first = children[0];
  const last = children[children.length - 1];

  const header =
    children.find((node) => HEADER_NAME.test(node.name ?? "") && !FOOTER_NAME.test(node.name ?? "")) ??
    (looksLikeChrome(first) && !FOOTER_NAME.test(first.name ?? "") ? first : null);

  const named = [...children].reverse().find((node) => FOOTER_NAME.test(node.name ?? ""));
  const footer = named ?? (looksLikeChrome(last) && last.id !== header?.id ? last : null);

  return { header, footer: footer && footer.id !== header?.id ? footer : null };
}

/**
 * Find a page to borrow the header and footer from.
 *
 * Home first, since it is the page a template is designed around, then every
 * other page in project order. Pages created in this run are skipped: they are
 * empty. Only a stacked breakpoint qualifies, because a header and footer in an
 * absolutely positioned page are placed by coordinates that mean nothing on a
 * page of a different height.
 */
export async function findPageChrome(
  deps: Pick<PageChromeDeps, "getNodesWithType" | "getBreakpoints" | "getChildren">,
  excludePageIds: ReadonlySet<string>
): Promise<PageChrome | null> {
  const pages = (await deps.getNodesWithType("WebPageNode")).filter((page) => !excludePageIds.has(page.id));
  const ordered = [
    ...pages.filter((page) => normalizePagePath(page.path ?? "") === "/"),
    ...pages.filter((page) => normalizePagePath(page.path ?? "") !== "/"),
  ];

  for (const page of ordered.slice(0, 8)) {
    try {
      const breakpoints = (await deps.getBreakpoints(page.id)).filter((node) => node.isBreakpoint);
      const primary = breakpoints.find((node) => node.isPrimaryBreakpoint) ?? breakpoints[0];
      if (!primary || primary.layout !== "stack") continue;

      const { header, footer } = pickPageChrome(await deps.getChildren(primary.id));
      if (header || footer) {
        return { sourcePageId: page.id, header, footer, layoutAttributes: primary.layoutAttributes };
      }
    } catch {
      // An unreadable page is no reason to give up on the others.
    }
  }

  return null;
}

export interface AppliedChrome {
  header: boolean;
  footer: boolean;
  /** Whether the page now stacks its children, so the component flows between them. */
  stacked: boolean;
}

/**
 * Give a new page the source page's layout, a copy of its header at the top,
 * and a copy of its footer at the bottom. The caller inserts its component at
 * index 1 (or 0 with no header), between the two.
 *
 * Each copy is independent of the others: a header that will not clone still
 * leaves the footer, and the page is usable either way.
 */
export async function applyPageChrome(
  deps: Pick<PageChromeDeps, "cloneNode" | "setParent" | "setAttributes" | "removeNodes">,
  breakpointId: string,
  chrome: PageChrome
): Promise<AppliedChrome> {
  let stacked = false;
  try {
    await deps.setAttributes(breakpointId, chrome.layoutAttributes);
    stacked = true;
  } catch {
    stacked = false;
  }

  const place = async (node: ChromeNode | null, index?: number): Promise<boolean> => {
    if (!node) return false;
    let copy: { readonly id: string } | null = null;
    try {
      copy = await deps.cloneNode(node.id);
      if (!copy) return false;
      await deps.setParent(copy.id, breakpointId, index);
      return true;
    } catch {
      // A clone lands beside its original. One that could not be moved would
      // leave a second header on the source page, so it is removed.
      if (copy) await deps.removeNodes([copy.id]).catch(() => undefined);
      return false;
    }
  };

  const header = await place(chrome.header, 0);
  const footer = await place(chrome.footer);

  return { header, footer, stacked };
}

/**
 * The layout an empty page gets when the site has no header and footer to
 * borrow (a new or blank project): a vertical stack that centres its children
 * both ways. The component then flows into the middle of the Desktop frame,
 * and Tablet and Phone inherit it, with no coordinates to get wrong. A site
 * with its own chrome gets that page's layout instead (`applyPageChrome`).
 */
export const CENTERED_PAGE_LAYOUT = {
  layout: "stack",
  stackDirection: "vertical",
  stackDistribution: "center",
  stackAlignment: "center",
  stackWrapEnabled: false,
  gap: "0px",
  padding: "0px",
} as const;

/** Give a page's breakpoint `CENTERED_PAGE_LAYOUT`. False when Framer refuses it. */
export async function centerPageLayout(
  deps: Pick<PageChromeDeps, "setAttributes">,
  breakpointId: string
): Promise<boolean> {
  try {
    await deps.setAttributes(breakpointId, { ...CENTERED_PAGE_LAYOUT });
    return true;
  } catch {
    return false;
  }
}

/** The Spacing a component starts with on a centred page: nothing to clear, even space above and below. */
export const SCAFFOLD_COMPONENT_SPACING_CENTERED = { margin: "64px 0px 64px 0px" } as const;

/**
 * The Spacing a component starts with when a real header sits above it in the
 * stack. Less than `SCAFFOLD_COMPONENT_SPACING`, which has to clear a header
 * laid over the page.
 */
export const SCAFFOLD_COMPONENT_SPACING_BELOW_HEADER = { margin: "64px 0px 96px 0px" } as const;

/**
 * A fixed height grown by a margin's top and bottom.
 *
 * The component draws its Spacing margin inside its own box, so a 620px auth
 * card given 64px above and 96px below keeps its 620px only if the frame is
 * 780px. Anything other than a pixel height ("fit-content", "100%") is left
 * as it is: it already sizes to what is inside.
 */
export function heightWithMargin(height: string, margin: string): string {
  const base = /^(\d+(?:\.\d+)?)px$/.exec(height.trim());
  if (!base) return height;
  const parts = margin.trim().split(/\s+/).map((part) => parseFloat(part) || 0);
  const [top = 0, , bottom = top] = parts;
  return `${Math.round(Number(base[1]) + top + bottom)}px`;
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

type RealFramerSatisfiesBreakpointDeps = typeof framer extends BreakpointDeps ? true : false;
const _realFramerSatisfiesBreakpointDeps: RealFramerSatisfiesBreakpointDeps = true;
void _realFramerSatisfiesBreakpointDeps;
