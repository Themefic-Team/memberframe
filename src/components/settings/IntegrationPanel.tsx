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
        Said once, at the top, rather than on every card that has a secret
        field. Five copies of the same sentence is noise, and the card's own
        disabled field says it again where it matters.
      */}
      {secretsSupported ? null : (
        <Banner
          tone="info"
          title="Secret keys are not stored yet"
          message="Encrypted storage arrives with payments. Everything else saves now."
        />
      )}

      {integrationsByCategory(INTEGRATIONS).map((group) => (
        <section key={group.category} className="section-group">
          <h2 className="section-title">{CATEGORY_LABELS[group.category]}</h2>

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
