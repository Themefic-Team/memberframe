import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FileStack, Plus } from "lucide-react";
import { framer } from "framer-plugin";
import { Banner, Button, FieldRow, FieldRows, Select, useToast } from "../ui";
import {
  AUTH_SCREEN_DEFAULTS,
  deployCanvasComponent,
  generateAuthScreenCode,
  generateMemberAuthCode,
  generateMemberDashboardCode,
  generateMemberGateCode,
  generateMemberPricingCode,
  generateOnboardingModalCode,
  generateMeteredPaywallCode,
  generateProtectedDownloadCode,
  generateBookmarkButtonCode,
  generateBookmarksTrayCode,
  membershipPages,
  scaffoldMembershipPages,
  scaffoldSummary,
  type DeployContext,
  type GeneratedCanvasFile,
} from "../../services";
import { assetSummary, fetchAssets, type AssetList, type SiteAsset } from "../../services/assetsService";
import { useConnection } from "../../hooks/useConnection";
import { useSiteTiers } from "../../hooks/useSiteTiers";
import { deployBaseUrl } from "../../config/backend";
import {
  DEFAULT_MEMBER_AUTH_CONFIG,
  DEFAULT_MEMBER_DASHBOARD_CONFIG,
  DEFAULT_MEMBER_GATE_CONFIG,
  DEFAULT_MEMBER_PRICING_CONFIG,
  DEFAULT_ONBOARDING_MODAL_CONFIG,
  DEFAULT_METERED_PAYWALL_CONFIG,
  DEFAULT_PROTECTED_DOWNLOAD_CONFIG,
  DEFAULT_BOOKMARK_BUTTON_CONFIG,
  DEFAULT_BOOKMARKS_TRAY_CONFIG,
} from "../../types/canvas";
import {
  CANVAS_COMPONENTS,
  DEFAULT_COMPONENT_ID,
  PreviewStudio,
  findComponent,
  type CanvasComponentEntry,
  type CanvasComponentId,
} from "../studio";
import { MemberSessionProvider } from "../../hooks/useMemberSession";

const COMPONENT_OPTIONS = CANVAS_COMPONENTS.map((component) => ({
  value: component.id,
  label: component.name,
}));

/**
 * The Builder tab. PRD tasks 1.3 and 1.5, layout in section 7.4.
 *
 * Picker, preview, pages, insert. One primary CTA.
 *
 * ## The customizer was removed, deliberately
 *
 * This tab used to carry six configuration rows for `<MemberGate>`: required
 * tier, locked state, blur amount, redirect target, lock title, lock message.
 * **Every one of them is also a Framer property control on the component**, so a
 * creator configured the same value twice in two places and the panel's copy
 * was only ever the starting value.
 *
 * `<MemberAuth>` and `<MemberDashboard>` always worked the other way: inserted
 * with their defaults and configured in Framer's own sidebar, which is where a
 * creator is already working. The gate was the odd one out for the historical
 * reason that it was built first, before its property controls existed.
 *
 * So the gate is now deployed with `DEFAULT_MEMBER_GATE_CONFIG` and configured
 * on the canvas like the other two. Recorded as conflict C30: this reduces PRD
 * task 1.3's scope and the second half of feature F04.
 *
 * ## The preview stayed, and it is a different thing
 *
 * The state switcher, Guest through VIP and Failed, is feature F04's first half
 * and it answers a question Framer's canvas cannot: what a Silver member sees
 * versus a VIP. There is no other way to check that without publishing and
 * signing in as five different people.
 *
 * What it shows is now "the component you are about to insert" rather than "the
 * component as you have configured it". That is a real reduction and it is the
 * cost of the paragraph above.
 */
export const BuilderTab: React.FC = () => {
  const { connection, settings } = useConnection();
  const siteTierList = useSiteTiers(connection?.siteId ?? null);
  const [componentId, setComponentId] = useState<CanvasComponentId>(DEFAULT_COMPONENT_ID);
  const [assetsList, setAssetsList] = useState<AssetList | null>(null);
  const [selectedAssetId, setSelectedAssetId] = useState<string>("");
  const [scaffolding, setScaffolding] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [failure, setFailure] = useState<{ title: string; message: string } | null>(null);
  const showToast = useToast();

  useEffect(() => {
    if (!connection?.siteId) return;
    let active = true;
    void fetchAssets(connection.siteId).then((result) => {
      if (active && result.kind === "ok") {
        setAssetsList(result.data);
      }
    });
    return () => {
      active = false;
    };
  }, [connection?.siteId]);

  const assetOptions = useMemo(() => {
    const list = assetsList?.assets ?? [];
    return [
      { value: "", label: "Default (configure in Framer)" },
      ...list.map((asset) => ({
        value: asset.id,
        label: `${asset.name} (${assetSummary(asset)})`,
      })),
    ];
  }, [assetsList]);

  const chosenAsset = useMemo(
    () => (componentId === "protected_download" ? assetsList?.assets.find((a) => a.id === selectedAssetId) ?? null : null),
    [assetsList, componentId, selectedAssetId]
  );

  /**
   * What the generator bakes into every deployed component.
   *
   * All five fields come from the connection and the settings document rather
   * than from the customizer, because all five are properties of the SITE. A
   * creator setting a login path per component is how two components end up
   * disagreeing about where the sign-in page is, which is a dead end a visitor
   * finds rather than the creator.
   *
   * `apiBaseUrl` goes through `deployBaseUrl`, which refuses to emit a
   * loopback address: a published site cannot reach the developer's machine,
   * and baking `127.0.0.1` in produces a membership that works in the panel
   * and silently fails everywhere else.
   */
  const deployContext = useMemo<DeployContext>(
    () => ({
      apiBaseUrl: deployBaseUrl(),
      siteKey: connection?.siteKey ?? "",
      afterLoginPath: settings?.auth.afterLoginPath ?? "",
      loginPath: settings?.auth.loginPath ?? "/login",
      afterLogoutPath: settings?.auth.afterLogoutPath ?? "/",
      signupPath: settings?.auth.signupPath ?? "",
      resetPath: settings?.auth.resetPath ?? "/reset-password",
      // The gate's Access Tier list is written from these. Conflict C9.
      tiers: siteTierList,
    }),
    [connection, settings, siteTierList]
  );

  /**
   * Create the pages a membership needs.
   *
   * Derived from the settings document, so the pages that appear are exactly
   * the ones the components already point at. Additive: a page whose path
   * already exists is kept, never replaced.
   */
  const handleCreatePages = useCallback(async () => {
    if (!settings) return;

    setScaffolding(true);
    setFailure(null);

    try {
      const outcome = await scaffoldMembershipPages(framer, membershipPages(settings.auth));

      if (!outcome.ok) {
        setFailure(outcome);
        return;
      }

      showToast({ tone: outcome.failed > 0 ? "error" : "success", message: scaffoldSummary(outcome) });

      // A page that Framer refused is worth keeping on screen. A toast saying
      // "1 failed" and nothing saying which would leave the creator to compare
      // the project against the settings by hand.
      const failed = outcome.results.filter((result) => result.status === "failed");

      if (failed.length > 0) {
        setFailure({
          title: "Some pages were not created",
          message: failed.map((result) => `${result.path}: ${result.reason}`).join(" "),
        });
      }
    } catch (error) {
      setFailure({
        title: "Could not create the pages",
        message:
          error instanceof Error ? error.message : "An unexpected error stopped page creation.",
      });
    } finally {
      setScaffolding(false);
    }
  }, [settings, showToast]);

  const entry = findComponent(componentId);

  /**
   * Task 1.5. Generate the component, write it, insert it.
   *
   * A finished action is a toast and a persistent problem is a banner, per the
   * UI kit's own convention, so a failure stays on screen until the creator
   * fixes it or succeeds. The toast copy is kept under the 45 character limit
   * the kit warns about.
   */
  const handleAddToCanvas = useCallback(async () => {
    setDeploying(true);
    setFailure(null);

    try {
      /*
        All three are inserted with their authored defaults and configured in
        Framer's own properties panel. The gate used to be the exception,
        carrying values from a customizer in this tab; see the header note for
        why it no longer is. One generator core, one deploy path, no special
        case.
      */
      const generated = generateForComponent(entry.id, deployContext, chosenAsset);

      const outcome = await deployCanvasComponent(framer, generated, {
        attributes: chosenAsset
          ? {
              controls: {
                assetId: chosenAsset.id,
                buttonText: `Download ${chosenAsset.name || "File"}`,
              },
            }
          : undefined,
      });

      if (outcome.ok) {
        showToast({
          tone: "success",
          message: `${entry.name} ${outcome.action === "created" ? "added" : "updated"}`,
        });
      } else {
        setFailure(outcome);
      }
    } catch (error) {
      // `generateMemberGateCode` throws only on a repo defect, and the deploy
      // path returns outcomes rather than throwing. Anything arriving here is
      // unexpected, so it is reported rather than swallowed.
      setFailure({
        title: "Could not add the component",
        message: error instanceof Error ? error.message : "An unexpected error stopped the insert.",
      });
    } finally {
      setDeploying(false);
    }
  }, [chosenAsset, deployContext, entry, showToast]);

  return (
    <MemberSessionProvider>
      <div className="tab-panel-body">
        <FieldRows>
          <FieldRow label="Component" htmlFor="builder-component" fill>
            <Select
              id="builder-component"
              value={componentId}
              options={COMPONENT_OPTIONS}
              onChange={setComponentId}
              fill
            />
          </FieldRow>

          {componentId === "protected_download" ? (
            <FieldRow
              label="Attach File"
              htmlFor="builder-asset"
              fill
              hint={
                assetsList && assetsList.assets.length > 0
                  ? "Pre-fills this button with your uploaded file."
                  : "Upload files in Manage > Files, or configure later on the canvas."
              }
            >
              <Select
                id="builder-asset"
                value={selectedAssetId}
                options={assetOptions}
                onChange={setSelectedAssetId}
                fill
              />
            </FieldRow>
          ) : null}
        </FieldRows>

        {/*
          Deploying while disconnected would bake an empty site key into the
          creator's project, and every request from that component would fail
          with a 400 that reads like a server problem. Saying so here is the
          only place a creator would look.
        */}
        {connection === null ? (
          <Banner
            tone="warning"
            title="Connect this project first"
            message="Components added now cannot reach your members until the project is connected."
          />
        ) : null}

        {/*
          The authored defaults, not a draft. The switcher varies the MEMBER's
          tier, which is what makes the preview worth having; the gate's own
          requirement is now set on the canvas.
        */}
        <PreviewStudio componentId={componentId} gateConfig={DEFAULT_MEMBER_GATE_CONFIG} />

        {/* {connection !== null && settings !== null ? (
          <section className="section-group">
            <h2 className="section-title">Membership pages</h2>

            <p className="builder-help">
              Creates the pages your membership needs, using the paths from
              Settings. Pages that already exist are kept.
            </p>

            <ul className="builder-page-list">
              {membershipPages(settings.auth).map((page) => (
                <li key={page.id} className="builder-page">
                  <span className="builder-page-path">{page.path}</span>
                  <span className="builder-page-purpose">{page.purpose}</span>
                </li>
              ))}
            </ul>

            <Button
              variant="secondary"
              size="md"
              className="fill"
              disabled={scaffolding}
              onClick={() => void handleCreatePages()}
            >
              <FileStack aria-hidden={true} />
              {scaffolding ? "Creating pages" : "Create membership pages"}
            </Button>
          </section>
        ) : null} */}

        {failure ? (
          <Banner tone="danger" title={failure.title} message={failure.message} />
        ) : null}

        {/*
          The tab's one and only `.primary-cta`, per PRD section 7.5.

          Live from task 1.5. It is still disabled for the fourteen components
          that are not authored yet: the generator has nothing to emit for them,
          and a button that reports a failure the creator cannot fix is worse
          than one that is plainly not ready.
        */}
        <div className="studio-cta">
          <Button
            variant="primary"
            size="md"
            className="fill"
            disabled={!entry.deployable || deploying}
            onClick={handleAddToCanvas}
          >
            <Plus aria-hidden={true} />
            {deploying ? "Adding" : "Add to canvas"}
          </Button>
          <p className="studio-cta-note">{ctaNote(entry, Boolean(chosenAsset))}</p>
        </div>
      </div>
    </MemberSessionProvider>
  );
};

/**
 * The line under the CTA.
 */
function ctaNote(entry: CanvasComponentEntry, hasAsset: boolean): string {
  if (!entry.deployable) return `${entry.name} arrives with task ${entry.task}.`;
  if (entry.id === "protected_download" && hasAsset) {
    return "Inserts Protected Download pre-configured for your chosen file.";
  }
  return `Inserts ${entry.name} with its defaults. Configure it in the Framer properties panel.`;
}

/**
 * The file to deploy for a picker entry, with its authored defaults.
 */
function generateForComponent(
  id: CanvasComponentId,
  context: DeployContext,
  asset?: SiteAsset | null
): GeneratedCanvasFile {
  switch (id) {
    case "member_auth":
      return generateMemberAuthCode(DEFAULT_MEMBER_AUTH_CONFIG, undefined, context);
    case "member_login":
    case "member_register":
    case "member_password_reset":
    case "member_otp_verify":
      return generateAuthScreenCode(id, AUTH_SCREEN_DEFAULTS[id], undefined, context);
    case "member_dashboard":
      return generateMemberDashboardCode(DEFAULT_MEMBER_DASHBOARD_CONFIG, undefined, context);
    case "onboarding_modal":
      return generateOnboardingModalCode(DEFAULT_ONBOARDING_MODAL_CONFIG, undefined, context);
    case "member_pricing":
      return generateMemberPricingCode(DEFAULT_MEMBER_PRICING_CONFIG, undefined, context);
    case "metered_paywall":
      return generateMeteredPaywallCode(DEFAULT_METERED_PAYWALL_CONFIG, undefined, context);
    case "protected_download":
      return generateProtectedDownloadCode(
        {
          ...DEFAULT_PROTECTED_DOWNLOAD_CONFIG,
          defaultAssetId: asset?.id ?? "",
          buttonText: asset?.name ? `Download ${asset.name}` : DEFAULT_PROTECTED_DOWNLOAD_CONFIG.buttonText,
        },
        undefined,
        context
      );
    case "bookmark_button":
      return generateBookmarkButtonCode(DEFAULT_BOOKMARK_BUTTON_CONFIG, undefined, context);
    case "bookmarks_tray":
      return generateBookmarksTrayCode(DEFAULT_BOOKMARKS_TRAY_CONFIG, undefined, context);
    default:
      return generateMemberGateCode(DEFAULT_MEMBER_GATE_CONFIG, undefined, context);
  }
}
