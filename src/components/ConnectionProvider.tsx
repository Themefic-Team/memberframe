import React from "react";
import { ConnectionContext, useConnectionState } from "../hooks/useConnection";

/**
 * Supplies the connection to every tab.
 *
 * Deliberately thin. The state machine is `useConnectionState` in
 * `hooks/useConnection.ts`, which holds no JSX and is therefore a `.ts` file
 * that unit tests can import without a DOM. `jsdom` is still not installed
 * (blocker B5), so keeping the logic out of the component is what makes any of
 * it testable at all.
 */
export const ConnectionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const value = useConnectionState();

  return <ConnectionContext.Provider value={value}>{children}</ConnectionContext.Provider>;
};
