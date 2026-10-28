import React, { useCallback, useEffect, useRef, useState } from "react";
import { framer } from "framer-plugin";
import { PluginShell } from "./components/shell";
import { ConnectionProvider } from "./components/ConnectionProvider";
import { ACCOUNT_VIEW, BuilderTab, ConnectTab, HomeTab, ManageTab, ReportsTab, SettingsTab } from "./components/tabs";
import type { ManageSegment } from "./components/tabs/ManageTab";
import type { SettingsView } from "./components/tabs/SettingsTab";
import { QuickGuide, quickGuideHidden } from "./components/QuickGuide";
import { useSetupProgress } from "./hooks/useSetupProgress";
import { SkeletonList, ToastProvider } from "./components/ui";
import { LicenseProvider } from "./components/account/LicenseProvider";
import { LicenseBanner } from "./components/account/LicenseGate";
import { AuthModal } from "./components/billing/AuthModal";
import { TrialStatusModal, type TrialModalStatus } from "./components/billing/TrialStatusModal";
import { TrialStickyBanner } from "./components/billing/TrialStickyBanner";
import { WatermarkNotice } from "./components/billing/WatermarkNotice";
import type { AccountView } from "./components/tabs/ConnectTab";
import type { ViewId } from "./components/tabs/tabs";
import { useConnection } from "./hooks/useConnection";
import { useLicense } from "./hooks/useLicense";
import { useSealGuard } from "./hooks/useSealGuard";
import { useActiveTab } from "./hooks/useActiveTab";
import { useFramerTheme } from "./hooks/useFramerTheme";
import { useScrollReveal } from "./hooks/useScrollReveal";

/** PRD section 7.1. Geometry is fixed by the shell standard. */
const PANEL_WIDTH = 360;
const PANEL_HEIGHT = 640;
/** The tab bar (framefic-ui-kit .tabs, 40px), the panel's top row since the plugin header went. */
const COLLAPSED_HEIGHT = 40;
/** A trial younger than this, met right after signing in, is "just started". */
const JUST_STARTED_MS = 10 * 60_000;

export const App: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  // The kit's slim scrollbars show while an area scrolls (kit.css).
  useScrollReveal();

  useEffect(() => {
    try {
      framer.showUI({
        position: "top right",
        width: PANEL_WIDTH,
        height: collapsed ? COLLAPSED_HEIGHT : PANEL_HEIGHT,
      });
    } catch {
      // Running in a standalone browser dev preview, outside Framer.
    }
  }, [collapsed]);

  // No close handler: Framer's own window bar closes the plugin, and the shell
  // no longer draws a second one. See PluginShell.

  const toggleCollapse = useCallback(() => setCollapsed((current) => !current), []);

  // Collapse lives in Framer's own window bar, beside its close button: the
  // plugin menu (`framer.setMenu`) is the only thing a plugin can put there.
  // Framer draws the menu button itself, and items are text only, so this is
  // a labelled menu item rather than our chevron icon. No permission needed.
  useEffect(() => {
    try {
      void framer
        .setMenu([
          {
            label: collapsed ? "Expand panel" : "Collapse panel",
            onAction: toggleCollapse,
          },
        ])
        .catch(() => {
          // Outside Framer there is no window bar to put a menu in.
        });
    } catch {
      // Same: a standalone browser dev preview has no Framer host.
    }
  }, [collapsed, toggleCollapse]);

  return (
    <ToastProvider>
      {/*
        The connection wraps the shell rather than sitting inside one tab,
        because three tabs read the same site id. Two copies of "which site is
        this" is how the Manage tab lists one site's members while the Settings
        tab writes another's.
      */}
      <ConnectionProvider>
        <LicenseProvider>
          <Panel collapsed={collapsed} onToggleCollapse={toggleCollapse} />
        </LicenseProvider>
      </ConnectionProvider>
    </ToastProvider>
  );
};

/**
 * The shell with Framefic's billing flow around it (F19, 19-pro-lock-and-trial.md),
 * as the BEAF plugin runs it:
 *
 *   signed out      Home shows and works; every other tab, the account icon,
 *                   and Home's shortcuts open the "You Get 7-Day Free Trial"
 *                   modal, which leads to sign up or sign in
 *   trial           the yellow countdown bar on top, the watermark notice in Builder
 *   ended/claimed   a modal only Upgrade or Log out can leave, over every tab but Profile
 *   signed in now   "You're all set!" once the trial has just started
 */
const Panel: React.FC<{ collapsed: boolean; onToggleCollapse: () => void }> = ({ collapsed, onToggleCollapse }) => {
  const [storedTab, setStoredTab] = useActiveTab();
  const { preference, setPreference } = useFramerTheme();
  const { state, disconnect } = useConnection();
  const { view, unlocked } = useLicense();
  // Locks pasted copies of MemberFrame components while the panel is open (27-instance-seal.md).
  useSealGuard();

  const signedOut = state.status === "disconnected";
  // Signed out, only Home is shown. The stored tab is kept, so signing in
  // returns the creator to where they were.
  const activeTab: ViewId = signedOut ? "home" : storedTab;

  const [accountView, setAccountView] = useState<AccountView>("profile");
  const [showPlansRequest, setShowPlansRequest] = useState(0);
  const [authModal, setAuthModal] = useState<{ open: boolean; mode: "register" | "login" }>({ open: false, mode: "register" });
  const [startedModal, setStartedModal] = useState(false);
  const justSignedIn = useRef(false);

  const openAuth = useCallback((mode: "register" | "login") => setAuthModal({ open: true, mode }), []);
  /** Every way to another view: signed out, anything but Home opens the trial modal instead. */
  const setActiveTab = useCallback(
    (next: ViewId) => {
      if (signedOut && next !== "home") {
        openAuth("register");
        return;
      }
      setStoredTab(next);
    },
    [openAuth, setStoredTab, signedOut]
  );

  // The view Manage and Settings open on. Home's Quick Start sets them; the
  // tab bar puts them back, so a tab chosen there opens as it always has.
  const [manageStart, setManageStart] = useState<ManageSegment>("members");
  const [settingsStart, setSettingsStart] = useState<SettingsView>("config");
  const selectTab = useCallback(
    (next: ViewId) => {
      setManageStart("members");
      setSettingsStart("config");
      setActiveTab(next);
    },
    [setActiveTab]
  );
  const openBuilder = useCallback(() => setActiveTab("builder"), [setActiveTab]);
  const openManageAt = useCallback(
    (segment: ManageSegment) => {
      setManageStart(segment);
      setActiveTab("manage");
    },
    [setActiveTab]
  );
  const openTiers = useCallback(() => openManageAt("tiers"), [openManageAt]);
  const openPayments = useCallback(() => openManageAt("payments"), [openManageAt]);
  const openPageLocks = useCallback(() => {
    setSettingsStart("locks");
    setActiveTab("settings");
  }, [setActiveTab]);
  const openConnect = useCallback(() => {
    setAccountView("profile");
    setActiveTab(ACCOUNT_VIEW);
  }, [setActiveTab]);
  /** Every Upgrade lands on Profile, Manage Subscription, with the plans open. */
  const openSubscription = useCallback(() => {
    setShowPlansRequest((count) => count + 1);
    setAccountView("subscription");
    setActiveTab(ACCOUNT_VIEW);
  }, [setActiveTab]);
  const closeAuth = useCallback(() => setAuthModal((current) => ({ ...current, open: false })), []);
  const onAuthenticated = useCallback(() => {
    justSignedIn.current = true;
  }, []);

  // The quick guide, after every sign in until "Don't show this again" is
  // ticked (product owner, 2026-10-27). Waits for "You're all set!" to close.
  const [guideOpen, setGuideOpen] = useState(false);
  const guideAfterStarted = useRef(false);

  // "You're all set!": the first license after signing in, when its trial is new.
  useEffect(() => {
    if (!justSignedIn.current || !view) return;
    justSignedIn.current = false;
    const showGuide = !quickGuideHidden();
    if (view.state === "trial" && view.startedAt && Date.now() - Date.parse(view.startedAt) < JUST_STARTED_MS) {
      setStartedModal(true);
      guideAfterStarted.current = showGuide;
    } else if (showGuide) {
      setGuideOpen(true);
    }
  }, [view]);

  // Checked while it can be seen: the Home tab's Setup guide row, or the guide.
  const setup = useSetupProgress(state.status === "connected" && (activeTab === "home" || guideOpen));
  const openGuide = useCallback(() => {
    setGuideOpen(true);
    setup.refresh();
  }, [setup.refresh]);

  const closeStartedModal = useCallback(() => {
    setStartedModal(false);
    if (guideAfterStarted.current) setGuideOpen(true);
    guideAfterStarted.current = false;
  }, []);
  const openSignInOptions = useCallback(() => {
    setSettingsStart("integration");
    setActiveTab("settings");
  }, [setActiveTab]);

  const lockedStatus: TrialModalStatus | null =
    state.status === "connected" && view && !unlocked && activeTab !== ACCOUNT_VIEW
      ? view.state === "trial_claimed_other_site"
        ? "trial_claimed_other_site"
        : view.plan && view.plan !== "trial"
          ? "plan_ended"
          : "expired"
      : null;

  return (
    <>
      <PluginShell
        activeTab={activeTab}
        onSelectTab={selectTab}
        collapsed={collapsed}
        onToggleCollapse={onToggleCollapse}
        onOpenAccount={openConnect}
        topBanner={<TrialStickyBanner onUpgrade={openSubscription} />}
        flush={activeTab === ACCOUNT_VIEW}
      >
        {activeTab === ACCOUNT_VIEW ? (
          <ConnectTab
            view={accountView}
            onChangeView={setAccountView}
            showPlansRequest={showPlansRequest}
            onOpenAuth={openAuth}
          />
        ) : (
          <>
            {state.status === "connected" && unlocked ? (
              <div className="license-banner-slot">
                <LicenseBanner />
              </div>
            ) : null}
            {activeTab === "builder" ? (
              <div className="license-banner-slot">
                <WatermarkNotice onUpgrade={openSubscription} />
              </div>
            ) : null}
            {/* Until the connection is known, a tab would flash "Connect this
                project first": show the shape of the tab instead. Home needs
                nothing from the server, so it renders at once. */}
            {state.status === "loading" && activeTab !== "home" ? (
              <div className="tab-panel-body">
                <SkeletonList label="Loading MemberFrame" count={4} variant="card" heading />
              </div>
            ) : (
              <TabContent
                activeTab={activeTab}
                onOpenBuilder={openBuilder}
                onOpenPageLocks={openPageLocks}
                onOpenTiers={openTiers}
                onOpenPayments={openPayments}
                manageStart={manageStart}
                settingsStart={settingsStart}
                onOpenConnect={openConnect}
                onOpenGuide={openGuide}
                setupDone={setup.known ? setup.count : null}
                themePreference={preference}
                onChangeThemePreference={setPreference}
              />
            )}
          </>
        )}
      </PluginShell>

      <AuthModal isOpen={authModal.open} initialMode={authModal.mode} onClose={closeAuth} onAuthenticated={onAuthenticated} />
      <TrialStatusModal
        status={startedModal ? "started" : lockedStatus}
        claimedProjectName={view?.claimedProjectName ?? null}
        onClose={closeStartedModal}
        onUpgrade={() => {
          setStartedModal(false);
          guideAfterStarted.current = false;
          openSubscription();
        }}
        onLogout={() => void disconnect()}
      />
      {/* Never over a lock or the trial modal: those must be answered first. */}
      {guideOpen && !startedModal && lockedStatus === null && state.status === "connected" ? (
        <QuickGuide
          done={setup.done}
          known={setup.known}
          onClose={() => setGuideOpen(false)}
          onOpenPages={openBuilder}
          onOpenTiers={openTiers}
          onOpenPayments={openPayments}
          onOpenSignIn={openSignInOptions}
          onOpenPageLocks={openPageLocks}
          onOpenDomains={openConnect}
        />
      ) : null}
    </>
  );
};

const TabContent: React.FC<{
  activeTab: ViewId;
  onOpenBuilder: () => void;
  onOpenPageLocks: () => void;
  onOpenTiers: () => void;
  onOpenPayments: () => void;
  manageStart: ManageSegment;
  settingsStart: SettingsView;
  onOpenConnect: () => void;
  onOpenGuide: () => void;
  setupDone: number | null;
  themePreference: ReturnType<typeof useFramerTheme>["preference"];
  onChangeThemePreference: ReturnType<typeof useFramerTheme>["setPreference"];
}> = (props) => (
  <>
    {props.activeTab === "home" ? (
      <HomeTab
        onOpenBuilder={props.onOpenBuilder}
        onOpenPageLocks={props.onOpenPageLocks}
        onOpenTiers={props.onOpenTiers}
        onOpenPayments={props.onOpenPayments}
        onOpenConnect={props.onOpenConnect}
        onOpenGuide={props.onOpenGuide}
        setupDone={props.setupDone}
      />
    ) : null}
    {props.activeTab === "builder" ? <BuilderTab /> : null}
    {props.activeTab === "manage" ? <ManageTab initialSegment={props.manageStart} /> : null}
    {props.activeTab === "settings" ? (
      <SettingsTab
        themePreference={props.themePreference}
        onChangeThemePreference={props.onChangeThemePreference}
        initialView={props.settingsStart}
      />
    ) : null}
    {props.activeTab === "reports" ? <ReportsTab /> : null}
  </>
);
