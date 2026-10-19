import React from "react";
import { LicenseContext, useLicenseState } from "../../hooks/useLicense";

/** The license, for every tab. Inside ConnectionProvider, since it reads the site id. */
export const LicenseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <LicenseContext.Provider value={useLicenseState()}>{children}</LicenseContext.Provider>
);
