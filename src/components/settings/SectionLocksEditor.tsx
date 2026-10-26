import React, { useMemo, useState } from "react";
import { Layers, Plus, SquareDashed, Trash2 } from "lucide-react";
import { Badge, Banner, Button, ConfirmDialog, EmptyState, Field, Fields, Select, Sheet, TextField } from "../ui";
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
import { TierChecklist } from "./TierChecklist";
import { LockCard } from "./LockCard";
import { isOnlyChoice } from "../../services/tierChoice";
import { accessOptionsFor, type AccessOption } from "../../services/accessChoices";

export interface SectionLocksEditorProps {
  rules: SectionLockRule[];
  /** Saves the list as given, with the page locks. Resolves true when saved. */
  onSave: (rules: SectionLockRule[]) => Promise<boolean>;
  saving: boolean;
  connected: boolean;
  tiers: ReadonlyArray<TierLadderEntry>;
}

const LOCKED_ACTION_OPTIONS: ReadonlyArray<{ value: SectionLockRule["lockedAction"]; label: string }> = [
  { value: "hide", label: "Hidden" },
  { value: "blur", label: "Blurred, not clickable" },
];

/** The override name a rule gets in a list, or undefined while its name has a problem. */
function overrideNameIn(rules: ReadonlyArray<SectionLockRule>, index: number): string | undefined {
  if (sectionLockNameProblem(rules, index) !== null) return undefined;
  const valid = rules.filter((_, i) => sectionLockNameProblem(rules, i) === null);
  return sectionLockOverrideNames(valid)[valid.indexOf(rules[index]!)];
}

/**
 * Section locks: rules the creator writes here and picks per layer in Framer.
 * Development doc: docs/development-docs/19-section-locks.md
 *
 * Each lock is a card; a click opens its form in a `Sheet` (2026-10-25). Its
 * Save lock, a card's toggle, and a confirmed delete save at once, and write
 * MemberFrameLocks into the project, one code override per rule, named after
 * it. In Framer the creator selects a layer and picks the rule in the right
 * sidebar, under Code overrides. The Route Shield enforces the rule on the
 * live site, so changing one needs no republish.
 */
export const SectionLocksEditor: React.FC<SectionLocksEditorProps> = ({ rules, onSave, saving, connected, tiers }) => {
  /** The lock open in the sheet: its index, or null for a new one, and the edited copy. */
  const [editing, setEditing] = useState<{ index: number | null; rule: SectionLockRule } | null>(null);
  /** The lock waiting on the delete popup. */
  const [removingIndex, setRemovingIndex] = useState<number | null>(null);

  const options = useMemo(() => whoSeesOptions(tiers) as AccessOption[], [tiers]);
  const anyProblem = rules.some((_, index) => sectionLockNameProblem(rules, index) !== null);

  /** The list as it would be saved, with the open sheet's edit in it. */
  const nextList = (open: { index: number | null; rule: SectionLockRule }) =>
    open.index === null ? [...rules, open.rule] : rules.map((rule, i) => (i === open.index ? open.rule : rule));

  const update = (patch: Partial<SectionLockRule>) =>
    setEditing((current) => (current ? { ...current, rule: { ...current.rule, ...patch } } : current));

  const add = () => setEditing({ index: null, rule: newSectionLock(rules) });

  const submit = async () => {
    if (!editing) return;
    if (await onSave(nextList(editing))) setEditing(null);
  };

  const remove = async (index: number) => {
    if (await onSave(rules.filter((_, i) => i !== index))) setEditing(null);
  };

  const renderSheet = (open: { index: number | null; rule: SectionLockRule }) => {
    const { index, rule } = open;
    const list = nextList(open);
    const position = index ?? list.length - 1;
    const problem = sectionLockNameProblem(list, position);
    const overrideName = overrideNameIn(list, position);
    const saved = index === null ? null : rules[index] ?? null;

    return (
      <Sheet
        title={saved ? saved.name || "Unnamed lock" : "New section lock"}
        description="Who sees the section, and what everyone else gets."
        icon={<SquareDashed aria-hidden={true} />}
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
              disabled={!connected || problem !== null}
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
            label="Name"
            htmlFor="section-lock-name"
            error={problem ?? undefined}
            hint={`In Framer: Code overrides, File MemberFrameLocks, Override ${overrideName ?? ""}. Renaming it later means picking it again on each section.`}
          >
            <TextField
              id="section-lock-name"
              value={rule.name}
              invalid={problem !== null}
              disabled={saving}
              placeholder="Gold article"
              onChange={(name) => update({ name })}
              fill
            />
          </Field>

          <Field label="Who sees it" htmlFor="section-lock-who">
            <Select
              id="section-lock-who"
              value={whoSeesValue(rule)}
              options={accessOptionsFor(rule, options)}
              disabled={saving}
              onChange={(value) => update(parseWhoSees(value, rule, tiers))}
            />
          </Field>

          {isOnlyChoice(rule.requiredTier) ? (
            <TierChecklist
              value={rule.requiredTier}
              tiers={tiers}
              idPrefix="section-lock-only"
              disabled={saving}
              excluding={rule.audience === "others"}
              onChange={(next) => update({ requiredTier: next })}
            />
          ) : null}

          <Field
            label="Everyone else"
            htmlFor="section-lock-action"
            hint={
              rule.lockedAction === "blur"
                ? "They see it blurred and cannot click it. It is still in the page code."
                : "They do not see it, and the space closes up. It is still in the page code."
            }
          >
            <Select
              id="section-lock-action"
              value={rule.lockedAction}
              options={LOCKED_ACTION_OPTIONS}
              disabled={saving}
              onChange={(lockedAction) => update({ lockedAction })}
            />
          </Field>
        </Fields>
      </Sheet>
    );
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
        <Banner tone="warning" title="Check the lock names" message="Open the lock and fix its name to save." />
      ) : null}

      <div className="page-rules-list">
        {rules.map((rule, index) => (
          <LockCard
            key={index}
            title={rule.name || "Unnamed lock"}
            badge={overrideNameIn(rules, index)}
            enabled={rule.enabled}
            toggleId={`section-lock-toggle-${index}`}
            toggleLabel={`Enable ${rule.name || "this lock"}`}
            disabled={saving || !connected}
            // A card's toggle applies at once (PRD section 7.5).
            onToggle={(enabled) => void onSave(rules.map((entry, i) => (i === index ? { ...entry, enabled } : entry)))}
            onOpen={() => setEditing({ index, rule: { ...rule } })}
          />
        ))}
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

      {editing ? renderSheet(editing) : null}

      {removingIndex !== null && rules[removingIndex] ? (
        <ConfirmDialog
          title={`Delete ${rules[removingIndex]!.name.trim() || "this section lock"}?`}
          message={<p>Sections tagged with its code override are no longer hidden from anyone. The site updates at once.</p>}
          confirmLabel="Delete section lock"
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
    </section>
  );
};
