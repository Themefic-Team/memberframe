import React from "react";
import { Banner } from "../ui";
import { MembershipSettings } from "./MembershipSettings";
import { EmailSettings, type EmailSettingsProps } from "./EmailSettings";
import type { ThemePreference } from "../../hooks/useFramerTheme";
import type { AuthSettings } from "../../types/connection";

export interface ConfigPanelProps {
  themePreference: ThemePreference;
  onChangeThemePreference: (preference: ThemePreference) => void;
  auth: AuthSettings | null;
  onChangeAuth: (next: AuthSettings) => void;
  failure: { title: string; message: string } | null;
  saving: boolean;
  /** The Email sending card, 25-custom-smtp.md. */
  email: EmailSettingsProps;
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
  failure,
  saving,
  email,
}) => (
  <>
    {failure ? <Banner tone="warning" title={failure.title} message={failure.message} /> : null}

    {auth ? (
      <section className="section-group">
        <h2 className="section-title">Membership</h2>
        <MembershipSettings value={auth} onChange={onChangeAuth} disabled={saving} />
      </section>
    ) : null}

    <section className="section-group">
      <div className="section-header">
        <h2 className="section-title">Email</h2>
        <p className="section-subtitle">Send members' codes and reset links from your own address. Off, MemberFrame sends them.</p>
      </div>
      <EmailSettings {...email} />
    </section>

    {/* Currency, routing, and gateways moved to Manage, Payments, FP-16. */}
    {/* <p className="settings-help">Payments, currency, and gateway routing are in Manage, Payments.</p> */}
  </>
);
