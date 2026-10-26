import React, { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { ExternalLink, X } from "lucide-react";
import { IconButton } from "./IconButton";

export interface SheetProps {
  title: string;
  /** One line under the title. */
  description?: string;
  /** Beside the title: a status such as Connected. */
  badge?: React.ReactNode;
  /** A 32px tile left of the title: a provider's mark, a member's avatar. */
  icon?: React.ReactNode;
  /** A link to the setup guide for what the sheet configures, opened in the browser. */
  guide?: { href: string; label?: string };
  /**
   * Omit to make the sheet impossible to dismiss: no close button, no Escape,
   * no scrim click. Its own buttons are the only way out (a delete running).
   */
  onClose?: () => void;
  /** Pinned under the scrolling body: a destructive action left, the primary right. */
  footer?: React.ReactNode;
  children: React.ReactNode;
}

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/** Open sheets, oldest first: Escape closes only the top one (a confirm over a settings sheet). */
const openSheets: number[] = [];
let lastSheet = 0;

/**
 * A dialog over the panel, framefic-ui-kit's `Sheet` (design-system.md section
 * 8), always centered: the user chose that over the kit's bottom sheet
 * (2026-10-25). The title and close, a scrolling body, and a pinned footer,
 * 16px from the panel's edges and 16px inside. The scrim is the overlay token
 * with the glass backdrop blur (section 6.1).
 *
 * Rendered into document.body through a portal: a card that opens it may be
 * transformed (the kit's hover lift), and a transformed ancestor would trap a
 * fixed-position sheet inside the card.
 *
 * Focus moves to the first control in the body, Tab stays inside, and focus
 * returns to whatever opened it. A component that wants another first focus
 * (ConfirmDialog's keep button) sets it in its own effect, which runs after.
 */
export const Sheet: React.FC<SheetProps> = ({ title, description, badge, icon, guide, onClose, footer, children }) => {
  const titleId = useId();
  const sheet = useRef<HTMLDivElement>(null);
  const order = useRef(0);

  useEffect(() => {
    const id = ++lastSheet;
    order.current = id;
    openSheets.push(id);
    return () => {
      const at = openSheets.indexOf(id);
      if (at !== -1) openSheets.splice(at, 1);
    };
  }, []);

  // Focus in, trap Tab, restore on close.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const element = sheet.current;
    const focusables = () =>
      [...(element?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])].filter((node) => !node.hasAttribute("disabled"));
    // The first field, so typing can start at once. Never an info tip's icon:
    // focus opens its bubble, and it sat over the field it describes (2026-10-25).
    const inBody = focusables().filter((node) => !node.closest(".kit-sheet-head") && !node.closest(".info-tip"));
    const first = inBody.find((node) => node.matches("input, select, textarea")) ?? inBody[0];
    (first ?? element)?.focus();

    const onTab = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const nodes = focusables();
      if (nodes.length === 0) return;
      if (event.shiftKey && document.activeElement === nodes[0]) {
        event.preventDefault();
        nodes[nodes.length - 1]!.focus();
      } else if (!event.shiftKey && document.activeElement === nodes[nodes.length - 1]) {
        event.preventDefault();
        nodes[0]!.focus();
      }
    };
    element?.addEventListener("keydown", onTab);
    return () => {
      element?.removeEventListener("keydown", onTab);
      opener?.focus?.();
    };
  }, []);

  useEffect(() => {
    if (!onClose) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && openSheets[openSheets.length - 1] === order.current) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const dialog = (
    <div
      className="kit-sheet-scrim"
      onMouseDown={(event) => {
        if (onClose && event.target === event.currentTarget) onClose();
      }}
    >
      <div ref={sheet} className="kit-sheet" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        <div className="kit-sheet-head">
          {icon ? (
            <span className="kit-sheet-icon" aria-hidden={true}>
              {icon}
            </span>
          ) : null}
          <div className="kit-sheet-heading">
            <h2 id={titleId} className="kit-sheet-title">
              {title}
              {badge}
            </h2>
            {description ? <p className="kit-sheet-desc">{description}</p> : null}
            {guide ? (
              <a
                className="kit-sheet-guide"
                href={guide.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${guide.label ?? "Setup guide"} (opens in your browser)`}
              >
                {guide.label ?? "Setup guide"}
                <ExternalLink aria-hidden={true} />
              </a>
            ) : null}
          </div>
          {onClose ? (
            <IconButton label="Close" variant="ghost" onClick={onClose}>
              <X aria-hidden={true} />
            </IconButton>
          ) : null}
        </div>
        <div className="kit-sheet-body">{children}</div>
        {footer ? <div className="kit-sheet-footer">{footer}</div> : null}
      </div>
    </div>
  );

  // No document when rendered on a server (tests): then inline.
  return typeof document === "undefined" ? dialog : createPortal(dialog, document.body);
};
