import React from "react";
import { Check } from "lucide-react";
import { cn } from "../../utils/cn";
import { onlyKeys, onlyValue } from "../../services/tierChoice";

export interface TierChecklistProps {
  /** The rule's "only:a,b" choice. */
  value: string;
  onChange: (next: string) => void;
  tiers: ReadonlyArray<{ key: string; name: string; rank: number }>;
  idPrefix: string;
  disabled?: boolean;
  /** "Everyone except chosen tiers": the ticked tiers are the ones kept out. */
  excluding?: boolean;
}

/**
 * The tiers a lock names exactly (19-section-locks.md 8 and 9): a tile per
 * tier in a two-column grid, ticked tiles in the brand colour, a count, and
 * one line saying what the ticks mean. The last tick cannot be cleared: an
 * empty list would match nobody. A tier ticked and since deleted stays as a
 * tile, so it can be unticked.
 */
export const TierChecklist: React.FC<TierChecklistProps> = ({ value, onChange, tiers, idPrefix, disabled = false, excluding = false }) => {
  const chosen = onlyKeys(value);
  const ordered = [...tiers].sort((a, b) => a.rank - b.rank);
  const missing = chosen.filter((key) => !ordered.some((tier) => tier.key === key));
  const items = [
    ...ordered.map((tier) => ({ key: tier.key, name: tier.name, deleted: false })),
    ...missing.map((key) => ({ key, name: key, deleted: true })),
  ];

  const toggle = (key: string) => {
    if (disabled) return;
    const next = chosen.includes(key) ? chosen.filter((item) => item !== key) : [...chosen, key];
    if (next.length === 0) return;
    onChange(onlyValue(next));
  };

  const heading = excluding ? "Tiers kept out" : "Tiers let in";
  const hint = excluding
    ? "Members on a ticked tier are kept out. Everyone else, signed-out visitors included, gets in."
    : "Only members on a ticked tier get in. A higher tier is not included unless it is ticked.";

  return (
    <div className="tier-checklist" role="group" aria-labelledby={`${idPrefix}-heading`}>
      <div className="tier-checklist-head">
        <span id={`${idPrefix}-heading`} className="tier-checklist-title">
          {heading}
        </span>
        <span className="tier-checklist-count">{`${chosen.length} of ${items.length} selected`}</span>
      </div>

      <div className="tier-checklist-grid">
        {items.map((item) => {
          const on = chosen.includes(item.key);
          const last = on && chosen.length === 1;
          return (
            <button
              key={item.key}
              id={`${idPrefix}-${item.key}`}
              type="button"
              role="checkbox"
              aria-checked={on}
              aria-disabled={disabled || last || undefined}
              title={last ? "At least one tier stays ticked" : undefined}
              className={cn("tier-option", on && "is-checked", item.deleted && "is-deleted", (disabled || last) && "is-locked")}
              onClick={() => toggle(item.key)}
            >
              <span className="tier-option-box" aria-hidden={true}>
                {on ? <Check className="tier-option-icon" /> : null}
              </span>
              <span className="tier-option-name">{item.name}</span>
              {item.deleted ? <span className="tier-option-note">Deleted</span> : null}
            </button>
          );
        })}
      </div>

      <p className="tier-checklist-hint">{hint}</p>
    </div>
  );
};
