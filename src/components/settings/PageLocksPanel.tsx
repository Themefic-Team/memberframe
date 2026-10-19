import React, { useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, Copy, Plus, Save, Trash2 } from "lucide-react";
import {
  Banner,
  Button,
  ConfirmDialog,
  FieldRow,
  FieldRows,
  IconButton,
  Select,
  TextField,
  Toggle,
} from "../ui";
import type { GatedPageFallbackAction, GatedPageRule, GatedPageTier, SectionLockRule } from "../../types/connection";
import { isSafeSitePath } from "../../services/siteSettingsService";
import { FREE_TIER, type TierLadderEntry } from "../../types/member";
import {
  getFramerProjectPages,
  isCmsItemPath,
  pageOptionLabel,
  sectionLockNameProblem,
  sortPagesByPath,
  type DeployContext,
  type FramerProjectPage,
} from "../../services";
import { useToast } from "../ui";
import { SectionLocksEditor } from "./SectionLocksEditor";
import { cn } from "../../utils/cn";

export interface PageLocksPanelProps {
  rules: GatedPageRule[];
  onChangeRules: (rules: GatedPageRule[]) => void;
  /** Section locks, saved with the page locks by the same button. */
  sectionLocks: SectionLockRule[];
  onChangeSectionLocks: (rules: SectionLockRule[]) => void;
  saving: boolean;
  onSave: () => void;
  deployContext: DeployContext;
  onNavigateToBuilder?: () => void;
  siteConnected?: boolean;
  /** The site's tiers, for the Required tier picker. Custom tiers included. */
  tiers?: ReadonlyArray<TierLadderEntry>;
}

/**
 * "Any signed in member", then the site's own tiers by rank, custom ones
 * included (conflict C9). The highest rank reads "only", the rest "or higher".
 */
function tierOptions(tiers: ReadonlyArray<TierLadderEntry>): ReadonlyArray<{ value: GatedPageTier; label: string }> {
  const ordered = [...tiers].sort((a, b) => a.rank - b.rank);
  const top = ordered[ordered.length - 1]?.key;
  return [
    { value: "signed_in", label: "Any signed in member" },
    ...ordered.map((tier) => ({
      value: tier.key,
      label: tier.key === top ? `${tier.name} only` : `${tier.name} or higher`,
    })),
  ];
}

export const PageLocksPanel: React.FC<PageLocksPanelProps> = ({
  rules,
  onChangeRules,
  sectionLocks,
  onChangeSectionLocks,
  saving,
  onSave,
  deployContext,
  siteConnected,
  tiers = [FREE_TIER],
}) => {
  const showToast = useToast();
  const [copiedSnippet, setCopiedSnippet] = useState(false);
  /** The rule waiting on the delete popup. */
  const [removingIndex, setRemovingIndex] = useState<number | null>(null);
  const [projectPages, setProjectPages] = useState<FramerProjectPage[]>([]);
  const [customPathActive, setCustomPathActive] = useState<Record<number, boolean>>({});
  const [customRedirectActive, setCustomRedirectActive] = useState<Record<number, boolean>>({});
  const [expandedRules, setExpandedRules] = useState<Record<number, boolean>>({ 0: true });

  const shieldSnippet = `<script src="${deployContext.apiBaseUrl}/api/member/shield.js?site=${deployContext.siteKey || "YOUR_SITE_KEY"}"></script>`;

  const handleCopySnippet = () => {
    void navigator.clipboard.writeText(shieldSnippet);
    setCopiedSnippet(true);
    showToast({ tone: "success", message: "Script copied" });
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

  const sortedPages = useMemo(() => sortPagesByPath(projectPages), [projectPages]);
  const pagePathSet = useMemo(() => new Set(sortedPages.map((p) => p.path)), [sortedPages]);

  /*
    The sign in, sign up, reset, and 404 pages are left out of what can be
    locked: a locked sign in page sends visitors to itself. They stay
    reachable through Custom path, and they are where Redirect to points.
  */
  const lockablePages = useMemo(() => {
    const unlockable = new Set(["/login", "/signup", "/reset-password", "/404", deployContext.loginPath || "/login"]);
    return sortedPages.filter((page) => !unlockable.has(page.path));
  }, [sortedPages, deployContext.loginPath]);
  const lockablePathSet = useMemo(() => new Set(lockablePages.map((p) => p.path)), [lockablePages]);

  const protectedPageOptions = useMemo(
    () => [
      ...lockablePages.map((page) => ({ value: page.path, label: pageOptionLabel(page) })),
      { value: "__custom__", label: "Custom path" },
    ],
    [lockablePages]
  );

  // A CMS item page is a template, never a place to send someone.
  const redirectPageOptions = useMemo(
    () => [
      ...sortedPages
        .filter((page) => !isCmsItemPath(page.path))
        .map((page) => ({ value: page.path, label: pageOptionLabel(page) })),
      { value: "__custom__", label: "Custom path" },
    ],
    [sortedPages]
  );

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

  const hasInvalidPath = rules.some(
    (rule) => !isSafeSitePath(rule.path) || (rule.redirectPath && !isSafeSitePath(rule.redirectPath))
  );
  const hasInvalidSectionLock = sectionLocks.some((_, index) => sectionLockNameProblem(sectionLocks, index) !== null);

  return (
    <div className="page-locks-vault">
      <section className="section-group">
        <div className="section-header">
          <h2 className="section-title">Route Shield</h2>
          <p className="section-subtitle">
            Paste once in Site Settings, Custom Code, End of head, then publish. Page and section locks need it.
          </p>
        </div>

        <div className="shield-snippet-box">
          <code className="shield-snippet-text">{shieldSnippet}</code>
          <Button variant="secondary" size="sm" onClick={handleCopySnippet} className="shield-copy-btn">
            {copiedSnippet ? (
              <Check aria-hidden={true} />
            ) : (
              <Copy aria-hidden={true} />
            )}
            <span>{copiedSnippet ? "Copied" : "Copy script"}</span>
          </Button>
        </div>
      </section>

      <section className="section-group">
        <div className="section-header">
          <h2 className="section-title">Page Locks</h2>
          <p className="section-subtitle">Who can open a page. A path also locks every page under it.</p>
        </div>

        {hasInvalidPath ? (
          <Banner tone="warning" title="Check the paths" message="Each path starts with a slash, like /dashboard." />
        ) : null}

        <div className="page-rules-list">
          {rules.map((rule, index) => {
            const isInvalid = !isSafeSitePath(rule.path);
            const isCustomPath = customPathActive[index] ?? !lockablePathSet.has(rule.path);
            const isExpanded = Boolean(expandedRules[index]);

            const currentRedirect = rule.redirectPath ?? deployContext.loginPath ?? "/login";
            const isCustomRedirect = customRedirectActive[index] ?? !pagePathSet.has(currentRedirect);
            const isInvalidRedirect = !isSafeSitePath(currentRedirect);

            return (
              <div
                key={index}
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
                      onClick={() => setRemovingIndex(index)}
                      disabled={saving}
                    >
                      <Trash2 aria-hidden={true} />
                    </IconButton>
                    <span className={cn("page-rule-chevron", isExpanded && "is-open")}>
                      <ChevronDown aria-hidden={true} />
                    </span>
                  </div>
                </div>

                {isExpanded && (
                  <div className="page-rule-card-body">
                    <FieldRows>
                      <FieldRow
                        label="Protected path"
                        htmlFor={`rule-path-select-${index}`}
                        hint="Also locks the pages under it. Blog, every item locks the posts and leaves /blog open."
                      >
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
                          options={tierOptions(tiers)}
                          disabled={saving || !rule.enabled}
                          onChange={(val) => handleUpdate(index, "requiredTier", val)}
                        />
                      </FieldRow>

                      <>
                          <FieldRow
                            label="Redirect to"
                            htmlFor={`rule-redir-select-${index}`}
                            hint="Where signed-out visitors go. Use /pricing to sell the plan."
                          >
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
                      </>
                    </FieldRows>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="page-locks-btn-row">
          <Button variant="secondary" onClick={handleAdd} disabled={saving}>
            <Plus aria-hidden={true} />
            <span>Add locked page</span>
          </Button>
        </div>
      </section>

      <SectionLocksEditor rules={sectionLocks} onChange={onChangeSectionLocks} saving={saving} tiers={tiers} />

      <div className="page-locks-footer">
        <Button
          variant="primary"
          size="md"
          className="fill"
          disabled={saving || hasInvalidPath || hasInvalidSectionLock || siteConnected === false}
          onClick={onSave}
        >
          <Save aria-hidden={true} />
          <span>{saving ? "Saving" : "Save locks"}</span>
        </Button>
        {siteConnected === false ? (
          <p className="settings-cta-note">Connect this project before saving locks.</p>
        ) : hasInvalidPath ? (
          <p className="settings-cta-note">Fix the highlighted path before saving.</p>
        ) : hasInvalidSectionLock ? (
          <p className="settings-cta-note">Fix the highlighted lock name before saving.</p>
        ) : null}
      </div>

      {removingIndex !== null && rules[removingIndex] ? (
        <ConfirmDialog
          title={`Delete the lock on ${rules[removingIndex]!.path || "/"}?`}
          message={
            <>
              <p>Anyone can open that page again once it is gone.</p>
              <p>It is removed when you press Save locks, and nothing changes on your site before that.</p>
            </>
          }
          confirmLabel="Delete page lock"
          cancelLabel="Keep lock"
          onCancel={() => setRemovingIndex(null)}
          onConfirm={() => {
            handleRemove(removingIndex);
            setRemovingIndex(null);
          }}
        />
      ) : null}
    </div>
  );
};
