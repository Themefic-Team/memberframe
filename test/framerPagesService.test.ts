import { describe, expect, it } from "vitest";
import {
  DEFAULT_FALLBACK_PAGES,
  formatWebPagePath,
  getFramerProjectPages,
  isCmsItemPath,
  pageOptionLabel,
  sortPagesByPath,
} from "../src/services/framerPagesService";
import { createFramerMock } from "../src/utils/framerMock";

describe("framerPagesService", () => {
  describe("formatWebPagePath", () => {
    it("normalizes root and home paths to '/'", () => {
      expect(formatWebPagePath(undefined, "Home")).toBe("/");
      expect(formatWebPagePath("", "Home")).toBe("/");
      expect(formatWebPagePath("/", "Home")).toBe("/");
      expect(formatWebPagePath("/")).toBe("/");
    });

    it("derives clean slugs when path is missing but page name is provided", () => {
      expect(formatWebPagePath(undefined, "Case Studies")).toBe("/case-studies");
      expect(formatWebPagePath("", "VIP Members Only")).toBe("/vip-members-only");
    });

    it("ensures leading slashes and removes trailing slashes", () => {
      expect(formatWebPagePath("about")).toBe("/about");
      expect(formatWebPagePath("/resume/")).toBe("/resume");
      expect(formatWebPagePath("experiments/v2/")).toBe("/experiments/v2");
    });
  });

  describe("getFramerProjectPages", () => {
    it("extracts and normalizes pages from Framer WebPageNode query", async () => {
      const mock = createFramerMock();
      const pages = await getFramerProjectPages(mock);

      expect(pages.length).toBeGreaterThan(0);
      expect(pages.some((p) => p.path === "/" && p.name === "Home")).toBe(true);
      expect(pages.some((p) => p.path === "/case-studies")).toBe(true);
      expect(pages.some((p) => p.path === "/experiments")).toBe(true);
      expect(pages.some((p) => p.path === "/about")).toBe(true);
      expect(pages.some((p) => p.path === "/resume")).toBe(true);
      expect(pages.some((p) => p.path === "/login")).toBe(true);
      expect(mock.calls.getNodesWithType).toContainEqual({ type: "WebPageNode" });
    });

    it("deduplicates identical paths and falls back if empty", async () => {
      const mockWithDuplicates = {
        getNodesWithType: async () => [
          { id: "1", name: "Home", path: "/" },
          { id: "2", name: "Home Duplicate", path: "/" },
          { id: "3", name: "About Us", path: "/about" },
        ],
      };

      const pages = await getFramerProjectPages(mockWithDuplicates);
      expect(pages).toHaveLength(2);
      expect(pages[0].path).toBe("/");
      expect(pages[1].path).toBe("/about");
    });

    it("returns default fallback pages when getNodesWithType rejects", async () => {
      const brokenMock = {
        getNodesWithType: async () => {
          throw new Error("Parent window not found");
        },
      };

      const pages = await getFramerProjectPages(brokenMock);
      expect(pages).toEqual(DEFAULT_FALLBACK_PAGES);
    });
  });
});

describe("page labels in the lock pickers", () => {
  const page = (path: string, name = path) => ({ id: path, name, path });

  it("does not repeat a path Framer used as the page name", () => {
    expect(pageOptionLabel(page("/blog"))).toBe("Blog (/blog)");
    expect(pageOptionLabel(page("/reset-password"))).toBe("Reset password (/reset-password)");
    expect(pageOptionLabel(page("/"))).toBe("Home (/)");
  });

  it("keeps a real page name", () => {
    expect(pageOptionLabel(page("/case-studies", "Case Studies"))).toBe("Case Studies (/case-studies)");
  });

  it("says a CMS item page covers every item", () => {
    expect(isCmsItemPath("/blog/:slug")).toBe(true);
    expect(isCmsItemPath("/blog")).toBe(false);
    expect(pageOptionLabel(page("/blog/:slug"))).toBe("Blog, every item (/blog/:slug)");
    expect(pageOptionLabel(page("/legal-pages/:slug"))).toBe("Legal pages, every item (/legal-pages/:slug)");
  });

  it("puts Home first and each item page under its list page", () => {
    const sorted = sortPagesByPath([page("/podcast/:slug"), page("/blog"), page("/"), page("/blog/:slug"), page("/about")]);
    expect(sorted.map((p) => p.path)).toEqual(["/", "/about", "/blog", "/blog/:slug", "/podcast/:slug"]);
  });
});
