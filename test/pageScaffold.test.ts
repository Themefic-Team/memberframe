/**
 * Membership page scaffolding.
 *
 * The thing worth protecting here is not that pages get created. It is that
 * pages which already exist are never replaced. The button says "create
 * membership pages", a creator will click it on a project that already has a
 * login page they spent an afternoon on, and there is no undo for removing a
 * page. So "skipped" is the behaviour under test, and "created" is the easy
 * half.
 *
 * `jsdom` is not installed (blocker B5), so nothing here renders a component.
 * Everything tested is reachable from node, which is why the service takes a
 * narrow deps object rather than the `framer` singleton.
 */

import { describe, expect, it } from "vitest";
import {
  membershipPages,
  normalizePagePath,
  scaffoldMembershipPages,
  scaffoldSummary,
  type ExistingWebPage,
  type MembershipPageSpec,
  type ScaffoldDeps,
} from "../src/services/pageScaffoldService";
import type { AuthSettings } from "../src/types/connection";

const AUTH: AuthSettings = {
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

interface MockOptions {
  existing?: ExistingWebPage[];
  mode?: "canvas" | "configureManagedCollection";
  allowed?: boolean;
  failOn?: string;
  throwOnRead?: boolean;
}

function mockDeps(options: MockOptions = {}): ScaffoldDeps & { created: string[] } {
  const created: string[] = [];

  return {
    created,
    mode: (options.mode ?? "canvas") as ScaffoldDeps["mode"],
    isAllowedTo: () => options.allowed !== false,
    getNodesWithType: async () => {
      if (options.throwOnRead) throw new Error("project unreadable");
      return options.existing ?? [];
    },
    createWebPage: async (path: string) => {
      if (options.failOn === path) throw new Error("Framer refused the page.");
      created.push(path);
      return { id: `node_${created.length}` };
    },
  };
}

describe("normalizePagePath", () => {
  it("adds a leading slash and drops a trailing one", () => {
    expect(normalizePagePath("login")).toBe("/login");
    expect(normalizePagePath("/login/")).toBe("/login");
    expect(normalizePagePath("  /login  ")).toBe("/login");
  });

  it("leaves the site root alone", () => {
    // The one path that is legitimately a bare slash. Stripping it would turn
    // the root into an empty string and make `/` and `` compare unequal.
    expect(normalizePagePath("/")).toBe("/");
  });

  it("is empty for an empty input", () => {
    expect(normalizePagePath("")).toBe("");
    expect(normalizePagePath("   ")).toBe("");
  });
});

describe("membershipPages", () => {
  it("derives the paths from the settings rather than hardcoding them", () => {
    // Both, because they are two settings. A creator who moves their sign-in
    // page and leaves `signupPath` at its old value really does want two
    // pages, which the next test covers.
    const pages = membershipPages({
      ...AUTH,
      loginPath: "/members/sign-in",
      signupPath: "/members/sign-in",
    });

    expect(pages.map((page) => page.path)).toContain("/members/sign-in");
    expect(pages.map((page) => page.path)).not.toContain("/login");
  });

  it("collapses a duplicate path", () => {
    // `signupPath` defaults to the same value as `loginPath`, which is the
    // recommended one-page setup. Creating that page twice would fail on the
    // second attempt and report a failure for a correct configuration.
    const pages = membershipPages(AUTH);
    const paths = pages.map((page) => page.path);

    expect(new Set(paths).size).toBe(paths.length);
    expect(paths.filter((path) => path === "/login")).toHaveLength(1);
  });

  it("gives a separate sign up page when the creator asked for one", () => {
    const pages = membershipPages({ ...AUTH, signupPath: "/join" });
    expect(pages.map((page) => page.path)).toContain("/join");
  });

  it("never scaffolds the site root", () => {
    // `afterLogoutPath` defaults to `/`, and `afterLoginPath` may be set to it
    // too. A creator's home page already exists and is the last thing that
    // should get a sign-in form dropped on it.
    const pages = membershipPages({ ...AUTH, afterLoginPath: "/" });
    expect(pages.map((page) => page.path)).not.toContain("/");
  });

  it("gates only the dashboard", () => {
    // The sign-in and reset pages must be reachable signed out: the reset page
    // is opened from an email by someone who by definition cannot sign in, and
    // gating it would make password recovery impossible.
    const pages = membershipPages(AUTH);
    const gated = pages.filter((page) => page.gated).map((page) => page.id);

    expect(gated).toEqual(["dashboard"]);
  });

  it("puts the auth component on the auth pages and the dashboard on the dashboard", () => {
    const byId = new Map(membershipPages(AUTH).map((page) => [page.id, page.component]));

    expect(byId.get("login")).toBe("member_auth");
    expect(byId.get("reset")).toBe("member_auth");
    expect(byId.get("dashboard")).toBe("member_dashboard");
  });
});

describe("scaffoldMembershipPages", () => {
  const specs = (): MembershipPageSpec[] => membershipPages(AUTH);

  it("creates every missing page", async () => {
    const deps = mockDeps();
    const outcome = await scaffoldMembershipPages(deps, specs());

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    expect(outcome.created).toBe(3);
    expect(outcome.skipped).toBe(0);
    expect(deps.created).toEqual(["/login", "/reset-password", "/dashboard"]);
  });

  it("never replaces a page that already exists", async () => {
    // The behaviour this whole file exists for. A creator with a hand-built
    // login page clicks the button and keeps it.
    const deps = mockDeps({ existing: [{ id: "page_a", path: "/login" }] });
    const outcome = await scaffoldMembershipPages(deps, specs());

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    expect(deps.created).not.toContain("/login");
    expect(outcome.skipped).toBe(1);
    expect(outcome.created).toBe(2);

    const login = outcome.results.find((result) => result.id === "login");
    expect(login?.status).toBe("skipped");

    // Narrowed rather than reached into. `nodeId` exists on the created and
    // skipped arms and not on the failed one, which is the union doing its
    // job: a caller that wants a node id has to establish it has one.
    if (login?.status !== "skipped") throw new Error("expected the login page to be skipped");

    // The existing node is reported, so a caller can select or inspect it.
    expect(login.nodeId).toBe("page_a");
  });

  it("matches an existing page whose path is spelled differently", async () => {
    // Framer reports `/login`, a creator may have stored `login/`. Comparing
    // the raw forms is how a project ends up with both.
    const deps = mockDeps({ existing: [{ id: "page_a", path: "/login/" }] });
    const outcome = await scaffoldMembershipPages(deps, specs());

    expect(deps.created).not.toContain("/login");
    expect(outcome.ok && outcome.skipped).toBe(1);
  });

  it("ignores an existing page with no path", async () => {
    // A design page, or a CMS detail page before its slug resolves. Neither is
    // a web page at a path and neither should block creating one.
    const deps = mockDeps({ existing: [{ id: "page_a", path: null }] });
    const outcome = await scaffoldMembershipPages(deps, specs());

    expect(outcome.ok && outcome.created).toBe(3);
  });

  it("keeps going when one page fails", async () => {
    // Per page rather than all or nothing: one refusal must not discard two
    // pages that worked.
    const deps = mockDeps({ failOn: "/reset-password" });
    const outcome = await scaffoldMembershipPages(deps, specs());

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    expect(outcome.created).toBe(2);
    expect(outcome.failed).toBe(1);
    expect(deps.created).toEqual(["/login", "/dashboard"]);

    const failure = outcome.results.find((result) => result.status === "failed");
    expect(failure?.path).toBe("/reset-password");
  });

  it("treats an unreadable project as empty rather than throwing", async () => {
    const deps = mockDeps({ throwOnRead: true });
    const outcome = await scaffoldMembershipPages(deps, specs());

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.created).toBe(3);
  });

  it("refuses outside canvas mode", async () => {
    const deps = mockDeps({ mode: "configureManagedCollection" });
    const outcome = await scaffoldMembershipPages(deps, specs());

    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.reason).toBe("unsupported_mode");
    expect(deps.created).toEqual([]);
  });

  it("refuses without the permission, and touches nothing", async () => {
    const deps = mockDeps({ allowed: false });
    const outcome = await scaffoldMembershipPages(deps, specs());

    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.reason).toBe("permission_denied");
    expect(deps.created).toEqual([]);
  });

  it("says so when there is nothing to create", async () => {
    const outcome = await scaffoldMembershipPages(mockDeps(), []);

    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.reason).toBe("nothing_to_do");
  });
});

describe("scaffoldSummary", () => {
  const summary = (created: number, skipped: number, failed: number): string =>
    scaffoldSummary({ ok: true, results: [], created, skipped, failed });

  it("stays inside the kit's 45 character toast limit in every branch", () => {
    for (const text of [summary(3, 0, 0), summary(2, 1, 0), summary(0, 3, 0), summary(1, 0, 2)]) {
      expect(text.length).toBeLessThanOrEqual(45);
    }
  });

  it("leads with the failure when there is one", () => {
    expect(summary(1, 0, 2)).toContain("failed");
  });

  it("says plainly when there was nothing to do", () => {
    expect(summary(0, 3, 0)).toBe("Every page already exists");
  });
});
