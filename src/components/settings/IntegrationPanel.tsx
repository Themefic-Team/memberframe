import React from "react";
import { Banner } from "../ui";
import { IntegrationCard } from "./IntegrationCard";
import {
  CATEGORY_LABELS,
  EMPTY_STORED_INTEGRATION,
  INTEGRATIONS,
  integrationsByCategory,
  type IntegrationId,
  type IntegrationState,
} from "./integrationRegistry";

export interface IntegrationPanelProps {
  state: IntegrationState;
  /** False while there is nowhere encrypted to put a secret. */
  secretsSupported: boolean;
  savingId: IntegrationId | null;
  onSave: (id: IntegrationId, values: Record<string, string>) => void;
  onToggleEnabled: (id: IntegrationId, enabled: boolean) => void;
  connected: boolean;
}

/**
 * The Integration tab's catalogue.
 *
 * Grouped by what the creator is trying to do rather than by vendor: someone
 * looking for Stripe and someone looking for Google sign-in are doing unrelated
 * jobs and should not have to read past each other.
 *
 * One column, not three. The reference layout is three across because it is a
 * full-width web page; this panel is 360 pixels and a three-column grid there
 * is three unreadable cards.
 */
/** One line under each group's title. Payments are not here, so Sign in points to them. */
const CATEGORY_SUBTITLES: Partial<Record<keyof typeof CATEGORY_LABELS, string>> = {
  auth: "Members sign in with an account they already have. Payments are in Manage, Payments.",
};

export const IntegrationPanel: React.FC<IntegrationPanelProps> = ({
  state,
  secretsSupported,
  savingId,
  onSave,
  onToggleEnabled,
  connected,
}) => {
  if (!connected) {
    return (
      <Banner
        tone="warning"
        title="Connect this project first"
        message="Integrations are stored against the connected site."
      />
    );
  }

  return (
    <>
      {/*
        Payment gateways live in Manage, Payments (FP-16), with their own
        encrypted key store and test and live modes. They are left out here
        so there is one place to connect them, and the Sign in subtitle says so.
      */}
      {integrationsByCategory(INTEGRATIONS.filter((entry) => entry.category !== "store")).map((group) => (
        <section key={group.category} className="section-group">
          <div className="section-header">
            <h2 className="section-title">{CATEGORY_LABELS[group.category]}</h2>
            {CATEGORY_SUBTITLES[group.category] ? (
              <p className="section-subtitle">{CATEGORY_SUBTITLES[group.category]}</p>
            ) : null}
          </div>

          <div className="integration-grid">
            {group.integrations.map((definition) => (
              <IntegrationCard
                key={definition.id}
                definition={definition}
                stored={state[definition.id] ?? EMPTY_STORED_INTEGRATION}
                secretsSupported={secretsSupported}
                saving={savingId === definition.id}
                onSave={(values) => onSave(definition.id, values)}
                onToggleEnabled={(enabled) => onToggleEnabled(definition.id, enabled)}
              />
            ))}
          </div>
        </section>
      ))}
    </>
  );
};
