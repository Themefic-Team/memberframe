/**
 * The published addresses a site must allow. A site first published after the
 * project was connected answered `foreign` on its own `*.framer.app` address,
 * and every component there drew the "copied, not inserted" lock.
 */

import { describe, expect, it } from "vitest";
import { missingPublishedOrigins, originsFromPublishInfo } from "../src/services/framerProjectService";

describe("published origins", () => {
  const info = {
    production: { url: "https://relaxed-centre-992797.framer.app/login" },
    staging: { url: "https://staging.relaxed-centre-992797.framer.app/" },
  };

  it("reads the origin of production and staging", () => {
    expect(originsFromPublishInfo(info)).toEqual([
      "https://relaxed-centre-992797.framer.app",
      "https://staging.relaxed-centre-992797.framer.app",
    ]);
  });

  it("names only the addresses the site does not allow yet", () => {
    expect(missingPublishedOrigins(info, [])).toHaveLength(2);
    expect(missingPublishedOrigins(info, ["https://relaxed-centre-992797.framer.app"])).toEqual([
      "https://staging.relaxed-centre-992797.framer.app",
    ]);
    expect(missingPublishedOrigins({ production: null, staging: null }, [])).toEqual([]);
  });
});
