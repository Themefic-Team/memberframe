import { describe, expect, it } from "vitest";
import {
  DEFAULT_FALLBACK_PAGES,
  formatWebPagePath,
  getFramerProjectPages,
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
