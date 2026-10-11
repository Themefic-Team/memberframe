import { useCallback, useState } from "react";
import { DEFAULT_TAB, isTabId, type TabId } from "../components/tabs/tabs";

const STORAGE_KEY = "memberframe.active-tab";

/**
 * PRD task 0.7 requires the active tab to survive a panel close.
 *
 * This uses `localStorage`, not `framer.setPluginData`. Plugin data would tie
 * the choice to the Framer project, which is arguably nicer, but the
 * `setPluginData` and `getPluginData` permissions are not declared until PRD
 * task 5.6 and `framer.json` must not claim permissions ahead of the task that
 * needs them. Revisit at 5.6 if per-project persistence is wanted. Security rule
 * S2 bars tokens from local storage; a tab name is not a credential.
 */
export function useActiveTab(): [TabId, (tab: TabId) => void] {
  const [activeTab, setActiveTabState] = useState<TabId>(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      return isTabId(stored) ? stored : DEFAULT_TAB;
    } catch {
      return DEFAULT_TAB;
    }
  });

  const setActiveTab = useCallback((tab: TabId) => {
    setActiveTabState(tab);

    try {
      window.localStorage.setItem(STORAGE_KEY, tab);
    } catch {
      // Losing the choice on next open is acceptable. Breaking navigation is not.
    }
  }, []);

  return [activeTab, setActiveTab];
}
