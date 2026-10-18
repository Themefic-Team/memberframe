import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FileStack, Plus } from "lucide-react";
import { framer } from "framer-plugin";
import { Badge, Banner, Button, Checkbox, FieldRow, FieldRows, Select, useToast } from "../ui";
import { cn } from "../../utils/cn";
import {
  AUTH_SCREEN_DEFAULTS,
  ARTICLE_TAG_FILE_NAME,
  articleTagCode,
  deployCanvasComponent,
  writeCodeFile,
  generateAuthScreenCode,
  generateMemberAuthCode,
  generateMemberDashboardCode,
  generateMemberPricingCode,
  generateOnboardingModalCode,
  generateMeteredPaywallCode,
  generateProtectedDownloadCode,
  generateBookmarkButtonCode,
  generateBookmarksTrayCode,
  SCAFFOLD_COMPONENT_SPACING,
  findPageContentParent,
  membershipPages,
  normalizePagePath,
  scaffoldMembershipPages,
  scaffoldSummary,
  type DeployContext,
  type GeneratedCanvasFile,
  type MembershipPageSpec,
} from "../../services";

export const COMPONENT_LAYOUT_DEFAULTS: Record<
  string,
  {
    width: string;
    height: string;
    position: "relative" | "absolute";
    top?: string | null;
    centerX?: string | null;
  }
> = {
  member_auth: { width: "100%", height: "fit-content", position: "relative", top: null, centerX: null },
  member_login: { width: "100%", height: "fit-content", position: "relative", top: null, centerX: null },
  member_register: { width: "100%", height: "fit-content", position: "relative", top: null, centerX: null },
  member_password_reset: { width: "100%", height: "fit-content", position: "relative", top: null, centerX: null },
  member_otp_verify: { width: "100%", height: "fit-content", position: "relative", top: null, centerX: null },
  member_dashboard: { width: "100%", height: "fit-content", position: "relative", top: null, centerX: null },
  member_pricing: { width: "100%", height: "fit-content", position: "relative", top: null, centerX: null },
  onboarding_modal: { width: "480px", height: "fit-content", position: "relative", top: null, centerX: null },
  // Fixed, not 100%: dropped loose on the canvas, 100% of no parent collapses
  // the frame to a dot that cannot be dragged. Set it to Fill once it is in the article.
  metered_paywall: { width: "640px", height: "fit-content", position: "relative", top: null, centerX: null },
  protected_download: { width: "fit-content", height: "fit-content", position: "relative", top: null, centerX: null },
  // An icon button, not a section: Fit both ways, so it is as big as its icon
  // and label. At 100% it stretched across whatever stack it landed in.
  bookmark_button: { width: "fit-content", height: "fit-content", position: "relative", top: null, centerX: null },
  bookmarks_tray: { width: "fit-content", height: "fit-content", position: "relative", top: null, centerX: null },
};
import { assetSummary, fetchAssets, type AssetList, type SiteAsset } from "../../services/assetsService";
import { useConnection } from "../../hooks/useConnection";
import { useSiteTiers } from "../../hooks/useSiteTiers";
import { deployBaseUrl } from "../../config/backend";
import {
  DEFAULT_MEMBER_AUTH_CONFIG,
  DEFAULT_MEMBER_DASHBOARD_CONFIG,
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
 * Every component is inserted with its authored defaults and configured in
 * Framer's own properties panel, which is where a creator is already working.
 * The panel never holds a second copy of a value the sidebar also sets.
 *
 * Locking pages and sections is not done here: page locks and section locks
 * live in Settings, Page Locks, and the Route Shield enforces both.
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
      signupPath:
        settings?.auth.signupPath && settings?.auth.signupPath !== settings?.auth.loginPath
          ? settings.auth.signupPath
          : "/signup",
      resetPath: settings?.auth.resetPath ?? "/reset-password",
      // Tier lists in deployed components are written from these. Conflict C9.
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
  const pages = useMemo(
    () => membershipPages(settings?.auth, { includePricing: true, includeRegistration: true }),
    [settings?.auth]
  );

  const [existingPagePaths, setExistingPagePaths] = useState<Set<string>>(new Set());

  const checkExistingPages = useCallback(async () => {
    try {
      if (typeof framer?.getNodesWithType === "function") {
        const nodes = await framer.getNodesWithType("WebPageNode");
        if (Array.isArray(nodes)) {
          const found = new Set<string>();
          for (const node of nodes) {
            if (typeof node?.path === "string" && node.path.trim() !== "") {
              found.add(normalizePagePath(node.path));
            }
          }
          setExistingPagePaths(found);
        }
      }
    } catch {
      // Running outside Framer or in tests
    }
  }, []);

  useEffect(() => {
    void checkExistingPages();
  }, [checkExistingPages]);

  const [selectedPageIds, setSelectedPageIds] = useState<Set<string>>(() =>
    new Set(["login", "signup", "reset", "dashboard", "pricing"])
  );

  const handleTogglePage = useCallback((id: string) => {
    setSelectedPageIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const pendingPages = useMemo(
    () => pages.filter((page) => !existingPagePaths.has(normalizePagePath(page.path))),
    [pages, existingPagePaths]
  );

  const allPagesExist = pages.length > 0 && pendingPages.length === 0;

  const selectedSpecs = useMemo(
    () => pendingPages.filter((page) => selectedPageIds.has(page.id)),
    [pendingPages, selectedPageIds]
  );

  /**
   * Create selected pages with their corresponding canvas components automatically pre-installed.
   */
  const handleCreatePages = useCallback(async () => {
    if (selectedSpecs.length === 0) return;

    setScaffolding(true);
    setFailure(null);

    try {
      const outcome = await scaffoldMembershipPages(framer, selectedSpecs);

      if (!outcome.ok) {
        setFailure(outcome);
        return;
      }

      let componentsDeployed = 0;
      const componentDeployErrors: string[] = [];

      for (const result of outcome.results) {
        // ONLY deploy components for pages that were actually newly created in this run
        if (result.status === "created") {
          const spec = selectedSpecs.find((p) => p.id === result.id);
          if (spec && spec.component !== "none") {
            try {
              // The page's own children are its breakpoints. Parenting to the
              // page leaves the component floating beside the Desktop frame
              // and absent from the published site, so it goes inside it.
              const contentParent = await findPageContentParent(framer, result.nodeId);
              if (!contentParent) {
                componentDeployErrors.push(
                  `${spec.title}: the page has no Desktop frame yet. Add the component from Components.`
                );
                continue;
              }

              const generated = generateForComponent(spec.component, deployContext);
              const flowAttrs = COMPONENT_LAYOUT_DEFAULTS[spec.component] ?? {
                width: "100%",
                height: "fit-content",
                position: "relative",
                top: null,
                centerX: null,
              };
              // A stack or grid flows the child between the layout's header and
              // footer. A plain frame does not, so pin it to the top, centred.
              const flows = contentParent.layout === "stack" || contentParent.layout === "grid";
              const layoutAttrs = flows
                ? flowAttrs
                : { ...flowAttrs, position: "absolute" as const, top: "0px", centerX: "50%" };
              const deployResult = await deployCanvasComponent(framer, generated, {
                parentId: contentParent.id,
                // Clear a header the layout template lays over the page.
                attributes: { ...layoutAttrs, controls: { spacing: SCAFFOLD_COMPONENT_SPACING } },
              });
              if (deployResult.ok) {
                componentsDeployed++;
              } else {
                componentDeployErrors.push(`${spec.title}: ${deployResult.message}`);
              }
            } catch (err) {
              componentDeployErrors.push(
                `${spec.title}: ${err instanceof Error ? err.message : String(err)}`
              );
            }
          }
        }
      }

      const failedPages = outcome.results.filter((result) => result.status === "failed");

      if (failedPages.length > 0 || componentDeployErrors.length > 0) {
        const errors = [
          ...failedPages.map((r) => `${r.path}: ${r.reason}`),
          ...componentDeployErrors,
        ];
        setFailure({
          title: "Some pages or components had issues",
          message: errors.join(" "),
        });
      }

      // Re-query existing pages so UI marks newly created pages as already existing
      await checkExistingPages();

      let toastMessage: string;
      if (outcome.created === 0) {
        toastMessage = "This page already exists";
      } else if (componentsDeployed > 0) {
        toastMessage = `${outcome.created} pages & ${componentsDeployed} components added`;
      } else {
        toastMessage = scaffoldSummary(outcome);
      }

      showToast({
        tone: failedPages.length > 0 ? "error" : "success",
        message: toastMessage.slice(0, 45),
      });
    } catch (error) {
      setFailure({
        title: "Could not create the pages",
        message:
          error instanceof Error ? error.message : "An unexpected error stopped page creation.",
      });
    } finally {
      setScaffolding(false);
    }
  }, [checkExistingPages, deployContext, selectedSpecs, showToast]);

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
        Every component is inserted with its authored defaults and configured
        in Framer's own properties panel. One generator core, one deploy path,
        no special case.
      */
      const generated = generateForComponent(entry.id, deployContext, chosenAsset);
      const layoutAttrs = COMPONENT_LAYOUT_DEFAULTS[entry.id] ?? {
        width: "100%",
        height: "fit-content",
        position: "relative",
        top: null,
        centerX: null,
      };

      const outcome = await deployCanvasComponent(framer, generated, {
        attributes: {
          ...layoutAttrs,
          ...(chosenAsset
            ? {
                controls: {
                  assetId: chosenAsset.id,
                  buttonText: `Download ${chosenAsset.name || "File"}`,
                },
              }
            : {}),
        },
      });

      // The Soft Paywall's linked mode needs the PaywallArticle override for a
      // CMS post body, so it arrives with the component. Docs: 21-blog-paywalls.md
      const tagWritten =
        outcome.ok && entry.id === "metered_paywall"
          ? await writeCodeFile(framer, ARTICLE_TAG_FILE_NAME, articleTagCode())
          : null;

      if (tagWritten && !tagWritten.ok) {
        setFailure({ title: "Soft Paywall added, MemberArticle not written", message: tagWritten.message });
      } else if (outcome.ok) {
        showToast({
          tone: "success",
          message: `${entry.name} ${outcome.action === "created" ? "added" : "updated"}`,
        });
      } else {
        setFailure(outcome);
      }
    } catch (error) {
      // A generator throws only on a repo defect, and the deploy
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

        <PreviewStudio componentId={componentId} />

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

        <section className="builder-scaffold-section">
          <div className="builder-scaffold-header">
            <div className="builder-scaffold-title-row">
              <h2 className="builder-scaffold-heading">Predefined Pages</h2>
              <Badge tone={allPagesExist ? "success" : "neutral"}>
                {allPagesExist
                  ? "All pages created"
                  : `${selectedSpecs.length} of ${pendingPages.length} to create`}
              </Badge>
            </div>
          </div>

          <ul className="builder-page-list">
            {pages.map((page) => {
              const alreadyExists = existingPagePaths.has(normalizePagePath(page.path));
              const isSelected = selectedPageIds.has(page.id);
              const componentLabel =
                page.component === "member_auth"
                  ? "MemberAuth"
                  : page.component === "member_dashboard"
                    ? "MemberDashboard"
                    : page.component === "member_pricing"
                      ? "MemberPricing"
                      : null;

              const componentTone =
                page.component === "member_auth"
                  ? "brand"
                  : page.component === "member_dashboard"
                    ? "pro"
                    : "new";

              return (
                <li
                  key={page.id}
                  className={cn("builder-page", alreadyExists && "is-existing")}
                >
                  <div className="builder-page-left">
                    <Checkbox
                      id={`page-select-${page.id}`}
                      checked={alreadyExists ? true : isSelected}
                      disabled={alreadyExists}
                      onChange={() => handleTogglePage(page.id)}
                    >
                      <div className="builder-page-text">
                        <span className="builder-page-title">{page.title}</span>
                        <span className="builder-page-path">{page.path}</span>
                      </div>
                    </Checkbox>
                  </div>
                  {alreadyExists ? (
                    <Badge tone="neutral">Already exists</Badge>
                  ) : componentLabel ? (
                    <Badge tone={componentTone}>{componentLabel}</Badge>
                  ) : null}
                </li>
              );
            })}
          </ul>

          <Button
            variant="secondary"
            size="md"
            className="fill"
            disabled={scaffolding || allPagesExist || selectedSpecs.length === 0}
            onClick={() => void handleCreatePages()}
          >
            <FileStack aria-hidden={true} />
            {scaffolding
              ? "Creating pages..."
              : allPagesExist
                ? "This page already exists"
                : selectedSpecs.length > 0
                  ? `Create ${selectedSpecs.length} ${selectedSpecs.length === 1 ? "Page" : "Pages"}`
                  : "Create Pages"}
          </Button>
        </section>
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
    return "Adds the button for your chosen file.";
  }
  return "Then style and set it up in Framer's right sidebar.";
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
      // A planned component with no generator yet. The picker marks these as
      // not deployable, so this is reached only through a stale selection.
      throw new Error("This component cannot be added yet.");
  }
}
