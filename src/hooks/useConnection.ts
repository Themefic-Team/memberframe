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
 *   3. If there is a token, ask the server whether it still works, and pick
 *      the site whose id this project keeps in its plugin data.
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
import { setCreatorToken, type ApiFailure } from "../services/apiClient";
import {
  attachProject,
  disconnect as disconnectRequest,
  fetchConnectSession,
  siteById,
  toConnection,
} from "../services/connectService";
import {
  clearConnection,
  forgetTokenInMemory,
  loadStoredConnection,
  saveConnection,
  saveConnectionOnly,
  storedSiteIdFor,
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
  /**
   * F19: finish the browser-tab sign in. Takes the hand-off's token, claims
   * this project for the creator (starting its trial when they have none),
   * and stores both. Resolves to a failure to show, or null.
   */
  signInWithToken: (token: string, creator: { email: string; name: string; avatarUrl: string | null }) => Promise<ApiFailure | null>;
  /** Called by the Settings tab after a successful save, so the panel stays current. */
  applySettings: (settings: SiteSettingsDocument, version: number) => void;
  /** Called after origins change, so the Connect tab's list is not stale. */
  applyConnection: (connection: SiteConnection) => Promise<void>;
  disconnect: () => Promise<void>;
  reload: () => void;
  /**
   * Marketplace audit I1: this browser holds a working sign in, but this
   * project has no site yet. Nothing is sent until the creator clicks
   * "Link this project" (Profile), which calls `linkProject`.
   */
  linkable: boolean;
  /** Claims this project for the signed in creator (may start the trial). Resolves to a failure to show, or null. */
  linkProject: () => Promise<ApiFailure | null>;
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
  const [linkable, setLinkable] = useState(false);

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
    setLinkable(false);

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

      // The token is looked up for this project in this browser (audit C1).
      const stored = await loadStoredConnection(context.projectId);
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
        // A 401 means the stored token is no longer accepted. Forget it so
        // nothing keeps sending it, but keep the project's connection: a server
        // that is merely unreachable must not cost the creator their connection.
        if (result.kind === "unauthorized") forgetTokenInMemory();

        setFailure(result.kind === "unauthorized" ? null : result);
        setState({ status: "disconnected" });
        return;
      }

      // This project's site, by the id its plugin data holds. The stored
      // connection was written for this project (the token is keyed by its
      // id), so it is not a duplicate's.
      const site = siteById(result.data.sites, stored.connection.siteId);

      // A token that works, for a project it has no site for (the site was
      // removed). Linking may create a site and start the trial, so it waits
      // for a click (Marketplace audit I1): the launch sends only the token.
      if (!site) {
        setFailure(null);
        setLinkable(true);
        setState({ status: "disconnected" });
        return;
      }

      const connection = toConnection(site, result.data.creator, context.projectId);

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

  const signInWithToken = useCallback(
    async (token: string, creator: { email: string; name: string; avatarUrl: string | null }): Promise<ApiFailure | null> => {
      const context = project ?? (await readProjectContext());
      setCreatorToken(token);
      // Only the site id this project already holds, or nothing (Marketplace review).
      const siteId = await storedSiteIdFor(context.projectId);
      const attached = await attachProject(siteId ? { siteId } : {});
      if (attached.kind !== "ok") {
        setCreatorToken(null);
        return attached;
      }
      const connection = {
        ...toConnection(attached.data.site, attached.data.creator, context.projectId),
        ...(creator.avatarUrl ? { creatorAvatarUrl: creator.avatarUrl } : {}),
      };
      await saveConnection(connection, token);
      setLinkable(false);
      setSettingsVersion(attached.data.settingsVersion);
      setFailure(null);
      setState({ status: "connected", connection, settings: attached.data.settings });
      return null;
    },
    [project]
  );

  const linkProject = useCallback(async (): Promise<ApiFailure | null> => {
    const context = project ?? (await readProjectContext());
    const siteId = await storedSiteIdFor(context.projectId);
    const attached = await attachProject(siteId ? { siteId } : {});
    if (attached.kind !== "ok") {
      if (attached.kind === "unauthorized") {
        forgetTokenInMemory();
        setLinkable(false);
      }
      return attached;
    }
    const connection = toConnection(attached.data.site, attached.data.creator, context.projectId);
    void saveConnectionOnly(connection);
    setLinkable(false);
    setSettingsVersion(attached.data.settingsVersion);
    setFailure(null);
    setState({ status: "connected", connection, settings: attached.data.settings });
    return null;
  }, [project]);

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
    setLinkable(false);
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
      signInWithToken,
      applySettings,
      applyConnection,
      disconnect,
      reload,
      linkable,
      linkProject,
    }),
    [
      linkable,
      linkProject,
      signInWithToken,
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
