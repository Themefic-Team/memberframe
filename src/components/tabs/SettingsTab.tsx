import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Save } from "lucide-react";
import { Banner, Button, Segmented, useToast } from "../ui";
import { ConfigPanel } from "../settings/ConfigPanel";
import { IntegrationPanel } from "../settings/IntegrationPanel";
import { WebhooksPanel } from "../settings/WebhooksPanel";
import { PageLocksPanel } from "../settings/PageLocksPanel";
import { CustomFieldsPanel } from "../settings/CustomFieldsPanel";
import {
  normalizeDefinitions,
  readDefinitions,
  type CustomFieldDefinition,
} from "../../utils/customFields";
import {
  readStoredIntegration,
  type IntegrationId,
  type IntegrationState,
} from "../settings/integrationRegistry";
import type { ThemePreference } from "../../hooks/useFramerTheme";
import { failureMessage } from "../../services/apiClient";
import { SMTP_INTEGRATION_ID } from "../../utils/smtpSettings";
import { isSafeSitePath, saveSiteSettings } from "../../services/siteSettingsService";
import { useConnection } from "../../hooks/useConnection";
import { useSiteTiers } from "../../hooks/useSiteTiers";
import type { AuthSettings, GatedPageRule, SectionLockRule } from "../../types/connection";
import { deployBaseUrl } from "../../config/backend";
import { framer } from "framer-plugin";
import {
  SECTION_LOCKS_FILE_NAME,
  normalizeSectionLockName,
  sectionLocksCode,
  writeCodeFile,
  type DeployContext,
} from "../../services";

export interface SettingsTabProps {
  themePreference: ThemePreference;
  onChangeThemePreference: (preference: ThemePreference) => void;
}

type SettingsView = "config" | "locks" | "fields" | "integration";

const VIEWS = [
  { value: "config", label: "Config" },
  { value: "locks", label: "Page locks" },
  { value: "fields", label: "Fields" },
  { value: "integration", label: "Integration" },
] as const satisfies ReadonlyArray<{ value: SettingsView; label: string }>;

/**
 * Whether the Integration tab may save secret fields.
 *
 * True since FP-16. Payment gateway keys no longer live in this tab: they
 * have their own encrypted store behind Manage, Payments. What remains here
 * are the sign in providers, whose client secrets the server reads to finish
 * an OAuth exchange.
 */
const SECRETS_SUPPORTED = true;

/**
 * The Settings tab. PRD task 2.4, feature F03, layout in section 7.3.
 *
 * Two sub-tabs behind the same `Segmented` control the Manage tab uses, so the
 * two tabs behave identically and a creator learns the pattern once.
 *
 *   Config        the site's own settings: panel theme, membership paths and
 *                 policy, currency and routing
 *   Integration   third-party credentials, as a catalogue of cards
 *
 * ## Why the split, and why the keys moved
 *
 * A gateway key is an integration's configuration rather than a site setting,
 * and the previous single page mixed the two: a creator looking for the login
 * path scrolled past a Stripe secret key field. They also want different save
 * models. A setting is edited alongside four others and saved together; an
 * integration is connected on its own, once, and the card that owns it owns its
 * save.
 *
 * ## Two different saves, deliberately
 *
 * Config has one `.primary-cta` that writes the membership document and the
 * payment routing together. Integration has none at catalogue level: each card
 * saves itself when it is expanded. Those are mutually exclusive views, so the
 * one-CTA-per-view rule holds in both.
 *
 * ## No secret is written to this panel's storage
 *
 * Nothing here persists a credential client side. The integration draft lives
 * in the card's own state and dies with it, and a stored secret is never
 * returned to the panel at all: what comes back is a masked suffix.
 */
export const SettingsTab: React.FC<SettingsTabProps> = ({
  themePreference,
  onChangeThemePreference,
}) => {
  const { connection, settings, settingsVersion, applySettings } = useConnection();
  const siteTierList = useSiteTiers(connection?.siteId ?? null);
  const siteId = connection?.siteId ?? null;

  const [view, setView] = useState<SettingsView>("config");

  /**
   * A local copy of the membership settings, edited until Save.
   *
   * `null` until the connection loads, and reset from it whenever the stored
   * document changes. Editing the context copy directly would make every
   * keystroke a shared state change, and would mean an unsaved edit survived a
   * tab switch, which contradicts "Save settings" meaning anything.
   */
  const [auth, setAuth] = useState<AuthSettings | null>(null);

  const [gatedPages, setGatedPages] = useState<GatedPageRule[]>(
    () =>
      settings?.gatedPages ?? [
        {
          path: "/dashboard",
          enabled: true,
          requiredTier: "signed_in",
          fallbackAction: "redirect",
          redirectPath: "/login",
        },
        {
          path: "/private-content",
          enabled: true,
          requiredTier: "signed_in",
          fallbackAction: "redirect",
          redirectPath: "/login",
        },
      ]
  );

  /** Section locks being edited. Saved with the page locks, by the same button. */
  const [sectionLocks, setSectionLocks] = useState<SectionLockRule[]>(() => settings?.sectionLocks ?? []);

  /**
   * The profile field definitions being edited, FP-09. Same draft-until-save
   * model as `auth`, reset whenever the stored document changes.
   */
  const storedFields = useMemo(() => readDefinitions(settings?.customFields), [settings]);
  const [customFields, setCustomFields] = useState<CustomFieldDefinition[]>(storedFields);

  useEffect(() => {
    setCustomFields(storedFields);
  }, [storedFields]);

  const savedFieldKeys = useMemo(() => storedFields.map((field) => field.key), [storedFields]);

  // Compared in saved form, so moving a field and back again, or typing a space
  // and deleting it, does not count as an unsaved change.
  const fieldsDirty = useMemo(
    () =>
      JSON.stringify(normalizeDefinitions(customFields)) !==
      JSON.stringify(normalizeDefinitions(storedFields)),
    [customFields, storedFields]
  );

  useEffect(() => {
    setAuth(settings ? { ...settings.auth } : null);
    if (settings && Array.isArray(settings.gatedPages)) {
      setGatedPages(settings.gatedPages);
    }
    if (settings) {
      setSectionLocks(Array.isArray(settings.sectionLocks) ? settings.sectionLocks : []);
    }
  }, [settings]);

  const deployContext = useMemo<DeployContext>(
    () => ({
      apiBaseUrl: deployBaseUrl(),
      siteKey: connection?.siteKey ?? "",
      afterLoginPath: settings?.auth.afterLoginPath ?? "",
      loginPath: settings?.auth.loginPath ?? "/login",
      afterLogoutPath: settings?.auth.afterLogoutPath ?? "/",
      tiers: siteTierList,
    }),
    [connection, settings, siteTierList]
  );

  const [failure, setFailure] = useState<{ title: string; message: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [savingIntegration, setSavingIntegration] = useState<IntegrationId | null>(null);
  const [savingSmtp, setSavingSmtp] = useState(false);
  const showToast = useToast();

  /**
   * The stored integrations, read out of the settings document.
   *
   * Defensive on every read because the source is a JSON column that nothing
   * validates, and the panel must render a card either way. A corrupt entry
   * reads as not configured, which shows an Install button rather than breaking
   * the tab.
   */
  const integrationState = useMemo<IntegrationState>(() => {
    const stored = settings?.integrations;
    if (!stored || typeof stored !== "object") return {};

    const state: IntegrationState = {};

    for (const [id, value] of Object.entries(stored)) {
      state[id as IntegrationId] = readStoredIntegration(value);
    }

    return state;
  }, [settings]);

  /**
   * A bad path is not merely untidy.
   *
   * Every one of the five is baked into a deployed component or an emailed
   * link, and a value that is not site-relative turns a redirect into an open
   * redirect.
   */
  const blockingProblem =
    auth !== null &&
    (
      [
        auth.loginPath,
        auth.signupPath,
        auth.resetPath,
        auth.afterLoginPath,
        auth.afterLogoutPath,
      ] as const
    ).some((path) => !isSafeSitePath(path));

  const handleSave = useCallback(async () => {
    if (!siteId) return;

    setSaving(true);

    // The membership settings. Payment routing moved to Manage, Payments
    // (FP-16), which saves to its own table.
    if (auth) {
      const settingsResult = await saveSiteSettings(siteId, settingsVersion, { auth });

      if (settingsResult.kind !== "ok") {
        setSaving(false);
        setFailure(failureMessage(settingsResult));
        showToast({ tone: "error", message: "Could not save settings" });
        return;
      }

      applySettings(settingsResult.data.settings, settingsResult.data.version);
    }

    setSaving(false);
    setFailure(null);
    showToast({ tone: "success", message: "Settings saved" });
  }, [applySettings, auth, settingsVersion, showToast, siteId]);

  /**
   * Save one integration's non-secret values.
   *
   * A merge into the settings document rather than a replacement, keyed on the
   * integration id, so connecting Stripe cannot disturb a Google client id
   * saved last week. `secretsPresent` is deliberately not sent: it is the
   * server's answer about what it holds, not something the panel may assert.
   */
  const handleSaveIntegration = useCallback(
    async (id: IntegrationId, values: Record<string, string>) => {
      if (!siteId) return;

      setSavingIntegration(id);

      const result = await saveSiteSettings(siteId, settingsVersion, {
        integrations: {
          [id]: { enabled: Object.keys(values).length > 0, values },
        },
      });

      setSavingIntegration(null);

      if (result.kind === "ok") {
        applySettings(result.data.settings, result.data.version);
        setFailure(null);
        showToast({ tone: "success", message: "Integration saved" });
        return;
      }

      setFailure(failureMessage(result));
      showToast({ tone: "error", message: "Could not save integration" });
    },
    [applySettings, settingsVersion, showToast, siteId]
  );

  /**
   * Save the site's own SMTP (25-custom-smtp.md). The whole entry, on or off;
   * a password left out keeps the one the server holds. Resolves true on
   * success, so the card can close.
   */
  const handleSaveSmtp = useCallback(
    async (enabled: boolean, values: Record<string, string>): Promise<boolean> => {
      if (!siteId) return false;

      setSavingSmtp(true);
      const result = await saveSiteSettings(siteId, settingsVersion, {
        integrations: { [SMTP_INTEGRATION_ID]: { enabled, values } },
      });
      setSavingSmtp(false);

      if (result.kind === "ok") {
        applySettings(result.data.settings, result.data.version);
        setFailure(null);
        showToast({ tone: "success", message: enabled ? "Email sending saved" : "Using MemberFrame's sender" });
        return true;
      }

      setFailure(failureMessage(result));
      showToast({ tone: "error", message: "Could not save email sending" });
      return false;
    },
    [applySettings, settingsVersion, showToast, siteId]
  );

  /**
   * Turn one integration on or off, immediately.
   *
   * A toggle commits the moment it moves, per PRD section 7.5, so this writes
   * rather than staging an edit. The values are carried through unchanged: this
   * endpoint replaces an integration's whole entry, so sending `enabled` alone
   * would clear the credentials the creator is trying to switch off rather than
   * delete.
   */
  const handleToggleIntegration = useCallback(
    async (id: IntegrationId, enabled: boolean) => {
      if (!siteId) return;

      setSavingIntegration(id);

      const existing = integrationState[id];

      const result = await saveSiteSettings(siteId, settingsVersion, {
        integrations: { [id]: { enabled, values: existing?.values ?? {} } },
      });

      setSavingIntegration(null);

      if (result.kind === "ok") {
        applySettings(result.data.settings, result.data.version);
        setFailure(null);
        showToast({ tone: "success", message: enabled ? "Integration on" : "Integration off" });
        return;
      }

      setFailure(failureMessage(result));
      showToast({ tone: "error", message: "Could not change that" });
    },
    [applySettings, integrationState, settingsVersion, showToast, siteId]
  );

  const handleSavePageLocks = useCallback(async () => {
    if (!siteId) {
      showToast({
        tone: "neutral",
        message: "Connect this project from Account, top right, before saving page locks.",
      });
      return;
    }

    setSaving(true);
    const savedLocks = sectionLocks.map((rule) => ({ ...rule, name: normalizeSectionLockName(rule.name) }));
    const savedPages = gatedPages.map((rule) => ({ ...rule, fallbackAction: "redirect" as const }));
    const result = await saveSiteSettings(siteId, settingsVersion, { gatedPages: savedPages, sectionLocks: savedLocks });

    if (result.kind === "ok") {
      applySettings(result.data.settings, result.data.version);
      setFailure(null);

      // Keep Framer's Code overrides list in step with the locks: one override
      // per lock in MemberLocks. Written when there are locks, or when the file
      // is already there and a lock was removed. Never created for nothing.
      const fileNames = await framer
        .getCodeFiles()
        .then((files) => files.map((file) => file.name))
        .catch((): string[] => []);
      if (savedLocks.length > 0 || fileNames.includes(SECTION_LOCKS_FILE_NAME)) {
        const written = await writeCodeFile(framer, SECTION_LOCKS_FILE_NAME, sectionLocksCode(savedLocks));
        if (!written.ok) {
          setSaving(false);
          setFailure({ title: "Locks saved, MemberLocks not updated", message: written.message });
          showToast({ tone: "error", message: "Locks saved, MemberLocks not updated" });
          return;
        }
      }

      setSaving(false);
      showToast({ tone: "success", message: "Locks saved" });
      return;
    }

    setSaving(false);

    setFailure(failureMessage(result));
    showToast({
      tone: "error",
      message: failureMessage(result).message || "Could not save page locks",
    });
  }, [applySettings, gatedPages, sectionLocks, settingsVersion, showToast, siteId]);

  /**
   * Save the field list, FP-09.
   *
   * The whole list, because the server replaces it wholesale: that is the only
   * way deleting a field can be expressed. The version check still applies, so
   * a second panel open on the same project cannot overwrite this one's edits
   * without being told.
   */
  const handleSaveFields = useCallback(async () => {
    if (!siteId) return;

    setSaving(true);
    const result = await saveSiteSettings(siteId, settingsVersion, {
      customFields: normalizeDefinitions(customFields),
    });
    setSaving(false);

    if (result.kind === "ok") {
      applySettings(result.data.settings, result.data.version);
      setFailure(null);
      showToast({ tone: "success", message: "Fields saved" });
      return;
    }

    setFailure(failureMessage(result));
    showToast({ tone: "error", message: "Could not save fields" });
  }, [applySettings, customFields, settingsVersion, showToast, siteId]);

  return (
    <div className="tab-panel-body">
      <Segmented label="Settings view" options={VIEWS} value={view} onChange={setView} />

      {view === "config" ? (
        <>
          <ConfigPanel
            themePreference={themePreference}
            onChangeThemePreference={onChangeThemePreference}
            auth={auth}
            onChangeAuth={setAuth}
            failure={failure}
            saving={saving}
            email={{
              siteId,
              stored: integrationState[SMTP_INTEGRATION_ID],
              saving: savingSmtp,
              onSave: handleSaveSmtp,
            }}
          />

          {/* The Config view's one and only `.primary-cta`, per PRD section 7.3. */}
          <div className="settings-cta">
            <Button
              variant="primary"
              size="md"
              className="fill"
              disabled={saving || blockingProblem || siteId === null}
              onClick={() => void handleSave()}
            >
              <Save aria-hidden={true} />
              {saving ? "Saving" : "Save settings"}
            </Button>
            {siteId === null ? (
              <p className="settings-cta-note">Connect this project before saving settings.</p>
            ) : blockingProblem ? (
              <p className="settings-cta-note">Fix the highlighted field before saving.</p>
            ) : null}
          </div>
        </>
      ) : view === "fields" ? (
        <>
          {failure ? (
            <Banner tone="warning" title={failure.title} message={failure.message} />
          ) : null}

          <CustomFieldsPanel
            fields={customFields}
            onChangeFields={setCustomFields}
            savedKeys={savedFieldKeys}
            saving={saving}
            onSave={() => void handleSaveFields()}
            siteConnected={siteId !== null}
            dirty={fieldsDirty}
          />
        </>
      ) : view === "locks" ? (
        <PageLocksPanel
          rules={gatedPages}
          onChangeRules={setGatedPages}
          sectionLocks={sectionLocks}
          onChangeSectionLocks={setSectionLocks}
          saving={saving}
          onSave={() => void handleSavePageLocks()}
          deployContext={deployContext}
          siteConnected={siteId !== null}
          tiers={siteTierList}
        />
      ) : (
        <>
          {failure ? (
            <Banner tone="warning" title={failure.title} message={failure.message} />
          ) : null}

          <IntegrationPanel
            state={integrationState}
            secretsSupported={SECRETS_SUPPORTED}
            savingId={savingIntegration}
            onSave={(id, values) => void handleSaveIntegration(id, values)}
            onToggleEnabled={(id, enabled) => void handleToggleIntegration(id, enabled)}
            connected={siteId !== null}
          />

          <WebhooksPanel
            siteId={siteId}
            tiers={siteTierList}
            profileFields={storedFields}
            siteName={connection?.siteName ?? "Your site"}
          />
        </>
      )}
    </div>
  );
};
