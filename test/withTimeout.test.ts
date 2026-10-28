/**
 * withTimeout: a Framer call that never answers must not hold a panel action
 * forever. Layer 1, node environment.
 */

import { describe, expect, it } from "vitest";
import { TimeoutError, withTimeout } from "../src/utils/withTimeout";

describe("withTimeout", () => {
  it("passes a value through when the call answers in time", async () => {
    await expect(withTimeout(Promise.resolve(7), 50, "Reading")).resolves.toBe(7);
  });

  it("passes the call's own error through", async () => {
    await expect(withTimeout(Promise.reject(new Error("refused")), 50, "Reading")).rejects.toThrow("refused");
  });

  it("rejects with a TimeoutError naming the step when the call never answers", async () => {
    const never = new Promise<never>(() => undefined);
    const outcome = withTimeout(never, 10, "Inserting the component");

    await expect(outcome).rejects.toBeInstanceOf(TimeoutError);
    await expect(outcome).rejects.toThrow("Inserting the component took too long");
  });
});
