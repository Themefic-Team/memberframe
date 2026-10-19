/**
 * 27-instance-seal.md: one Builder insert is one working component. A pasted
 * copy loses its seal; a breakpoint replica is not a copy; a component from
 * another project's site is locked; work from before seals keeps working.
 */

import { describe, expect, it } from "vitest";
import {
  applyToRegistry,
  instanceOfFile,
  parseRegistry,
  planSeals,
  resolveUnknown,
  siteKeyOfFile,
  type SealedInstance,
} from "../src/services/instanceSealService";

const own = (nodeId: string, seal: string | undefined): SealedInstance => ({ nodeId, seal, ownSite: true });

describe("planSeals", () => {
  it("leaves the original alone and clears a pasted copy", () => {
    const plan = planSeals([own("n1", "s1.a.x"), own("n2", "s1.a.x")], { "s1.a.x": "n1" }, true);
    expect(plan.actions).toEqual([{ kind: "clear", nodeId: "n2" }]);
    expect(plan.unknown).toEqual([]);
  });

  it("lets one holder adopt a seal whose node is gone (cut and paste, or the original deleted)", () => {
    const plan = planSeals([own("n5", "s1.a.x"), own("n6", "s1.a.x")], { "s1.a.x": "n1" }, true);
    expect(plan.actions).toEqual([
      { kind: "adopt", nodeId: "n5", seal: "s1.a.x" },
      { kind: "clear", nodeId: "n6" },
    ]);
  });

  it("seals everything unsealed on the first run, and clears anything unsealed after it", () => {
    expect(planSeals([own("n1", undefined)], {}, false).actions).toEqual([{ kind: "seal", nodeId: "n1" }]);
    expect(planSeals([own("n1", undefined)], {}, true).actions).toEqual([{ kind: "clear", nodeId: "n1" }]);
  });

  it("leaves an already cleared copy alone", () => {
    expect(planSeals([own("n1", "")], {}, true).actions).toEqual([]);
  });

  it("clears a component whose code file is another site's", () => {
    const plan = planSeals([{ nodeId: "n9", seal: "s1.b.y", ownSite: false }], {}, true);
    expect(plan.actions).toEqual([{ kind: "clear", nodeId: "n9" }]);
  });

  it("asks the server about a seal it has no record of", () => {
    expect(planSeals([own("n1", "s1.c.z")], {}, true)).toEqual({ actions: [], unknown: ["s1.c.z"] });
  });
});

describe("resolveUnknown", () => {
  const instances = [own("n1", "s1.c.z"), own("n2", "s1.c.z"), own("n3", "s1.d.w")];

  it("adopts a seal this site issued, once, and clears the rest", () => {
    expect(resolveUnknown(instances, ["s1.c.z", "s1.d.w"], ["s1.c.z"])).toEqual([
      { kind: "adopt", nodeId: "n1", seal: "s1.c.z" },
      { kind: "clear", nodeId: "n2" },
      { kind: "clear", nodeId: "n3" },
    ]);
  });
});

describe("the registry", () => {
  it("records adoptions and new seals, and survives junk", () => {
    const next = applyToRegistry({ old: "n0" }, [{ kind: "adopt", nodeId: "n5", seal: "s1.a.x" }, { kind: "seal", nodeId: "n7" }], { n7: "s1.new.q" });
    expect(next).toEqual({ old: "n0", "s1.a.x": "n5", "s1.new.q": "n7" });
    expect(parseRegistry("not json")).toEqual({});
    expect(parseRegistry('["a"]')).toEqual({});
    expect(parseRegistry('{"s":"n","bad":1}')).toEqual({ s: "n" });
  });
});

describe("finding MemberFrame instances", () => {
  const file = { id: "file_1", path: "MemberAuth.tsx", exports: [{ insertURL: "https://framer.com/m/MemberAuth-abc.js@v2" }] };

  it("matches the same file at any version, or by an identifier naming it", () => {
    expect(instanceOfFile({ insertURL: "https://framer.com/m/MemberAuth-abc.js@v2", componentIdentifier: "" }, file)).toBe(true);
    expect(instanceOfFile({ insertURL: "https://framer.com/m/MemberAuth-abc.js@v1", componentIdentifier: "" }, file)).toBe(true);
    expect(instanceOfFile({ insertURL: null, componentIdentifier: "codeFile:file_1:default" }, file)).toBe(true);
    expect(instanceOfFile({ insertURL: "https://framer.com/m/Other-xyz.js@v1", componentIdentifier: "x" }, file)).toBe(false);
  });

  it("reads the site key baked into a component file", () => {
    expect(siteKeyOfFile('const CONFIG = {\n  siteKey: "sk_abc",\n};')).toBe("sk_abc");
    expect(siteKeyOfFile("no config here")).toBeNull();
  });
});
