import React, { useMemo, useState } from "react";
import { ChevronDown, Layers, Plus, Trash2 } from "lucide-react";
import { Banner, Button, ConfirmDialog, EmptyState, FieldRow, FieldRows, IconButton, Select, TextField, Toggle } from "../ui";
import type { SectionLockRule } from "../../types/connection";
import type { TierLadderEntry } from "../../types/member";
import {
  MAX_SECTION_LOCKS,
  newSectionLock,
  parseWhoSees,
  sectionLockNameProblem,
  sectionLockOverrideNames,
  whoSeesOptions,
  whoSeesValue,
} from "../../services";
import { cn } from "../../utils/cn";
import { TierChecklist } from "./TierChecklist";
import { isOnlyChoice } from "../../services/tierChoice";
import { accessOptionsFor, type AccessOption } from "../../services/accessChoices";

export interface SectionLocksEditorProps {
  rules: SectionLockRule[];
  onChange: (rules: SectionLockRule[]) => void;
  saving: boolean;
  tiers: ReadonlyArray<TierLadderEntry>;
}

const LOCKED_ACTION_OPTIONS: ReadonlyArray<{ value: SectionLockRule["lockedAction"]; label: string }> = [
  { value: "hide", label: "Hidden" },
  { value: "blur", label: "Blurred, not clickable" },
];

/**
 * Section locks: rules the creator writes here and picks per layer in Framer.
 * Development doc: docs/development-docs/19-section-locks.md
 *
 * Save locks writes MemberFrameLocks into the project, one code override per rule,
 * named after it. In Framer the creator selects a layer and picks the rule in
 * the right sidebar, under Code overrides. The Route Shield enforces the rule
 * on the live site, so changing one needs no republish.
 */
export const SectionLocksEditor: React.FC<SectionLocksEditorProps> = ({ rules, onChange, saving, tiers }) => {
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  const options = useMemo(() => whoSeesOptions(tiers) as AccessOption[], [tiers]);
  const problems = rules.map((_, index) => sectionLockNameProblem(rules, index));
  const anyProblem = problems.some((problem) => problem !== null);

  /** The name each rule has in Framer's Code overrides list, for the valid ones. */
  const overrideNames = useMemo(() => {
    const valid = rules.filter((_, index) => sectionLockNameProblem(rules, index) === null);
    const names = sectionLockOverrideNames(valid);
    const byRule = new Map<SectionLockRule, string>();
    valid.forEach((rule, index) => byRule.set(rule, names[index] ?? ""));
    return byRule;
  }, [rules]);

  const update = (index: number, patch: Partial<SectionLockRule>) => {
    onChange(rules.map((rule, i) => (i === index ? { ...rule, ...patch } : rule)));
  };

  /** The lock waiting on the delete popup. */
  const [removingIndex, setRemovingIndex] = useState<number | null>(null);

  const remove = (index: number) => {
    onChange(rules.filter((_, i) => i !== index));
    setExpanded((prev) => {
      const next: Record<number, boolean> = {};
      for (const key of Object.keys(prev)) {
        const k = Number(key);
        if (k < index) next[k] = prev[k];
        else if (k > index) next[k - 1] = prev[k];
      }
      return next;
    });
  };

  const add = () => {
    setExpanded((prev) => ({ ...prev, [rules.length]: true }));
    onChange([...rules, newSectionLock(rules)]);
  };

  return (
    <section className="section-group">
      <div className="section-header">
        <h2 className="section-title">Section Locks</h2>
        <p className="section-subtitle">
          Hide or blur part of a page. In Framer, pick a lock under Code overrides, File MemberFrameLocks.
        </p>
      </div>

      {anyProblem ? (
        <Banner tone="warning" title="Check the lock names" message="Fix the highlighted name to save." />
      ) : null}

      <div className="page-rules-list">
        {rules.map((rule, index) => {
          const isOpen = Boolean(expanded[index]);
          const problem = problems[index];
          const overrideName = overrideNames.get(rule);
          const current = whoSeesValue(rule);
          const ruleOptions = accessOptionsFor(rule, options);

          return (
            <div key={index} className={cn("page-rule-card", isOpen && "is-open")}>
              <div
                className="page-rule-card-header"
                role="button"
                tabIndex={0}
                onClick={() => setExpanded((prev) => ({ ...prev, [index]: !prev[index] }))}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setExpanded((prev) => ({ ...prev, [index]: !prev[index] }));
                  }
                }}
              >
                <div className="page-rule-info">
                  <span className="page-rule-status-dot" data-enabled={rule.enabled} />
                  <span className="page-rule-title">{rule.name || "Unnamed lock"}</span>
                  {overrideName ? <span className="page-rule-path-badge">{overrideName}</span> : null}
                </div>
                <div className="page-rule-header-actions" onClick={(event) => event.stopPropagation()}>
                  <Toggle
                    id={`section-lock-toggle-${index}`}
                    checked={rule.enabled}
                    onChange={(checked) => update(index, { enabled: checked })}
                    label={`Enable ${rule.name || "this lock"}`}
                    disabled={saving}
                  />
                  <IconButton label="Remove section lock" variant="ghost" onClick={() => setRemovingIndex(index)} disabled={saving}>
                    <Trash2 aria-hidden={true} />
                  </IconButton>
                  <span className={cn("page-rule-chevron", isOpen && "is-open")}>
                    <ChevronDown aria-hidden={true} />
                  </span>
                </div>
              </div>

              {isOpen ? (
                <div className="page-rule-card-body">
                  <FieldRows>
                    <FieldRow
                      label="Name"
                      htmlFor={`section-lock-name-${index}`}
                      hint={
                        problem ??
                        `In Framer: Code overrides, File MemberFrameLocks, Override ${overrideName ?? ""}. Renaming it later means picking it again on each section.`
                      }
                    >
                      <TextField
                        id={`section-lock-name-${index}`}
                        value={rule.name}
                        invalid={problem !== null}
                        disabled={saving}
                        placeholder="Gold article"
                        onChange={(name) => update(index, { name })}
                      />
                    </FieldRow>

                    <FieldRow label="Who sees it" htmlFor={`section-lock-who-${index}`}>
                      <Select
                        id={`section-lock-who-${index}`}
                        value={current}
                        options={ruleOptions}
                        disabled={saving}
                        onChange={(value) => update(index, parseWhoSees(value, rule, tiers))}
                      />
                    </FieldRow>

                    {isOnlyChoice(rule.requiredTier) ? (
                      <TierChecklist
                        value={rule.requiredTier}
                        tiers={tiers}
                        idPrefix={`section-lock-only-${index}`}
                        disabled={saving}
                        excluding={rule.audience === "others"}
                        onChange={(next) => update(index, { requiredTier: next })}
                      />
                    ) : null}

                    <FieldRow
                      label="Everyone else"
                      htmlFor={`section-lock-action-${index}`}
                      hint={
                        rule.lockedAction === "blur"
                          ? "They see it blurred and cannot click it. It is still in the page code."
                          : "They do not see it, and the space closes up. It is still in the page code."
                      }
                    >
                      <Select
                        id={`section-lock-action-${index}`}
                        value={rule.lockedAction}
                        options={LOCKED_ACTION_OPTIONS}
                        disabled={saving}
                        onChange={(lockedAction) => update(index, { lockedAction })}
                      />
                    </FieldRow>
                  </FieldRows>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {rules.length === 0 ? (
        <EmptyState
          icon={<Layers aria-hidden={true} />}
          title="No Section Locks Yet"
          description="Hide or blur part of a page for people without access."
          action={
            <Button variant="secondary" onClick={add} disabled={saving}>
              <Plus aria-hidden={true} />
              Add section lock
            </Button>
          }
        />
      ) : (
        <div className="page-locks-btn-row">
          <Button variant="secondary" onClick={add} disabled={saving || rules.length >= MAX_SECTION_LOCKS}>
            <Plus aria-hidden={true} />
            <span>Add section lock</span>
          </Button>
        </div>
      )}

      {removingIndex !== null && rules[removingIndex] ? (
        <ConfirmDialog
          title={`Delete ${rules[removingIndex]!.name.trim() || "this section lock"}?`}
          message={
            <>
              <p>Sections tagged with its code override are no longer hidden from anyone.</p>
              <p>It is removed when you press Save locks, and nothing changes on your site before that.</p>
            </>
          }
          confirmLabel="Delete section lock"
          cancelLabel="Keep lock"
          onCancel={() => setRemovingIndex(null)}
          onConfirm={() => {
            remove(removingIndex);
            setRemovingIndex(null);
          }}
        />
      ) : null}
    </section>
  );
};
