import { useEffect, useState } from "react";
import { fetchTiers } from "../services/siteService";
import { rememberSiteTiers, siteTiers, type TierLadderEntry } from "../types/member";

/**
 * The connected site's tiers, for deploy contexts and tier pickers outside
 * the Manage tab. FP-16, conflict C9.
 *
 * Starts from whatever the panel already knows (the Manage tab remembers the
 * list each time it loads it) and refreshes from the API once per site, so a
 * Builder deploy writes the gate's Access Tier list from the real tiers even
 * if the creator never opened Manage this session.
 */
export function useSiteTiers(siteId: string | null): ReadonlyArray<TierLadderEntry> {
  const [tiers, setTiers] = useState<ReadonlyArray<TierLadderEntry>>(() => siteTiers());

  useEffect(() => {
    if (!siteId) return;
    let active = true;
    void fetchTiers(siteId).then((result) => {
      if (!active || result.kind !== "ok" || result.data.tiers.length === 0) return;
      rememberSiteTiers(result.data.tiers);
      setTiers(siteTiers());
    });
    return () => {
      active = false;
    };
  }, [siteId]);

  return tiers;
}
