import React from "react";
import { CheckCircle2, CreditCard } from "lucide-react";
import { Banner, FieldRow, FieldRows, TextField, fieldErrorId } from "../ui";
import {
  GATEWAY_AVAILABILITY,
  VAULT_FIELDS,
  checkKey,
  isTestKey,
  keyProblemMessage,
  type VaultFieldSpec,
} from "./gatewayKeys";
import {
  GATEWAY_LABELS,
  type GatewayKeyStatus,
  type GatewayVaultDraft,
  type SiteGatewayStatus,
} from "../../types/site";

export interface GatewayVaultProps {
  draft: GatewayVaultDraft;
  status: SiteGatewayStatus;
  onChange: (field: VaultFieldSpec["field"], value: string) => void;
}

/**
 * The gateway key vault. PRD task 2.4, feature F03.
 *
 * ## No secret is persisted anywhere by this component
 *
 * This is the part of F03 worth being careful about, because the obvious
 * implementation is a security defect that would pass every gate. The panel
 * already keeps the active tab and the theme in `localStorage`, because
 * `framer.setPluginData` is not permitted until task 5.6, and the temptation is
 * to persist the vault the same way so a creator's keys survive a reopen. That
 * would put a live Stripe secret key in a browser-origin store, readable by
 * anything in that origin, indefinitely.
 *
 * So: a secret lives in this component's parent state for as long as the unsaved
 * edit lives, and nowhere else. No storage API appears in this subtree, which
 * `test/gatewayKeys.test.ts` asserts by reading the source.
 *
 * ## Validation here is guidance
 *
 * `checkKey` tells the creator they have pasted a key into the wrong field and
 * flags a test key. Whether a key works is decided by
 * `POST /api/site/gateway/validate`, per F03's configuration flow step 3.
 */
export const GatewayVault: React.FC<GatewayVaultProps> = ({ draft, status, onChange }) => (
  <div className="gateway-vault">
    {GATEWAY_AVAILABILITY.map(({ gateway, available, task }) => {
      const fields = VAULT_FIELDS.filter((field) => field.gateway === gateway);
      const keyStatus = status[gateway];
      const anyTestKey = fields.some((field) => isTestKey(draft[field.field]));

      return (
        <section key={gateway} className="gateway-section">
          <header className="gateway-section-head">
            <span className="gateway-section-logo" aria-hidden={true}>
              <CreditCard />
            </span>
            <span className="gateway-section-titles">
              <span className="gateway-section-name">{GATEWAY_LABELS[gateway]}</span>
              <span className="gateway-section-note">{describeStatus(keyStatus, available, task)}</span>
            </span>
            {/*
              F03: "Test keys route to gateway test mode and are clearly labelled
              in the UI." Warning tone rather than neutral, because shipping a
              site with test keys takes no money and a creator may not notice
              for a week. This is a state they should want to leave.
            */}
            {anyTestKey || keyStatus.mode === "test" ? (
              <span className="badge badge-warning">Test mode</span>
            ) : null}
            {keyStatus.verified ? (
              <span className="badge badge-success">
                <CheckCircle2 aria-hidden={true} />
                Verified
              </span>
            ) : null}
          </header>

          <FieldRows>
            {fields.map((field) => {
              const value = draft[field.field];
              const check = checkKey(value, field.gateway, field.role);
              const error = keyProblemMessage(check) ?? undefined;
              const inputId = `vault-${field.field}`;

              return (
                <FieldRow key={field.field} label={field.label} htmlFor={inputId} error={error} fill>
                  <TextField
                    id={inputId}
                    /*
                      A secret renders in a password input so it is not readable
                      over a creator's shoulder or in a screen share, which is
                      where a plugin panel usually lives.
                    */
                    type={field.secret ? "password" : "text"}
                    value={value}
                    placeholder={
                      keyStatus.configured && value === ""
                        ? savedPlaceholder(keyStatus)
                        : field.placeholder
                    }
                    disabled={!available}
                    invalid={Boolean(error)}
                    aria-describedby={error ? fieldErrorId(inputId) : undefined}
                    autoComplete="off"
                    spellCheck={false}
                    onChange={(next) => onChange(field.field, next)}
                    fill
                  />
                </FieldRow>
              );
            })}
          </FieldRows>
        </section>
      );
    })}

    <Banner
      tone="info"
      title="Keys Are Stored On The Server"
      message="Secrets are encrypted before storage and never sent back to this panel. Leave a field blank to keep the key you already saved."
    />
  </div>
);

/**
 * The line under a gateway name.
 *
 * PRD section 7.6 rule 4 and rule 6: no raw values, and a full sentence. The two
 * gateways that arrive in Phase 2 name the task that enables them rather than
 * being hidden, because hiding them would present the product as Stripe-only,
 * which is the exact competitor limitation F03 exists to beat.
 */
function describeStatus(status: GatewayKeyStatus, available: boolean, task: string): string {
  if (!available) return `Arrives with task ${task}.`;
  if (status.verified) return "Connected and verified.";
  if (status.configured) return "Saved, not verified yet.";
  return "Not connected yet.";
}

/** What a saved key looks like in an empty field. Four characters, never more. */
function savedPlaceholder(status: GatewayKeyStatus): string {
  return status.maskedSuffix ? `Saved, ending ${status.maskedSuffix}` : "Saved";
}
