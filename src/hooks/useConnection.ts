/**
 * The connection, as one piece of shared state.
 *
 * A context rather than per-tab state, because three tabs need the same site id
 * and they must agree. Two copies of "which site is this" is how the Manage tab
 * lists one site's members while the Settings tab writes another's.
 *
 * ## The loading sequence, which is the whole of this file
 *
 * On panel open:
 *
 *   1. Read the Framer project id. Everything is keyed on it.
 *   2. Read the stored connection and token from plugin data.
 *   3. If there is a token, ask the server whether it still works, and which
 *      site it reaches for THIS project.
 *   4. If the server says no, or the stored connection is for a different
 *      project, show the connect form.
 *
 * Step 4's second half is the one worth stating. A creator can open a different
 * Framer project with the same plugin, and the token is theirs rather than the
 * project's, so a stale stored connection would otherwise show them another
 * project's members. The project id is checked on every load, not just the
 * first.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ApiFailure } from "../services/apiClient";
import {
  disconnect as disconnectRequest,
  fetchConnectSession,
  siteForProject,
  toConnection,
} from "../services/connectService";
import {
  clearConnection,
  forgetTokenInMemory,
  loadStoredConnection,
  saveConnection,
  saveConnectionOnly,
} from "../services/connectionStore";
import { readProjectContext } from "../services/framerProjectService";
import type {
  ConnectionState,
  FramerProjectContext,
  SiteConnection,
  SiteSettingsDocument,
} from "../types/connection";

export interface ConnectionValue {
  state: ConnectionState;
  project: FramerProjectContext | null;
  /** Non-null exactly when `state.status === "connected"`. Saves a narrow at every call site. */
  connection: SiteConnection | null;
  settings: SiteSettingsDocument | null;
  settingsVersion: number;
  /** The last failure from a session check, for the Connect tab's banner. */
  failure: ApiFailure | null;
  /** Called by the Connect tab once a verify succeeds. */
  completeConnect: (
    connection: SiteConnection,
    token: string,
    settings: SiteSettingsDocument,
    version: number
  ) => Promise<void>;
  /** Called by the Settings tab after a successful save, so the panel stays current. */
  applySettings: (settings: SiteSettingsDocument, version: number) => void;
  /** Called after origins change, so the Connect tab's list is not stale. */
  applyConnection: (connection: SiteConnection) => Promise<void>;
  disconnect: () => Promise<void>;
  reload: () => void;
}

export const ConnectionContext = createContext<ConnectionValue | null>(null);

/**
 * Read the connection.
 *
 * Throws outside the provider rather than returning a default. A tab that
 * rendered with a silently-disconnected default would show an empty member
 * list and look like a backend problem.
 */
export function useConnection(): ConnectionValue {
  const value = useContext(ConnectionContext);
  if (!value) throw new Error("useConnection used outside ConnectionProvider.");
  return value;
}

/**
 * The state machine behind the provider.
 *
 * Exported separately from the provider component so the provider stays a few
 * lines of JSX and this stays testable as a hook. `ConnectionProvider` lives in
 * `components/ConnectionProvider.tsx` because this file holds no JSX and a
 * `.ts` extension cannot.
 */
export function useConnectionState(): ConnectionValue {
  const [state, setState] = useState<ConnectionState>({ status: "loading" });
  const [project, setProject] = useState<FramerProjectContext | null>(null);
  const [settingsVersion, setSettingsVersion] = useState(1);
  const [failure, setFailure] = useState<ApiFailure | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  /**
   * Guards a late response from a previous load.
   *
   * Without it, a reload triggered while the first request is in flight can be
   * overwritten by the first one's answer, which shows the creator the state
   * they just left.
   */
  const loadId = useRef(0);

  useEffect(() => {
    const id = ++loadId.current;
    let active = true;

    void (async () => {
      const context = await readProjectContext();
      if (!active || id !== loadId.current) return;

      setProject(context);

      // No SDK means the standalone browser preview. There is no project id to
      // key anything on, so the Connect tab says so rather than offering a
      // form that cannot work.
      if (context.unavailable) {
        setState({ status: "disconnected" });
        return;
      }

      const stored = await loadStoredConnection();
      if (!active || id !== loadId.current) return;

      if (!stored) {
        setState({ status: "disconnected" });
        return;
      }

      // The token is loaded into the API client by `loadStoredConnection`, so
      // this call carries it.
      const result = await fetchConnectSession();
      if (!active || id !== loadId.current) return;

      if (result.kind !== "ok") {
        // A 401 means the stored token is no longer accepted. Drop it from
        // memory so nothing keeps sending it, but leave plugin data alone: a
        // server that is merely unreachable must not cost the creator their
        // connection.
        if (result.kind === "unauthorized") forgetTokenInMemory();

        setFailure(result.kind === "unauthorized" ? null : result);
        setState({ status: "disconnected" });
        return;
      }

      const site = siteForProject(result.data.sites, context.projectId);

      // A stored connection for a different Framer project. The creator opened
      // another project with the same plugin, and showing them the stored
      // site's members here would be showing them the wrong site.
      if (!site) {
        setFailure(null);
        setState({ status: "disconnected" });
        return;
      }

      const connection = toConnection(site, result.data.creator);

      // Refresh the stored copy. The site name, the origin list, and the member
      // count all change outside this panel.
      void saveConnectionOnly(connection);

      setSettingsVersion(site.settingsVersion);
      setFailure(null);
      setState({ status: "connected", connection, settings: site.settings });
    })();

    return () => {
      active = false;
    };
  }, [reloadToken]);

  const completeConnect = useCallback(
    async (
      connection: SiteConnection,
      token: string,
      settings: SiteSettingsDocument,
      version: number
    ) => {
      await saveConnection(connection, token);
      setSettingsVersion(version);
      setFailure(null);
      setState({ status: "connected", connection, settings });
    },
    []
  );

  const applySettings = useCallback((settings: SiteSettingsDocument, version: number) => {
    setSettingsVersion(version);
    setState((current) =>
      current.status === "connected" ? { ...current, settings } : current
    );
  }, []);

  const applyConnection = useCallback(async (connection: SiteConnection) => {
    await saveConnectionOnly(connection);
    setState((current) => (current.status === "connected" ? { ...current, connection } : current));
  }, []);

  const disconnect = useCallback(async () => {
    // Tell the server first, while the token still works. Clearing locally
    // first would leave a live session row that nothing can revoke.
    await disconnectRequest();
    await clearConnection();
    setFailure(null);
    setState({ status: "disconnected" });
  }, []);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  return useMemo<ConnectionValue>(
    () => ({
      state,
      project,
      connection: state.status === "connected" ? state.connection : null,
      settings: state.status === "connected" ? state.settings : null,
      settingsVersion,
      failure,
      completeConnect,
      applySettings,
      applyConnection,
      disconnect,
      reload,
    }),
    [
      state,
      project,
      settingsVersion,
      failure,
      completeConnect,
      applySettings,
      applyConnection,
      disconnect,
      reload,
    ]
  );
}
