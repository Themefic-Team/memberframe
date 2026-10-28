import React, { useEffect, useMemo, useState } from "react";
import { Check, Copy, FileLock, Plus, Trash2 } from "lucide-react";
import {
  Badge,
  Banner,
  Button,
  ConfirmDialog,
  EmptyState,
  Field,
  Fields,
  Select,
  Sheet,
  TextField,
} from "../ui";
import type { GatedPageFallbackAction, GatedPageRule, GatedPageTier, SectionLockRule } from "../../types/connection";
import { isSafeSitePath } from "../../services/siteSettingsService";
import { FREE_TIER, type TierLadderEntry } from "../../types/member";
import {
  getFramerProjectPages,
  isCmsItemPath,
  pageOptionLabel,
  sortPagesByPath,
  type DeployContext,
  type FramerProjectPage,
} from "../../services";
import { useToast } from "../ui";
import { SectionLocksEditor } from "./SectionLocksEditor";
import { LockCard } from "./LockCard";
import { TierChecklist } from "./TierChecklist";
import { isOnlyChoice } from "../../services/tierChoice";
import { accessOptions, accessOptionsFor, accessValue, parseAccess } from "../../services/accessChoices";

export interface PageLocksPanelProps {
  rules: GatedPageRule[];
  /** Section locks, saved with the page locks. */
  sectionLocks: SectionLockRule[];
  saving: boolean;
  /** Saves both lists as given. Resolves true when saved. */
  onSave: (next: { gatedPages: GatedPageRule[]; sectionLocks: SectionLockRule[] }) => Promise<boolean>;
  deployContext: DeployContext;
  onNavigateToBuilder?: () => void;
  siteConnected?: boolean;
  /** The site's tiers, for the Required tier picker. Custom tiers included. */
  tiers?: ReadonlyArray<TierLadderEntry>;
}

/** The lock open in the sheet: its index, or null for a new one, and the edited copy. */
interface EditingLock {
  index: number | null;
  rule: GatedPageRule;
  customPath: boolean;
  customRedirect: boolean;
}

/**
 * Page locks and section locks. Each lock is a card; a click opens its form in
 * a `Sheet` (2026-10-25, the user's request; before, the form expanded inside
 * the card). The sheet's Save lock writes the list at once, as does a card's
 * toggle and a confirmed delete, so there is no Save locks button left to forget.
 */
export const PageLocksPanel: React.FC<PageLocksPanelProps> = ({
  rules,
  sectionLocks,
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
  const [editing, setEditing] = useState<EditingLock | null>(null);

  const shieldSnippet = `<script src="${deployContext.apiBaseUrl}/api/member/shield.js?site=${deployContext.siteKey || "YOUR_SITE_KEY"}"></script>`;
  const connected = siteConnected !== false;

  const handleCopySnippet = () => {
    void navigator.clipboard.writeText(shieldSnippet);
    setCopiedSnippet(true);
    showToast({ tone: "success", message: "Script copied" });
    setTimeout(() => setCopiedSnippet(false), 2200);
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

  // The same list section locks and the paywall use (services/accessChoices.ts).
  const pageAccessOptions = useMemo(() => accessOptions(tiers, { others: true }), [tiers]);

  const savePages = (gatedPages: GatedPageRule[]) => onSave({ gatedPages, sectionLocks });

  /** A card's toggle applies at once (PRD section 7.5). */
  const handleToggle = (index: number, enabled: boolean) =>
    void savePages(rules.map((rule, i) => (i === index ? { ...rule, enabled } : rule)));

  const openRule = (index: number) => {
    const rule = rules[index]!;
    const redirect = rule.redirectPath ?? deployContext.loginPath ?? "/login";
    setEditing({
      index,
      rule: { ...rule },
      customPath: !lockablePathSet.has(rule.path),
      customRedirect: !pagePathSet.has(redirect),
    });
  };

  const handleAdd = () => {
    const usedPaths = new Set(rules.map((r) => r.path));
    const unusedPage = lockablePages.find((p) => !usedPaths.has(p.path) && p.path !== "/");
    const redirect = deployContext.loginPath || "/login";
    setEditing({
      index: null,
      rule: {
        path: unusedPage ? unusedPage.path : `/private-${rules.length + 1}`,
        enabled: true,
        requiredTier: "signed_in" as GatedPageTier,
        fallbackAction: "redirect" as GatedPageFallbackAction,
        redirectPath: redirect,
      },
      customPath: !unusedPage,
      customRedirect: !pagePathSet.has(redirect),
    });
  };

  const patch = (next: Partial<EditingLock>) => setEditing((current) => (current ? { ...current, ...next } : current));
  const patchRule = <K extends keyof GatedPageRule>(key: K, val: GatedPageRule[K]) =>
    setEditing((current) => (current ? { ...current, rule: { ...current.rule, [key]: val } } : current));

  /** Who the page is for: the audience and the tier choice change together. */
  const handleAccess = (value: string) =>
    setEditing((current) => {
      if (!current) return current;
      const access = parseAccess(value, current.rule, tiers);
      const { audience: _old, ...rest } = current.rule;
      return {
        ...current,
        rule: access.audience === "others" ? { ...rest, ...access } : { ...rest, requiredTier: access.requiredTier },
      };
    });

  const submit = async () => {
    if (!editing) return;
    const next =
      editing.index === null
        ? [...rules, editing.rule]
        : rules.map((rule, i) => (i === editing.index ? editing.rule : rule));
    if (await savePages(next)) setEditing(null);
  };

  const remove = async (index: number) => {
    if (await savePages(rules.filter((_, i) => i !== index))) setEditing(null);
  };

  const hasInvalidPath = rules.some(
    (rule) => !isSafeSitePath(rule.path) || (rule.redirectPath && !isSafeSitePath(rule.redirectPath))
  );

  const renderSheet = (open: EditingLock) => {
    const { rule, index } = open;
    const redirect = rule.redirectPath ?? deployContext.loginPath ?? "/login";
    const pathError = isSafeSitePath(rule.path) ? undefined : "Start with a slash, like /dashboard.";
    const redirectError = isSafeSitePath(redirect) ? undefined : "Start with a slash, like /login.";
    const saved = index === null ? null : rules[index] ?? null;

    return (
      <Sheet
        title={saved ? saved.path || "/" : "New page lock"}
        description="Who can open the page, and where everyone else goes."
        icon={<FileLock aria-hidden={true} />}
        badge={saved ? <Badge tone={saved.enabled ? "success" : "neutral"}>{saved.enabled ? "On" : "Off"}</Badge> : undefined}
        onClose={saving ? undefined : () => setEditing(null)}
        footer={
          <>
            {index !== null ? (
              <Button variant="danger" size="md" disabled={saving} onClick={() => setRemovingIndex(index)}>
                <Trash2 aria-hidden={true} />
                Delete lock
              </Button>
            ) : null}
            <Button
              variant="primary"
              size="md"
              loading={saving}
              disabled={!connected || Boolean(pathError) || Boolean(redirectError)}
              onClick={() => void submit()}
            >
              {index === null ? "Add lock" : "Save lock"}
            </Button>
          </>
        }
      >
        {!connected ? (
          <Banner tone="warning" title="Not connected" message="Connect this project before saving locks." />
        ) : null}
        <Fields>
          <Field
            label="Protected path"
            htmlFor="page-lock-path"
            hint="Also locks the pages under it. Blog, every item locks the posts and leaves /blog open."
          >
            <Select
              id="page-lock-path"
              value={open.customPath ? "__custom__" : rule.path}
              options={protectedPageOptions}
              disabled={saving}
              onChange={(val) => {
                if (val === "__custom__") patch({ customPath: true });
                else {
                  patch({ customPath: false });
                  patchRule("path", val);
                }
              }}
            />
          </Field>

          {open.customPath ? (
            <Field label="Custom path" htmlFor="page-lock-path-custom" error={pathError}>
              <TextField
                id="page-lock-path-custom"
                value={rule.path}
                invalid={Boolean(pathError)}
                disabled={saving}
                placeholder="/dashboard"
                onChange={(val) => patchRule("path", val)}
                fill
              />
            </Field>
          ) : null}

          <Field label="Who can open it" htmlFor="page-lock-tier">
            <Select
              id="page-lock-tier"
              value={accessValue(rule)}
              options={accessOptionsFor(rule, pageAccessOptions)}
              disabled={saving}
              onChange={handleAccess}
            />
          </Field>

          {isOnlyChoice(rule.requiredTier) ? (
            <TierChecklist
              value={rule.requiredTier}
              tiers={tiers}
              idPrefix="page-lock-only"
              disabled={saving}
              excluding={rule.audience === "others"}
              onChange={(next) => patchRule("requiredTier", next)}
            />
          ) : null}

          <Field
            label="Redirect to"
            htmlFor="page-lock-redirect"
            hint="Where signed-out visitors go. Use /pricing to sell the plan."
          >
            <Select
              id="page-lock-redirect"
              value={open.customRedirect ? "__custom__" : redirect}
              options={redirectPageOptions}
              disabled={saving}
              onChange={(val) => {
                if (val === "__custom__") patch({ customRedirect: true });
                else {
                  patch({ customRedirect: false });
                  patchRule("redirectPath", val);
                }
              }}
            />
          </Field>

          {open.customRedirect ? (
            <Field label="Custom redirect" htmlFor="page-lock-redirect-custom" error={redirectError}>
              <TextField
                id="page-lock-redirect-custom"
                value={redirect}
                invalid={Boolean(redirectError)}
                disabled={saving}
                placeholder="/login"
                onChange={(val) => patchRule("redirectPath", val)}
                fill
              />
            </Field>
          ) : null}
        </Fields>
      </Sheet>
    );
  };

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
        {!connected ? (
          <Banner tone="warning" title="Not connected" message="Connect this project before saving locks." />
        ) : null}

        <div className="page-rules-list">
          {rules.map((rule, index) => (
            <LockCard
              key={index}
              title={`Rule ${index + 1}`}
              badge={rule.path || "/"}
              enabled={rule.enabled}
              toggleId={`page-lock-toggle-${index}`}
              toggleLabel={`Enable lock for rule ${index + 1}`}
              disabled={saving || !connected}
              onToggle={(checked) => handleToggle(index, checked)}
              onOpen={() => openRule(index)}
            />
          ))}
        </div>

        {rules.length === 0 ? (
          <EmptyState
            icon={<FileLock aria-hidden={true} />}
            title="No Page Locks Yet"
            description="Keep a page for members only. Everyone else is sent to another page."
            action={
              <Button variant="secondary" onClick={handleAdd} disabled={saving}>
                <Plus aria-hidden={true} />
                Add locked page
              </Button>
            }
          />
        ) : (
          <div className="page-locks-btn-row">
            <Button variant="secondary" onClick={handleAdd} disabled={saving}>
              <Plus aria-hidden={true} />
              <span>Add locked page</span>
            </Button>
          </div>
        )}
      </section>

      <SectionLocksEditor
        rules={sectionLocks}
        onSave={(next) => onSave({ gatedPages: rules, sectionLocks: next })}
        saving={saving}
        connected={connected}
        tiers={tiers}
      />

      {editing ? renderSheet(editing) : null}

      {removingIndex !== null && rules[removingIndex] ? (
        <ConfirmDialog
          title={`Delete the lock on ${rules[removingIndex]!.path || "/"}?`}
          message={<p>Anyone can open that page again once it is gone. The site updates at once.</p>}
          confirmLabel="Delete page lock"
          cancelLabel="Keep lock"
          busy={saving}
          onCancel={() => setRemovingIndex(null)}
          onConfirm={() => {
            const index = removingIndex;
            setRemovingIndex(null);
            void remove(index);
          }}
        />
      ) : null}
    </div>
  );
};
