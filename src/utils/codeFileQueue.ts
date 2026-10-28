/**
 * One code file save at a time, across the whole plugin.
 *
 * Framer batches code file saves to its modules service, and two writers at
 * once (2026-10-28: the lock lines rewritten after a payment, while Add to
 * canvas created a file) made that service answer 502, "Connection error". The
 * first click failed and the second worked. Every writer (the license sync,
 * the seal guard, the deploy) goes through this queue, so a save never races
 * another.
 *
 * Not reentrant: a task must not queue another task and wait for it.
 */

let tail: Promise<unknown> = Promise.resolve();

export function queueCodeFileWrite<T>(task: () => Promise<T>): Promise<T> {
  const run = tail.then(task, task);
  // A failed task must not stop the ones after it.
  tail = run.catch(() => undefined);
  return run;
}
