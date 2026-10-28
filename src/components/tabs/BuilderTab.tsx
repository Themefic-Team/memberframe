import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FileStack, Plus } from "lucide-react";
import { framer } from "framer-plugin";
import { Badge, Banner, Button, Checkbox, Field, Fields, Select, useToast } from "../ui";
import { useLicense } from "../../hooks/useLicense";
import { canvasLicense } from "../../services/licenseService";
import { cn } from "../../utils/cn";
import {
  AUTH_SCREEN_DEFAULTS,
  deployCanvasComponent,
  writeCodeFile,
  SCAFFOLD_EXPORT_RETRY_DELAYS_MS,
  generateAuthScreenCode,
  generateMemberAuthCode,
  generateMemberDashboardCode,
  generateMemberPricingCode,
  generateMeteredPaywallCode,
  generateProtectedDownloadCode,
  generateBookmarkButtonCode,
  generateBookmarksTrayCode,
  SCAFFOLD_COMPONENT_SPACING,
  SCAFFOLD_COMPONENT_SPACING_BELOW_HEADER,
  SCAFFOLD_COMPONENT_SPACING_CENTERED,
  applyPageChrome,
  authPathsForPages,
  centerPageLayout,
  heightWithMargin,
  findPageChrome,
  type PageChrome,
  findPageContentParent,
  membershipPages,
  normalizePagePath,
  scaffoldMembershipPages,
  scaffoldSummary,
  type DeployContext,
  type GeneratedCanvasFile,
  type MembershipPageSpec,
  type ScaffoldComponent,
} from "../../services";

/**
 * The components that carry the license block, and so a seal from the server
 * (27-instance-seal.md). Every canvas component since 2026-10-25, the bookmark
 * pair included.
 */
const SEALED_COMPONENTS = new Set([
  "bookmark_button",
  "bookmarks_tray",
  "member_auth",
  "member_login",
  "member_register",
  "member_password_reset",
  "member_otp_verify",
  "member_dashboard",
  "member_pricing",
  "metered_paywall",
  "protected_download",
]);

/**
 * A fresh seal for one insert, or null when the component carries none.
 * Throws when the server cannot be reached: an unsealed component would lock
 * itself a moment later, so the insert stops and says why.
 */
async function sealForInsert(componentId: string, siteId: string | undefined): Promise<string | null> {
  if (!SEALED_COMPONENTS.has(componentId)) return null;
  if (!siteId) throw new Error("Sign in to MemberFrame before adding components.");
  const result = await requestSeal(siteId);
  if (result.kind === "ok") return result.data.seal;
  throw new Error(sealFailureMessage(result));
}

/**
 * Why the server gave no seal, in words the creator can act on. One message
 * for every case read "Could not reach MemberFrame" even when the server had
 * answered: a signed-out session, a project owned by another account, or the
 * per-minute limit (2026-10-27).
 */
function sealFailureMessage(result: Exclude<Awaited<ReturnType<typeof requestSeal>>, { kind: "ok" }>): string {
  switch (result.kind) {
    case "unauthorized":
      return "Your MemberFrame session ended. Sign in again from the Account icon, then add the component.";
    case "forbidden":
      return "This project belongs to another MemberFrame account. Sign in with the account that connected it.";
    case "rate_limited":
      return result.retryAfterSeconds === null
        ? "Too many components were added in a minute. Wait a moment and try again."
        : `Too many components were added in a minute. Try again in ${result.retryAfterSeconds} seconds.`;
    case "unavailable":
      if (result.status === 404) {
        return "MemberFrame does not know this project under the signed-in account. Sign out and sign in again in this project.";
      }
      return result.status === null
        ? "Could not reach MemberFrame. Check your connection and try again."
        : `MemberFrame could not add this component (server answered ${result.status}). Try again in a moment.`;
  }
}

/** How often the predefined page list is read again, as a fallback to Framer's own change events. */
const PAGE_LIST_REFRESH_MS = 4000;

/** The badge on each predefined page: the component that lands on it. */
const SCAFFOLD_COMPONENT_LABELS: Record<ScaffoldComponent, string | null> = {
  member_auth: "MemberAuth",
  member_login: "MemberLogin",
  member_register: "MemberRegister",
  member_password_reset: "MemberPasswordReset",
  member_dashboard: "MemberDashboard",
  member_pricing: "MemberPricing",
  none: null,
};

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
  /*
    Fixed width and fixed height by default (product owner, 2026-10-19), so
    what lands on the canvas is a known size the creator can see and change.
    Except the sign in cards, which fit their content since 2026-10-28 (product
    owner): a fixed frame did not grow when the creator raised the Spacing
    margin, so the margin ate the card's room and the card scrolled, which read
    as a bottom margin that did nothing. Fit grows the frame by card and margin.
  */
  member_auth: { width: "400px", height: "fit-content", position: "relative", top: null, centerX: null },
  member_login: { width: "400px", height: "fit-content", position: "relative", top: null, centerX: null },
  member_register: { width: "400px", height: "fit-content", position: "relative", top: null, centerX: null },
  member_password_reset: { width: "400px", height: "fit-content", position: "relative", top: null, centerX: null },
  member_otp_verify: { width: "400px", height: "fit-content", position: "relative", top: null, centerX: null },
  // Grows with its content (product owner, 2026-10-20): the profile form is
  // long, and a fixed height made the account card scroll inside the page.
  // 960 wide for the account area's sidebar (33-member-account.md); below
  // 720px of width the menu moves on top by itself.
  member_dashboard: { width: "960px", height: "fit-content", position: "relative", top: null, centerX: null },
  member_pricing: { width: "960px", height: "600px", position: "relative", top: null, centerX: null },
  // The one exception to a fixed height: the paywall wraps the article, so its
  // height is the article's. A fixed height would cut the article off or let
  // it run over whatever comes next. Width is fixed, since 100% of no parent
  // collapses a loose frame to a dot that cannot be dragged.
  metered_paywall: { width: "640px", height: "fit-content", position: "relative", top: null, centerX: null },
  protected_download: { width: "340px", height: "88px", position: "relative", top: null, centerX: null },
  // Icon buttons by default (no label), so a fixed 44 square.
  bookmark_button: { width: "44px", height: "44px", position: "relative", top: null, centerX: null },
  bookmarks_tray: { width: "44px", height: "44px", position: "relative", top: null, centerX: null },
};
import { fetchPayments } from "../../services/paymentsService";
import { saveSiteSettings } from "../../services/siteSettingsService";
import { useConnection } from "../../hooks/useConnection";
import { recordSeal } from "../../hooks/useSealGuard";
import { SEAL_CONTROL, requestSeal } from "../../services/instanceSealService";
import { useSiteTiers } from "../../hooks/useSiteTiers";
import { PAGE_CHROME_METHODS, framerPageChromeDeps } from "../../services/pageChromeFramer";
import { deployBaseUrl } from "../../config/backend";
import {
  DEFAULT_MEMBER_AUTH_CONFIG,
  DEFAULT_MEMBER_DASHBOARD_CONFIG,
  DEFAULT_MEMBER_PRICING_CONFIG,
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
  const { connection, settings, settingsVersion, applySettings } = useConnection();
  const siteTierList = useSiteTiers(connection?.siteId ?? null);
  const [componentId, setComponentId] = useState<CanvasComponentId>(DEFAULT_COMPONENT_ID);
  // The site's pricing page, from Payments, for the paywall's buttons.
  const [pricingPath, setPricingPath] = useState<string | undefined>(undefined);
  const [scaffolding, setScaffolding] = useState(false);
  /** What Create pages is doing now, on its button. Null when idle. */
  const [scaffoldStep, setScaffoldStep] = useState<string | null>(null);
  const [deploying, setDeploying] = useState(false);
  /** Add to canvas has waited long enough that Framer is compiling the file. */
  const [slowDeploy, setSlowDeploy] = useState(false);
  const [failure, setFailure] = useState<{ title: string; message: string } | null>(null);
  const showToast = useToast();

  useEffect(() => {
    if (!connection?.siteId) return;
    let active = true;
    void fetchPayments(connection.siteId).then((result) => {
      if (active && result.kind === "ok") setPricingPath(result.data.settings.pricingPath || undefined);
    });
    return () => {
      active = false;
    };
  }, [connection?.siteId]);

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
  const { view: licenseView } = useLicense();
  const deployContext = useMemo<DeployContext>(
    () => ({
      apiBaseUrl: deployBaseUrl(),
      siteKey: connection?.siteKey ?? "",
      afterLoginPath: settings?.auth.afterLoginPath ?? "",
      loginPath: settings?.auth.loginPath ?? "/login",
      afterLogoutPath: settings?.auth.afterLogoutPath ?? "/",
      passwordPolicy: settings?.auth.passwordPolicy,
      signupPath:
        settings?.auth.signupPath && settings?.auth.signupPath !== settings?.auth.loginPath
          ? settings.auth.signupPath
          : "/signup",
      resetPath: settings?.auth.resetPath ?? "/reset-password",
      pricingPath,
      // Tier lists in deployed components are written from these. Conflict C9.
      tiers: siteTierList,
      // F19: a new file shows the trial mark or the lock from its first render.
      license: canvasLicense(licenseView?.state),
    }),
    [connection, settings, siteTierList, licenseView, pricingPath]
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

  // Pages are added and deleted in Framer's own sidebar, which tells the panel
  // nothing directly. Read the list again whenever the canvas or the selection
  // changes (deleting a page does both), when Framer regains focus, and every
  // few seconds as a fallback, so a deleted page stops reading "Already exists".
  useEffect(() => {
    void checkExistingPages();
    const refresh = () => void checkExistingPages();
    const unsubscribes: Array<() => void> = [];
    try {
      unsubscribes.push(framer.subscribeToCanvasRoot(refresh));
      unsubscribes.push(framer.subscribeToSelection(refresh));
    } catch {
      // Outside Framer: the timer and focus still refresh.
    }
    const timer = window.setInterval(refresh, PAGE_LIST_REFRESH_MS);
    window.addEventListener("focus", refresh);
    return () => {
      for (const unsubscribe of unsubscribes) unsubscribe();
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
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
    setScaffoldStep("Creating pages...");
    setFailure(null);

    try {
      const outcome = await scaffoldMembershipPages(framer, selectedSpecs);

      if (!outcome.ok) {
        setFailure(outcome);
        return;
      }

      let componentsDeployed = 0;
      const componentDeployErrors: string[] = [];
      /** Components saved but not compiled in time: one line for all of them, not one each. */
      const stillCompiling: string[] = [];

      // Settings follow the pages (product owner, 2026-10-27): a new /signup
      // or /dashboard becomes the Sign up page or After sign in path. Saved
      // before the components are generated, so the paths baked into each
      // match Settings. A failed save only leaves Settings as they were.
      let placeContext = deployContext;
      let pathsSaved = false;
      const pathPatch = authPathsForPages(outcome.results, settings?.auth);
      if (Object.keys(pathPatch).length > 0) {
        placeContext = {
          ...deployContext,
          ...(pathPatch.loginPath ? { loginPath: pathPatch.loginPath } : {}),
          ...(pathPatch.signupPath ? { signupPath: pathPatch.signupPath } : {}),
          ...(pathPatch.resetPath ? { resetPath: pathPatch.resetPath } : {}),
          ...(pathPatch.afterLoginPath ? { afterLoginPath: pathPatch.afterLoginPath } : {}),
        };
        if (connection?.siteId) {
          const saved = await saveSiteSettings(connection.siteId, settingsVersion, { auth: pathPatch });
          if (saved.kind === "ok") {
            applySettings(saved.data.settings, saved.data.version);
            pathsSaved = true;
          }
        }
      }

      // Only pages created in this run get a component.
      const toPlace = outcome.results.flatMap((result) => {
        if (result.status !== "created") return [];
        const spec = selectedSpecs.find((p) => p.id === result.id);
        if (!spec || spec.component === "none") return [];
        try {
          return [{ result, spec, generated: generateForComponent(spec.component, placeContext) }];
        } catch (err) {
          componentDeployErrors.push(`${spec.title}: ${err instanceof Error ? err.message : String(err)}`);
          return [];
        }
      });

      // Every file first, then the inserts. Framer compiles each new file in
      // the background, so saving them all up front lets them compile side by
      // side while the first insert waits, instead of one wait per page.
      if (toPlace.length > 0) setScaffoldStep("Saving components...");
      for (const { generated } of toPlace) {
        await writeCodeFile(framer, generated.fileName, generated.code).catch(() => undefined);
      }

      // The site's own header and footer, borrowed from an existing page, so a
      // new page looks like the rest of the site rather than a bare frame.
      // Missing permission or no stacked page with chrome just means bare pages.
      const createdPageIds = new Set(
        outcome.results.flatMap((result) => (result.status === "created" ? [result.nodeId] : []))
      );
      let chrome: PageChrome | null = null;
      if (createdPageIds.size > 0 && framer.isAllowedTo(...PAGE_CHROME_METHODS)) {
        chrome = await findPageChrome(framerPageChromeDeps, createdPageIds).catch(() => null);
      }

      for (const [index, { result, spec, generated }] of toPlace.entries()) {
        setScaffoldStep(`Adding component ${index + 1} of ${toPlace.length}`);
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

          // Header first and footer last, so the component lands between them.
          const applied = chrome
            ? await applyPageChrome(framerPageChromeDeps, contentParent.id, chrome)
            : { header: false, footer: false, stacked: false };

          const flowAttrs = COMPONENT_LAYOUT_DEFAULTS[spec.component] ?? {
            width: "100%",
            height: "fit-content",
            position: "relative",
            top: null,
            centerX: null,
          };
          // No site layout to follow (an empty project, or a site whose pages
          // have no header and footer): the page becomes a centring stack, so
          // the component sits in the middle of every breakpoint.
          const centered =
            !applied.stacked &&
            contentParent.layout !== "stack" &&
            contentParent.layout !== "grid" &&
            (await centerPageLayout(framerPageChromeDeps, contentParent.id));
          // A stack or grid flows the child between the layout's header and
          // footer. A plain frame does not, so pin it to the top, centred.
          const flows =
            centered || applied.stacked || contentParent.layout === "stack" || contentParent.layout === "grid";
          const layoutAttrs = flows
            ? flowAttrs
            : { ...flowAttrs, position: "absolute" as const, top: "0px", centerX: "50%" };
          // A header in the stack already pushes the component down. One laid
          // over the page (absolute or fixed) does not, so keep the larger gap.
          const headerInFlow =
            applied.header && chrome?.header?.position !== "absolute" && chrome?.header?.position !== "fixed";
          const spacing = centered
            ? SCAFFOLD_COMPONENT_SPACING_CENTERED
            : headerInFlow
              ? SCAFFOLD_COMPONENT_SPACING_BELOW_HEADER
              : SCAFFOLD_COMPONENT_SPACING;
          const seal = await sealForInsert(spec.component, connection?.siteId);
          const deployResult = await deployCanvasComponent(framer, generated, {
            parentId: contentParent.id,
            ...(flows ? { index: applied.header ? 1 : 0 } : {}),
            exportRetryDelaysMs: SCAFFOLD_EXPORT_RETRY_DELAYS_MS,
            attributes: {
              ...layoutAttrs,
              // The margin is drawn inside the frame, so the frame grows by it.
              height: heightWithMargin(layoutAttrs.height, spacing.margin),
              controls: { spacing, ...(seal ? { [SEAL_CONTROL]: seal } : {}) },
            },
          });
          if (deployResult.ok) {
            if (seal) await recordSeal(seal, deployResult.nodeId);
            componentsDeployed++;
          } else if (deployResult.reason === "no_component_export" && !deployResult.detail) {
            stillCompiling.push(`${generated.fileName} on ${spec.path}`);
          } else {
            componentDeployErrors.push(`${spec.title}: ${deployResult.message}`);
          }
        } catch (err) {
          componentDeployErrors.push(
            `${spec.title}: ${err instanceof Error ? err.message : String(err)}`
          );
        }
      }

      const failedPages = outcome.results.filter((result) => result.status === "failed");

      if (failedPages.length > 0 || componentDeployErrors.length > 0 || stillCompiling.length > 0) {
        const errors = [
          ...failedPages.map((r) => `${r.path}: ${r.reason}`),
          ...componentDeployErrors,
          ...(stillCompiling.length > 0
            ? [
                `Framer is still compiling ${stillCompiling.join(", ")}. Once it finishes, drag each onto its page from Assets, Code.`,
              ]
            : []),
        ];
        setFailure({
          title:
            failedPages.length === 0 && componentDeployErrors.length === 0
              ? "Pages created, some components not placed"
              : "Some pages or components had issues",
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
      if (pathsSaved) showToast({ tone: "success", message: "Page paths saved in Settings" });
    } catch (error) {
      setFailure({
        title: "Could not create the pages",
        message:
          error instanceof Error ? error.message : "An unexpected error stopped page creation.",
      });
    } finally {
      setScaffolding(false);
      setScaffoldStep(null);
    }
  }, [applySettings, checkExistingPages, connection?.siteId, deployContext, selectedSpecs, settings?.auth, settingsVersion, showToast]);

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
    setSlowDeploy(false);
    setFailure(null);
    // Past a few seconds Framer is compiling the file: say so, so the wait does not read as a freeze.
    const slowTimer = window.setTimeout(() => setSlowDeploy(true), 4000);

    try {
      /*
        Every component is inserted with its authored defaults and configured
        in Framer's own properties panel. One generator core, one deploy path,
        no special case.
      */
      const generated = generateForComponent(entry.id, deployContext);
      const layoutAttrs = COMPONENT_LAYOUT_DEFAULTS[entry.id] ?? {
        width: "100%",
        height: "fit-content",
        position: "relative",
        top: null,
        centerX: null,
      };

      const seal = await sealForInsert(entry.id, connection?.siteId);
      const controls: Record<string, unknown> = {
        ...(seal ? { [SEAL_CONTROL]: seal } : {}),
      };
      // The longer wait: in a new project Framer's first compile of a file
      // (its packages fetched too) runs past the 15 second default.
      const outcome = await deployCanvasComponent(framer, generated, {
        exportRetryDelaysMs: SCAFFOLD_EXPORT_RETRY_DELAYS_MS,
        attributes: {
          ...layoutAttrs,
          ...(Object.keys(controls).length > 0 ? { controls } : {}),
        },
      });
      if (outcome.ok && seal) await recordSeal(seal, outcome.nodeId);

      // The Soft Paywall finds its article itself (21-blog-paywalls.md 8), so
      // no MemberArticle override file is written any more.
      if (outcome.ok) {
        showToast({
          tone: "success",
          message: `${entry.name} ${outcome.action === "created" ? "added" : "updated"}`,
        });
      } else {
        setFailure(outcome);
      }
    } catch (error) {
      // The seal request throws when MemberFrame cannot be reached, with a
      // message for the creator. Otherwise a generator throws only on a repo
      // defect, and the deploy path returns outcomes rather than throwing.
      setFailure({
        title: "Could not add the component",
        message: error instanceof Error ? error.message : "An unexpected error stopped the insert.",
      });
    } finally {
      window.clearTimeout(slowTimer);
      setDeploying(false);
      setSlowDeploy(false);
    }
  }, [connection?.siteId, deployContext, entry, showToast]);

  return (
    <MemberSessionProvider>
      <div className="tab-panel-body">
        <Fields>
          <Field label="Component" htmlFor="builder-component">
            <Select
              id="builder-component"
              value={componentId}
              options={COMPONENT_OPTIONS}
              onChange={(next) => {
                setComponentId(next);
                // A banner about the last component says nothing about this one.
                setFailure(null);
              }}
              fill
            />
          </Field>

        </Fields>

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
            {deploying ? (slowDeploy ? "Framer is compiling..." : "Adding") : "Add to canvas"}
          </Button>
          <p className="studio-cta-note">{ctaNote(entry)}</p>
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
              const componentLabel = SCAFFOLD_COMPONENT_LABELS[page.component];
              const componentTone =
                page.component === "member_dashboard"
                  ? "pro"
                  : page.component === "member_pricing"
                    ? "new"
                    : "brand";

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
                      fill
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
              ? (scaffoldStep ?? "Creating pages...")
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
function ctaNote(entry: CanvasComponentEntry): string {
  if (!entry.deployable) return `${entry.name} arrives with task ${entry.task}.`;
  if (entry.id === "protected_download") return "Then upload the file in Framer's right sidebar.";
  return "Then style and set it up in Framer's right sidebar.";
}

/**
 * The file to deploy for a picker entry, with its authored defaults.
 */
function generateForComponent(id: CanvasComponentId, context: DeployContext): GeneratedCanvasFile {
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
    case "member_pricing":
      return generateMemberPricingCode(DEFAULT_MEMBER_PRICING_CONFIG, undefined, context);
    case "metered_paywall":
      return generateMeteredPaywallCode(DEFAULT_METERED_PAYWALL_CONFIG, undefined, context);
    case "protected_download":
      return generateProtectedDownloadCode(DEFAULT_PROTECTED_DOWNLOAD_CONFIG, undefined, context);
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
