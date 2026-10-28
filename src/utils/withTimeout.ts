/**
 * A promise that rejects once `ms` passes without the original settling.
 *
 * For Framer plugin calls: each one is a message to the editor, and one that
 * never answers would hold a panel action (and its spinner) forever. The
 * original call is not cancelled, since the SDK has no way to, so a late
 * answer can still land; the caller only stops waiting for it.
 */
export class TimeoutError extends Error {
  constructor(label: string) {
    super(`${label} took too long`);
    this.name = "TimeoutError";
  }
}

export function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new TimeoutError(label)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}
