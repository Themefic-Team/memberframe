/**
 * A published Framer page replaces `document.addEventListener` for click,
 * auxclick, mousedown, keyup, and submit, and runs those listeners after the
 * event has finished, so a `preventDefault` there does nothing. It sent
 * visitors on /about to the home page from a `./#sign-in` trigger
 * (2026-10-27). A canvas component that must act during the event listens on
 * `window` through `EventTarget.prototype` instead (MemberAuth `listenAtOnce`).
 */

import { readdirSync, readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const DIR = path.resolve(__dirname, "../src/canvas-components");
const DEFERRED = /document\.addEventListener\(\s*["'`](click|auxclick|mousedown|keyup|submit)["'`]/;

describe("canvas components and Framer's deferred document listeners", () => {
  const files = readdirSync(DIR).filter((name) => name.endsWith(".tsx"));

  it.each(files)("%s adds no deferred-event listener on document", (file) => {
    expect(readFileSync(path.join(DIR, file), "utf8")).not.toMatch(DEFERRED);
  });
});
