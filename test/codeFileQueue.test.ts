/**
 * Code file saves run one at a time (src/utils/codeFileQueue.ts). Two
 * MemberFrame saves at once made Framer's save service answer 502 (2026-10-28).
 */

import { describe, expect, it } from "vitest";
import { queueCodeFileWrite } from "../src/utils/codeFileQueue";

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 5));

describe("queueCodeFileWrite", () => {
  it("never runs two saves at once", async () => {
    let running = 0;
    let most = 0;
    const save = async () => {
      running += 1;
      most = Math.max(most, running);
      await tick();
      running -= 1;
    };
    await Promise.all([queueCodeFileWrite(save), queueCodeFileWrite(save), queueCodeFileWrite(save)]);
    expect(most).toBe(1);
  });

  it("runs saves in the order they were queued", async () => {
    const order: number[] = [];
    await Promise.all(
      [1, 2, 3].map((n) =>
        queueCodeFileWrite(async () => {
          await tick();
          order.push(n);
        })
      )
    );
    expect(order).toEqual([1, 2, 3]);
  });

  it("keeps going after a save fails, and hands the failure to its caller", async () => {
    const failed = queueCodeFileWrite(async () => {
      throw new Error("Connection error");
    });
    const next = queueCodeFileWrite(async () => "saved");
    await expect(failed).rejects.toThrow("Connection error");
    await expect(next).resolves.toBe("saved");
  });
});
