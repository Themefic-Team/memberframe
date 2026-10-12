import React, { useCallback, useEffect, useState } from "react";
import { Save } from "lucide-react";
import {
  Banner,
  Button,
  Checkbox,
  FieldRow,
  FieldRows,
  Segmented,
  Select,
  useToast,
} from "../ui";
import { GatewayVault } from "../settings/GatewayVault";
import type { VaultFieldSpec } from "../settings/gatewayKeys";
import { checkKey, VAULT_FIELDS } from "../settings/gatewayKeys";
import type { ThemePreference } from "../../hooks/useFramerTheme";
import { failureMessage } from "../../services/apiClient";
import { fetchGatewayStatus, saveGatewayConfig } from "../../services/siteService";
import {
  EMPTY_GATEWAY_VAULT_DRAFT,
  UNCONFIGURED_GATEWAY_STATUS,
  type CurrencyCode,
  type GatewayVaultDraft,
  type SiteGatewayStatus,
} from "../../types/site";

export interface SettingsTabProps {
  themePreference: ThemePreference;
  onChangeThemePreference: (preference: ThemePreference) => void;
}

const THEME_OPTIONS = [
  { value: "auto", label: "Auto" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
] as const satisfies ReadonlyArray<{ value: ThemePreference; label: string }>;

const CURRENCY_OPTIONS: ReadonlyArray<{ value: CurrencyCode; label: string }> = [
  { value: "USD", label: "USD, US dollar" },
  { value: "EUR", label: "EUR, euro" },
  { value: "GBP", label: "GBP, pound sterling" },
  { value: "INR", label: "INR, Indian rupee" },
];

/** See `ManageTab.tsx`. One named placeholder for creator sign-in to replace. */
const PLACEHOLDER_SITE_ID = "unconfigured";

/**
 * The Settings tab. PRD task 2.4, feature F03, layout in section 7.3.
 *
 * Carries the tab's one `.primary-cta`, "Save settings".
 *
 * ## Which controls need a save, and which do not
 *
 * PRD section 7.5: a toggle is for instant-apply only, a checkbox is for when a
 * save is required. So the theme switcher stays a segmented control that
 * applies as you pick it, and everything behind "Save settings", including
 * geolocation routing, is a checkbox. Mixing the two would teach the creator
 * that some switches take effect and some do not, with nothing on screen saying
 * which.
 *
 * ## No secret is written to this panel's storage
 *
 * The vault draft is state in this component and nothing more. It is not
 * persisted, not restored, and deliberately lost when the panel closes with
 * unsaved edits. See `GatewayVault.tsx` for the full reasoning.
 */
export const SettingsTab: React.FC<SettingsTabProps> = ({
  themePreference,
  onChangeThemePreference,
}) => {
  const [draft, setDraft] = useState<GatewayVaultDraft>(EMPTY_GATEWAY_VAULT_DRAFT);
  const [status, setStatus] = useState<SiteGatewayStatus>(UNCONFIGURED_GATEWAY_STATUS);
  const [failure, setFailure] = useState<{ title: string; message: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const showToast = useToast();

  useEffect(() => {
    let active = true;

    void fetchGatewayStatus(PLACEHOLDER_SITE_ID).then((result) => {
      if (!active) return;

      if (result.kind === "ok") {
        setStatus(result.data);
        setDraft((current) => ({
          ...current,
          defaultCurrency: result.data.defaultCurrency,
          autoDetectGeolocation: result.data.autoDetectGeolocation,
        }));
        setFailure(null);
      } else {
        setStatus(UNCONFIGURED_GATEWAY_STATUS);
        setFailure(failureMessage(result));
      }
    });

    return () => {
      active = false;
    };
  }, []);

  const handleFieldChange = useCallback((field: VaultFieldSpec["field"], value: string) => {
    setDraft((current) => ({ ...current, [field]: value }));
  }, []);

  /**
   * A field with a shape problem blocks the save.
   *
   * Only shape, never validity. Validity is the server's answer, and refusing
   * to send a key because a client-side rule did not recognise it is how a
   * creator gets told their working key is invalid.
   */
  const blockingProblem = VAULT_FIELDS.some(
    (field) => checkKey(draft[field.field], field.gateway, field.role).problem !== null
  );

  const handleSave = useCallback(async () => {
    setSaving(true);

    const result = await saveGatewayConfig(PLACEHOLDER_SITE_ID, draft);

    setSaving(false);

    if (result.kind === "ok") {
      setStatus(result.data);
      // Clear the secrets the moment they are saved. The masked suffix from the
      // server takes their place in the fields, and nothing in this panel holds
      // a plaintext key any longer than the request took.
      setDraft({
        ...EMPTY_GATEWAY_VAULT_DRAFT,
        defaultCurrency: result.data.defaultCurrency,
        autoDetectGeolocation: result.data.autoDetectGeolocation,
      });
      setFailure(null);
      showToast({ tone: "success", message: "Settings saved" });
      return;
    }

    const described = failureMessage(result);
    setFailure(described);
    showToast({ tone: "error", message: "Could not save settings" });
  }, [draft, showToast]);

  return (
    <div className="tab-panel-body">
      <section className="section-group">
        <h2 className="section-title">Panel</h2>
        <FieldRows>
          {/* Instant apply, so a segmented control and no save. */}
          <FieldRow label="Panel theme" fill>
            <Segmented
              label="Panel theme"
              options={THEME_OPTIONS}
              value={themePreference}
              onChange={onChangeThemePreference}
            />
          </FieldRow>
        </FieldRows>
      </section>

      <section className="section-group">
        <h2 className="section-title">Payments</h2>

        {failure ? <Banner tone="warning" title={failure.title} message={failure.message} /> : null}

        <GatewayVault draft={draft} status={status} onChange={handleFieldChange} />

        <FieldRows>
          <FieldRow label="Default currency" htmlFor="settings-currency">
            <Select
              id="settings-currency"
              value={draft.defaultCurrency}
              options={CURRENCY_OPTIONS}
              onChange={(value) => setDraft((current) => ({ ...current, defaultCurrency: value }))}
            />
          </FieldRow>

          {/*
            A checkbox, not a toggle. It only takes effect on save, and PRD
            section 7.5 reserves the toggle for instant-apply controls.
          */}
          <FieldRow label="Route by buyer location" htmlFor="settings-geo">
            <Checkbox
              id="settings-geo"
              checked={draft.autoDetectGeolocation}
              onChange={(checked) =>
                setDraft((current) => ({ ...current, autoDetectGeolocation: checked }))
              }
            />
          </FieldRow>
        </FieldRows>

        <p className="settings-help">
          {draft.autoDetectGeolocation
            ? "Buyers are routed to the gateway that fits their country. Routing happens on the server."
            : `Every buyer is charged in ${draft.defaultCurrency} through the gateway that supports it.`}
        </p>
      </section>

      {/* The tab's one and only `.primary-cta`, per PRD section 7.3. */}
      <div className="settings-cta">
        <Button
          variant="primary"
          size="md"
          className="fill"
          disabled={saving || blockingProblem}
          onClick={() => void handleSave()}
        >
          <Save aria-hidden={true} />
          {saving ? "Saving" : "Save settings"}
        </Button>
        {blockingProblem ? (
          <p className="settings-cta-note">Fix the highlighted key before saving.</p>
        ) : null}
      </div>
    </div>
  );
};
