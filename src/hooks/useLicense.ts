/**
 * This project's MemberFrame license, for the whole panel. F19,
 * 19-pro-lock-and-trial.md section 2.1.
 *
 * Read once the connection names a site, again whenever the panel regains
 * focus (the creator may have paid in Stripe's portal), and after anything
 * here changes it. While a trial runs, `now` ticks every second for the
 * countdown. Whenever what the canvas should draw changes, the deployed
 * component files are rewritten (`enforceLockState`).
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { framer } from "framer-plugin";
import { useConnection } from "./useConnection";
import { canvasLicense, fetchLicense, panelUnlocked, type LicenseView } from "../services/licenseService";
import { enforceLockState, type PatchableCodeFile } from "../utils/lockPatcher";

export interface LicenseValue {
  /** Null until the first answer, and while signed out. */
  view: LicenseView | null;
  loading: boolean;
  /** Whether the panel's tabs work. False shows only Account (BEAF: lock everything). */
  unlocked: boolean;
  /** Milliseconds, ticking each second while a trial runs. */
  now: number;
  refresh: () => Promise<void>;
  /** Set from a response that already carries the license, to skip a round trip. */
  apply: (view: LicenseView) => void;
}

export const LicenseContext = createContext<LicenseValue | null>(null);

export function useLicense(): LicenseValue {
  const value = useContext(LicenseContext);
  if (!value) throw new Error("useLicense used outside LicenseProvider.");
  return value;
}

/** Rewrite the deployed files, when Framer lets this plugin. Never throws. */
async function syncCanvasFiles(view: LicenseView): Promise<void> {
  try {
    if (!framer.isAllowedTo("CodeFile.setFileContent")) return;
    await enforceLockState(canvasLicense(view.state), async () =>
      (await framer.getCodeFiles()) as unknown as ReadonlyArray<PatchableCodeFile>
    );
  } catch {
    // Outside Framer, or the project is read only: the runtime check still
    // draws the right state on the published site.
  }
}

export function useLicenseState(): LicenseValue {
  const { connection } = useConnection();
  const siteId = connection?.siteId ?? null;
  const [view, setView] = useState<LicenseView | null>(null);
  const [loading, setLoading] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const synced = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    if (!siteId) {
      setView(null);
      return;
    }
    setLoading(true);
    const result = await fetchLicense(siteId);
    setLoading(false);
    if (result.kind === "ok") setView(result.data.license);
  }, [siteId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!siteId) return;
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refresh, siteId]);

  // The countdown: a tick a second, only while a trial runs.
  useEffect(() => {
    if (view?.state !== "trial") return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [view?.state]);

  // A trial reaching its end while the panel is open: ask the server, which
  // now answers expired, so the lock appears without a reload.
  useEffect(() => {
    if (view?.state === "trial" && view.trialEndsAt && Date.parse(view.trialEndsAt) <= now) void refresh();
  }, [now, refresh, view]);

  // Keep the deployed components' four lines in step with the license.
  useEffect(() => {
    if (!view) return;
    const state = canvasLicense(view.state);
    if (synced.current === state) return;
    synced.current = state;
    void syncCanvasFiles(view);
  }, [view]);

  const apply = useCallback((next: LicenseView) => setView(next), []);

  return useMemo<LicenseValue>(
    () => ({ view, loading, unlocked: panelUnlocked(view?.state), now, refresh, apply }),
    [view, loading, now, refresh, apply]
  );
}
