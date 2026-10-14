import React, { useEffect, useMemo, useState } from "react";
import {
  Check,
  ChevronDown,
  Copy,
  ExternalLink,
  Layers,
  Plus,
  Save,
  ShieldCheck,
  Sparkles,
  Trash2,
} from "lucide-react";
import { Banner, Button, FieldRow, FieldRows, IconButton, Select, TextField, Toggle } from "../ui";
import type { GatedPageFallbackAction, GatedPageRule, GatedPageTier } from "../../types/connection";
import { isSafeSitePath } from "../../services/siteSettingsService";
import { framer } from "framer-plugin";
import {
  deployCanvasComponent,
  generateMemberGateCode,
  getFramerProjectPages,
  type DeployContext,
  type FramerProjectPage,
} from "../../services";
import { DEFAULT_MEMBER_GATE_CONFIG } from "../../types/canvas";
import { useToast } from "../ui";
import { cn } from "../../utils/cn";

export interface PageLocksPanelProps {
  rules: GatedPageRule[];
  onChangeRules: (rules: GatedPageRule[]) => void;
  saving: boolean;
  onSave: () => void;
  deployContext: DeployContext;
  onNavigateToBuilder?: () => void;
  siteConnected?: boolean;
}

const TIER_OPTIONS: ReadonlyArray<{ value: GatedPageTier; label: string }> = [
  { value: "signed_in", label: "Any signed in member" },
  { value: "free_member", label: "Free member or higher" },
  { value: "tier_1", label: "Tier 1: Silver or higher" },
  { value: "tier_2", label: "Tier 2: Gold or higher" },
  { value: "vip", label: "VIP member only" },
];

const FALLBACK_OPTIONS: ReadonlyArray<{ value: GatedPageFallbackAction; label: string }> = [
  { value: "redirect", label: "Redirect visitor away" },
  { value: "blur", label: "Frosted blur teaser" },
  { value: "custom_card", label: "Members-only lock card" },
];

export const PageLocksPanel: React.FC<PageLocksPanelProps> = ({
  rules,
  onChangeRules,
  saving,
  onSave,
  deployContext,
  onNavigateToBuilder,
  siteConnected,
}) => {
  const showToast = useToast();
  const [deployingGate, setDeployingGate] = useState(false);
  const [copiedSnippet, setCopiedSnippet] = useState(false);
  const [projectPages, setProjectPages] = useState<FramerProjectPage[]>([]);
  const [customPathActive, setCustomPathActive] = useState<Record<number, boolean>>({});
  const [customRedirectActive, setCustomRedirectActive] = useState<Record<number, boolean>>({});
  const [expandedRules, setExpandedRules] = useState<Record<number, boolean>>({ 0: true });

  const shieldSnippet = `<script src="${deployContext.apiBaseUrl}/api/member/shield.js?site=${deployContext.siteKey || "YOUR_SITE_KEY"}"></script>`;

  const handleCopySnippet = () => {
    void navigator.clipboard.writeText(shieldSnippet);
    setCopiedSnippet(true);
    showToast({
      tone: "success",
      message: "Global Route Shield script copied to clipboard",
    });
    setTimeout(() => setCopiedSnippet(false), 2200);
  };

  const toggleRule = (index: number) => {
    setExpandedRules((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  useEffect(() => {
    let active = true;
    void getFramerProjectPages().then((pages) => {
      if (active) setProjectPages(pages);
    });
    return () => {
      active = false;
    };
  }, []);

  const pagePathSet = useMemo(() => new Set(projectPages.map((p) => p.path)), [projectPages]);

  const protectedPageOptions = useMemo(() => {
    const list: Array<{ value: string; label: string }> = projectPages.map((page) => ({
      value: page.path,
      label: `${page.name} (${page.path})`,
    }));

    list.push({
      value: "__custom__",
      label: "Custom path...",
    });

    return list;
  }, [projectPages]);

  const redirectPageOptions = useMemo(() => {
    const list: Array<{ value: string; label: string }> = projectPages.map((page) => ({
      value: page.path,
      label: `${page.name} (${page.path})`,
    }));

    list.push({
      value: "__custom__",
      label: "Custom destination...",
    });

    return list;
  }, [projectPages]);

  const handleToggle = (index: number, enabled: boolean) => {
    const next = [...rules];
    next[index] = { ...next[index], enabled };
    onChangeRules(next);
  };

  const handleUpdate = <K extends keyof GatedPageRule>(
    index: number,
    key: K,
    val: GatedPageRule[K]
  ) => {
    const next = [...rules];
    next[index] = { ...next[index], [key]: val };
    onChangeRules(next);
  };

  const handleRemove = (index: number) => {
    const next = rules.filter((_, i) => i !== index);
    setExpandedRules((prev) => {
      const nextExpanded: Record<number, boolean> = {};
      Object.keys(prev).forEach((keyStr) => {
        const k = Number(keyStr);
        if (k < index) nextExpanded[k] = prev[k];
        else if (k > index) nextExpanded[k - 1] = prev[k];
      });
      return nextExpanded;
    });
    setCustomPathActive((prev) => {
      const nextActive: Record<number, boolean> = {};
      Object.keys(prev).forEach((keyStr) => {
        const k = Number(keyStr);
        if (k < index) nextActive[k] = prev[k];
        else if (k > index) nextActive[k - 1] = prev[k];
      });
      return nextActive;
    });
    setCustomRedirectActive((prev) => {
      const nextActive: Record<number, boolean> = {};
      Object.keys(prev).forEach((keyStr) => {
        const k = Number(keyStr);
        if (k < index) nextActive[k] = prev[k];
        else if (k > index) nextActive[k - 1] = prev[k];
      });
      return nextActive;
    });
    onChangeRules(next);
  };

  const handleAdd = () => {
    const usedPaths = new Set(rules.map((r) => r.path));
    const unusedPage = projectPages.find(
      (p) =>
        !usedPaths.has(p.path) &&
        p.path !== "/" &&
        p.path !== "/login" &&
        p.path !== "/404" &&
        p.path !== "/reset-password"
    );
    const newPath = unusedPage ? unusedPage.path : `/private-${rules.length + 1}`;
    const next = [
      ...rules,
      {
        path: newPath,
        enabled: true,
        requiredTier: "signed_in" as GatedPageTier,
        fallbackAction: "redirect" as GatedPageFallbackAction,
        redirectPath: deployContext.loginPath || "/login",
      },
    ];
    const newIdx = rules.length;
    setExpandedRules((prev) => ({ ...prev, [newIdx]: true }));
    onChangeRules(next);
  };

  const handleDeployGate = async () => {
    setDeployingGate(true);
    try {
      const generated = generateMemberGateCode(DEFAULT_MEMBER_GATE_CONFIG, undefined, deployContext);
      const outcome = await deployCanvasComponent(framer, generated);
      if (outcome.ok) {
        showToast({
          tone: "success",
          message: "Member Gate added to canvas",
        });
      } else {
        showToast({
          tone: "error",
          message: outcome.message || "Could not deploy Member Gate",
        });
      }
    } catch (err) {
      showToast({
        tone: "error",
        message: err instanceof Error ? err.message : "Deployment failed",
      });
    } finally {
      setDeployingGate(false);
    }
  };

  const handleDeployGateForRule = async (rule: GatedPageRule) => {
    setDeployingGate(true);
    try {
      const config = {
        ...DEFAULT_MEMBER_GATE_CONFIG,
        requiredTier: rule.requiredTier,
        fallbackAction: rule.fallbackAction,
        redirectUrl:
          rule.fallbackAction === "redirect"
            ? (rule.redirectPath ?? deployContext.loginPath ?? "/login")
            : "",
      };
      const generated = generateMemberGateCode(config, undefined, deployContext);
      const outcome = await deployCanvasComponent(framer, generated);
      if (outcome.ok) {
        showToast({
          tone: "success",
          message: `Member Gate deployed for ${rule.path}`,
        });
      } else {
        showToast({
          tone: "error",
          message: outcome.message || "Could not deploy Member Gate",
        });
      }
    } catch (err) {
      showToast({
        tone: "error",
        message: err instanceof Error ? err.message : "Deployment failed",
      });
    } finally {
      setDeployingGate(false);
    }
  };

  const hasInvalidPath = rules.some(
    (rule) =>
      !isSafeSitePath(rule.path) ||
      (rule.fallbackAction === "redirect" && rule.redirectPath && !isSafeSitePath(rule.redirectPath))
  );

  return (
    <div className="page-locks-vault">
      {/* ------------------------------------------------------------------ */}
      {/* GLOBAL ROUTE SHIELD (RECOMMENDED ZERO-FOUC ENGINE)                 */}
      {/* ------------------------------------------------------------------ */}
      <section className="section-group">
        <div className="section-header-row">
          <div className="shield-section-title-wrap">
            <h2 className="section-title">Global Route Shield</h2>
            <span className="shield-badge-recommended">
              <ShieldCheck size={12} stroke="currentColor" aria-hidden={true} />
              <span>Recommended • Zero Flash</span>
            </span>
          </div>
          <span className="section-subtitle">
            Lock entire pages across your site with 0ms content flash and zero canvas setup.
          </span>
        </div>

        <div className="shield-code-card">
          <div className="shield-code-desc">
            <p>
              Paste this 1-line script once into Framer&apos;s <strong>Site Settings &gt; General &gt; Custom Code &gt; End of &lt;head&gt; tag</strong>.
              All active rules configured in the table below will automatically intercept unauthorized visitors before private content paints.
            </p>
          </div>

          <div className="shield-snippet-box">
            <code className="shield-snippet-text">{shieldSnippet}</code>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleCopySnippet}
              className="shield-copy-btn"
            >
              {copiedSnippet ? (
                <>
                  <Check size={13} stroke="currentColor" aria-hidden={true} />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy size={13} stroke="currentColor" aria-hidden={true} />
                  <span>Copy Script</span>
                </>
              )}
            </Button>
          </div>

          <div className="shield-quick-steps">
            <span className="shield-steps-title">Quick 3-step setup in Framer:</span>
            <ol className="shield-steps-list">
              <li>In Framer top bar, click <strong>Site Settings</strong>.</li>
              <li>Navigate to <strong>General &gt; Custom Code &gt; End of &lt;head&gt; tag</strong>.</li>
              <li>Paste this script and click <strong>Save &amp; Publish</strong>.</li>
            </ol>
          </div>
        </div>
      </section>

      <section className="section-group">
        <div className="section-header-row">
          <h2 className="section-title">Locked Routes &amp; Rules</h2>
          <span className="section-subtitle">
            Configure URL protection rules enforced globally by the Shield script and on canvas by MemberGate.
          </span>
        </div>

        {hasInvalidPath ? (
          <Banner
            tone="warning"
            title="Invalid page path"
            message="Every path must begin with a single slash (for example /dashboard) and remain on this site."
          />
        ) : null}

        <div className="page-rules-list">
          {rules.map((rule, index) => {
            const isInvalid = !isSafeSitePath(rule.path);
            const isCustomPath = customPathActive[index] ?? !pagePathSet.has(rule.path);
            const isExpanded = Boolean(expandedRules[index]);

            const currentRedirect = rule.redirectPath ?? deployContext.loginPath ?? "/login";
            const isCustomRedirect = customRedirectActive[index] ?? !pagePathSet.has(currentRedirect);
            const isInvalidRedirect =
              rule.fallbackAction === "redirect" && !isSafeSitePath(currentRedirect);

            return (
              <div
                key={`rule-${rule.path}-${index}`}
                className={cn("page-rule-card", isExpanded && "is-open")}
              >
                <div
                  className="page-rule-card-header"
                  role="button"
                  tabIndex={0}
                  onClick={() => toggleRule(index)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      toggleRule(index);
                    }
                  }}
                >
                  <div className="page-rule-info">
                    <span
                      className="page-rule-status-dot"
                      data-enabled={rule.enabled}
                      title={rule.enabled ? "Rule active" : "Rule disabled"}
                    />
                    <span className="page-rule-title">Rule {index + 1}</span>
                    <span className="page-rule-path-badge">{rule.path || "/"}</span>
                  </div>
                  <div
                    className="page-rule-header-actions"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Toggle
                      id={`page-lock-toggle-${index}`}
                      checked={rule.enabled}
                      onChange={(checked) => handleToggle(index, checked)}
                      label={`Enable lock for rule ${index + 1}`}
                      disabled={saving}
                    />
                    <IconButton
                      label="Remove page lock"
                      variant="ghost"
                      onClick={() => handleRemove(index)}
                      disabled={saving}
                    >
                      <Trash2 size={14} stroke="currentColor" aria-hidden={true} />
                    </IconButton>
                    <span className={cn("page-rule-chevron", isExpanded && "is-open")}>
                      <ChevronDown size={14} stroke="currentColor" aria-hidden={true} />
                    </span>
                  </div>
                </div>

                {isExpanded && (
                  <div className="page-rule-card-body">
                    <FieldRows>
                      <FieldRow label="Protected path" htmlFor={`rule-path-select-${index}`}>
                        <Select
                          id={`rule-path-select-${index}`}
                          value={isCustomPath ? "__custom__" : rule.path}
                          options={protectedPageOptions}
                          disabled={saving || !rule.enabled}
                          onChange={(val) => {
                            if (val === "__custom__") {
                              setCustomPathActive((prev) => ({ ...prev, [index]: true }));
                            } else {
                              setCustomPathActive((prev) => ({ ...prev, [index]: false }));
                              handleUpdate(index, "path", val);
                            }
                          }}
                        />
                      </FieldRow>

                      {isCustomPath ? (
                        <FieldRow label="Custom path" htmlFor={`rule-path-custom-${index}`}>
                          <TextField
                            id={`rule-path-custom-${index}`}
                            value={rule.path}
                            invalid={isInvalid}
                            disabled={saving || !rule.enabled}
                            placeholder="/dashboard"
                            onChange={(val) => handleUpdate(index, "path", val)}
                          />
                        </FieldRow>
                      ) : null}

                      <FieldRow label="Required tier" htmlFor={`rule-tier-${index}`}>
                        <Select
                          id={`rule-tier-${index}`}
                          value={rule.requiredTier}
                          options={TIER_OPTIONS}
                          disabled={saving || !rule.enabled}
                          onChange={(val) => handleUpdate(index, "requiredTier", val)}
                        />
                      </FieldRow>

                      <FieldRow label="Locked action" htmlFor={`rule-action-${index}`}>
                        <Select
                          id={`rule-action-${index}`}
                          value={rule.fallbackAction}
                          options={FALLBACK_OPTIONS}
                          disabled={saving || !rule.enabled}
                          onChange={(val) => handleUpdate(index, "fallbackAction", val)}
                        />
                      </FieldRow>

                      <span className="rule-field-caption">
                        {rule.fallbackAction === "redirect"
                          ? "Action: Automatically forwards unauthenticated visitors to another page before content renders."
                          : rule.fallbackAction === "blur"
                          ? "Action: Keeps visitors on the page URL but blurs content with a frosted lock card."
                          : "Action: Replaces page content with a members-only lock card."}
                      </span>

                      {rule.fallbackAction === "redirect" ? (
                        <>
                          <FieldRow label="Redirect to" htmlFor={`rule-redir-select-${index}`}>
                            <Select
                              id={`rule-redir-select-${index}`}
                              value={isCustomRedirect ? "__custom__" : currentRedirect}
                              options={redirectPageOptions}
                              disabled={saving || !rule.enabled}
                              onChange={(val) => {
                                if (val === "__custom__") {
                                  setCustomRedirectActive((prev) => ({ ...prev, [index]: true }));
                                } else {
                                  setCustomRedirectActive((prev) => ({ ...prev, [index]: false }));
                                  handleUpdate(index, "redirectPath", val);
                                }
                              }}
                            />
                          </FieldRow>

                          {isCustomRedirect ? (
                            <FieldRow label="Custom redirect" htmlFor={`rule-redir-custom-${index}`}>
                              <TextField
                                id={`rule-redir-custom-${index}`}
                                value={currentRedirect}
                                invalid={isInvalidRedirect}
                                disabled={saving || !rule.enabled}
                                placeholder="/login"
                                onChange={(val) => handleUpdate(index, "redirectPath", val)}
                              />
                            </FieldRow>
                          ) : null}

                          <span className="rule-field-caption">
                            Destination: Unauthenticated or logged-out visitors trying to view this page will be redirected here.
                          </span>
                        </>
                      ) : null}
                    </FieldRows>

                    <div className="page-rule-deploy-box">
                      <div className="page-rule-deploy-info">
                        <span className="page-rule-deploy-title">Apply to Canvas Page</span>
                        <p className="page-rule-deploy-text">
                          Framer enforces page locks via <code>MemberGate</code> on your canvas.
                        </p>
                      </div>
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={deployingGate || saving || !rule.enabled}
                        onClick={() => void handleDeployGateForRule(rule)}
                      >
                        <Sparkles size={13} stroke="currentColor" aria-hidden={true} />
                        <span>Deploy Gate</span>
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="page-locks-btn-row">
          <Button variant="secondary" onClick={handleAdd} disabled={saving}>
            <Plus size={14} stroke="currentColor" aria-hidden={true} />
            <span>Add locked page</span>
          </Button>
        </div>
      </section>

      <section className="section-group">
        <h2 className="section-title">On-Page Section Gating</h2>
        <div className="onpage-guide-card">
          <div className="onpage-guide-head">
            <span className="onpage-guide-badge">
              <Layers size={13} stroke="currentColor" aria-hidden={true} />
              <span>Zero-Setup • Native Frames</span>
            </span>
            <h3 className="onpage-guide-title">Lock Any Section, Stack or Grid</h3>
          </div>
          <p className="onpage-guide-text">
            Lock any native Framer Frame directly without creating components or dealing with empty slot dropdowns:
          </p>

          <ol className="onpage-guide-steps">
            <li>
              <strong>1. Normal Section:</strong> Design your Section, Stack, or Grid normally on canvas and drag &amp; drop any child layers inside.
            </li>
            <li>
              <strong>2. Attach Override:</strong> Select that Frame, scroll to the bottom of Framer&apos;s right sidebar to <strong>Code overrides</strong>.
            </li>
            <li>
              <strong>3. Select Gate:</strong> Choose File: <code>MemberGate</code> &rarr; Override: <code>withMemberGate</code> (or <code>withBlurLock</code> / <code>withHideLock</code>).
            </li>
            <li>
              <strong>4. Done!</strong> Anything inside that native Section automatically locks and unlocks for authenticated members.
            </li>
          </ol>

          <div className="onpage-guide-actions">
            <Button
              variant="secondary"
              onClick={handleDeployGate}
              disabled={deployingGate || saving}
            >
              <Sparkles size={14} stroke="currentColor" aria-hidden={true} />
              <span>{deployingGate ? "Updating..." : "Deploy / Update MemberGate Code"}</span>
            </Button>
            {onNavigateToBuilder ? (
              <Button variant="ghost" onClick={onNavigateToBuilder}>
                <span>Open in Builder</span>
                <ExternalLink size={12} stroke="currentColor" aria-hidden={true} />
              </Button>
            ) : null}
          </div>
        </div>
      </section>

      <div className="page-locks-footer">
        <button
          type="button"
          className="primary-cta"
          disabled={saving || hasInvalidPath || siteConnected === false}
          onClick={onSave}
        >
          <Save size={14} stroke="currentColor" aria-hidden={true} />
          <span>{saving ? "Saving..." : "Save page locks"}</span>
        </button>
        {siteConnected === false ? (
          <p className="settings-cta-note">Connect this project before saving page locks.</p>
        ) : hasInvalidPath ? (
          <p className="settings-cta-note">Fix the highlighted path before saving.</p>
        ) : null}
      </div>
    </div>
  );
};
