import React, { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { cn } from "../../utils/cn";

export interface SearchSelectOption<Value extends string> {
  value: Value;
  label: string;
}

export interface SearchSelectProps<Value extends string> {
  id?: string;
  value: Value;
  options: ReadonlyArray<SearchSelectOption<Value>>;
  onChange: (value: Value) => void;
  disabled?: boolean;
  fill?: boolean;
  /** Accessible name. Supply it when no visible label is tied to `id`. */
  label?: string;
  /** The filter box's placeholder. */
  searchPlaceholder?: string;
}

/** Gap between the trigger and the panel, and the panel's margin from the window edge. */
const OFFSET = 4;
const EDGE = 8;
const PANEL_MAX_HEIGHT = 280;

/**
 * A select with a filter box, for long lists: currencies, countries. Kit
 * extension, design rule section 9; CSS in `kit.css`.
 *
 * The closed control is the kit select (`.framefic-select`), so it reads as
 * one. Open, a panel holds a search field and a listbox: typing filters by
 * label, Arrow keys move, Enter picks, Escape closes and returns focus to the
 * trigger, and a click outside closes. Short lists keep using `<Select>`,
 * whose native popup is better than anything rebuilt.
 *
 * The panel is `position: fixed`, placed from the trigger's rect, because the
 * cards field rows live in clip their overflow (the same reason as InfoTip).
 * Coordinates reach it as custom properties set through the ref, so there is
 * no `style={{ }}`.
 */
export function SearchSelect<Value extends string>({
  id,
  value,
  options,
  onChange,
  disabled = false,
  fill = false,
  label,
  searchPlaceholder = "Search",
}: SearchSelectProps<Value>) {
  const listId = `${useId()}-list`;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  const selected = options.find((option) => option.value === value);
  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return needle === "" ? options : options.filter((option) => option.label.toLowerCase().includes(needle));
  }, [options, query]);

  const close = useCallback((refocus: boolean) => {
    setOpen(false);
    setQuery("");
    if (refocus) triggerRef.current?.focus();
  }, []);

  const pick = (option: SearchSelectOption<Value>) => {
    onChange(option.value);
    close(true);
  };

  // Place the panel under the trigger, flipping above when there is no room.
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const trigger = triggerRef.current;
      const panel = panelRef.current;
      if (!trigger || !panel) return;
      const rect = trigger.getBoundingClientRect();
      const width = Math.max(rect.width, 220);
      const left = Math.min(Math.max(EDGE, rect.right - width), window.innerWidth - width - EDGE);
      const below = window.innerHeight - rect.bottom - OFFSET - EDGE;
      const top = below >= Math.min(PANEL_MAX_HEIGHT, 160) ? rect.bottom + OFFSET : Math.max(EDGE, rect.top - OFFSET - PANEL_MAX_HEIGHT);
      panel.style.setProperty("--search-select-top", `${top}px`);
      panel.style.setProperty("--search-select-left", `${left}px`);
      panel.style.setProperty("--search-select-width", `${width}px`);
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  // Open on the selected option, with the filter box focused.
  useEffect(() => {
    if (!open) return;
    setActive(Math.max(0, options.findIndex((option) => option.value === value)));
    searchRef.current?.focus();
  }, [open, options, value]);

  useEffect(() => setActive(0), [query]);

  // Keep the active option in view.
  useEffect(() => {
    if (!open) return;
    panelRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  // A click outside closes it.
  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      close(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [close, open]);

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((index) => Math.min(matches.length - 1, index + 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((index) => Math.max(0, index - 1));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const option = matches[active];
      if (option) pick(option);
    } else if (event.key === "Escape") {
      event.preventDefault();
      close(true);
    } else if (event.key === "Tab") {
      close(false);
    }
  };

  return (
    <>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        className={cn("framefic-select", "search-select-trigger", fill && "fill")}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        disabled={disabled}
        onClick={() => (open ? close(false) : setOpen(true))}
      >
        <span className="search-select-value">{selected?.label ?? value}</span>
      </button>

      {open ? (
        <div ref={panelRef} className="search-select-panel">
          <input
            ref={searchRef}
            type="search"
            className="search-select-search"
            value={query}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            aria-controls={listId}
            aria-activedescendant={matches[active] ? `${listId}-${active}` : undefined}
            onChange={(event) => setQuery(event.currentTarget.value)}
            onKeyDown={onKeyDown}
          />
          <ul id={listId} className="search-select-list" role="listbox" aria-label={label}>
            {matches.length === 0 ? (
              <li className="search-select-empty">No match</li>
            ) : (
              matches.map((option, index) => (
                <li
                  key={option.value}
                  id={`${listId}-${index}`}
                  data-index={index}
                  role="option"
                  aria-selected={option.value === value}
                  className={cn("search-select-option", index === active && "is-active", option.value === value && "is-selected")}
                  onMouseEnter={() => setActive(index)}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => pick(option)}
                >
                  {option.label}
                </li>
              ))
            )}
          </ul>
        </div>
      ) : null}
    </>
  );
}
