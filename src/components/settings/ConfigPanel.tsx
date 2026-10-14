import React from "react";
import { Banner, Checkbox, FieldRow, FieldRows, Segmented, Select } from "../ui";
import { MembershipSettings } from "./MembershipSettings";
import type { ThemePreference } from "../../hooks/useFramerTheme";
import type { AuthSettings } from "../../types/connection";
import type { CurrencyCode, GatewayVaultDraft } from "../../types/site";

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

export interface ConfigPanelProps {
  themePreference: ThemePreference;
  onChangeThemePreference: (preference: ThemePreference) => void;
  auth: AuthSettings | null;
  onChangeAuth: (next: AuthSettings) => void;
  currency: CurrencyCode;
  autoDetectGeolocation: boolean;
  onChangePayments: (patch: Partial<GatewayVaultDraft>) => void;
  failure: { title: string; message: string } | null;
  saving: boolean;
}

/**
 * The Config sub-tab. Everything that is a setting rather than a credential.
 *
 * Three groups, in the order a creator meets them: the panel itself, the
 * membership their visitors see, and how money is routed. The gateway keys used
 * to be here and are now in Integration, which is the one thing that moved:
 * a key is an integration's configuration rather than a site setting, and
 * putting it back would mean two places to look for the same thing.
 *
 * ## Which controls need a save, and which do not
 *
 * PRD section 7.5: a toggle is for instant-apply only, a checkbox for when a
 * save is required. So the theme switcher stays a segmented control that
 * applies as you pick it, and everything behind "Save settings", geolocation
 * routing included, is a checkbox. Mixing the two would teach a creator that
 * some switches take effect and some do not, with nothing on screen saying
 * which.
 *
 * Prop driven and owning no state, so every branch is reachable by passing
 * props. `jsdom` is still not installed (blocker B5), so this is what makes the
 * logic behind it testable at all: it lives in `MembershipSettings` and in
 * `services/siteSettingsService.ts`, both of which a node test can reach.
 */
export const ConfigPanel: React.FC<ConfigPanelProps> = ({
  themePreference,
  onChangeThemePreference,
  auth,
  onChangeAuth,
  currency,
  autoDetectGeolocation,
  onChangePayments,
  failure,
  saving,
}) => (
  <>
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

    {auth ? (
      <section className="section-group">
        <h2 className="section-title">Membership</h2>
        <MembershipSettings value={auth} onChange={onChangeAuth} disabled={saving} />
      </section>
    ) : null}

    <section className="section-group">
      <h2 className="section-title">Payments</h2>

      {failure ? <Banner tone="warning" title={failure.title} message={failure.message} /> : null}

      <FieldRows>
        <FieldRow label="Default currency" htmlFor="settings-currency">
          <Select
            id="settings-currency"
            value={currency}
            options={CURRENCY_OPTIONS}
            onChange={(value) => onChangePayments({ defaultCurrency: value })}
          />
        </FieldRow>

        {/*
          A checkbox, not a toggle. It only takes effect on save, and PRD
          section 7.5 reserves the toggle for instant-apply controls.
        */}
        <FieldRow label="Route by buyer location" htmlFor="settings-geo">
          <Checkbox
            id="settings-geo"
            checked={autoDetectGeolocation}
            onChange={(checked) => onChangePayments({ autoDetectGeolocation: checked })}
          />
        </FieldRow>
      </FieldRows>

      <p className="settings-help">
        {autoDetectGeolocation
          ? "Buyers are routed to the gateway that fits their country. Routing happens on the server."
          : `Every buyer is charged in ${currency} through the gateway that supports it.`}
      </p>

      <p className="settings-help">
        Gateway keys moved to the Integration tab.
      </p>
    </section>
  </>
);
