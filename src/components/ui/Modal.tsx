import React, { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";
import { IconButton } from "./IconButton";

export interface ModalProps {
  title: string;
  /** One line under the title. */
  description?: string;
  /** Omit to make the modal impossible to dismiss: no close button, no Escape, no backdrop click. */
  onClose?: () => void;
  children: React.ReactNode;
}

/**
 * A dialog over the panel. Kit extension (design-system.md section 9), added
 * for F19's payment form and plan notices.
 *
 * Fills the 360px panel with a 16px gutter, on bg/raised with the card shadow.
 * Focus moves into it on open and Escape closes it when it can be closed.
 * A modal with no `onClose` is the BEAF "your trial has ended" kind: its own
 * buttons are the only way out.
 */
export const Modal: React.FC<ModalProps> = ({ title, description, onClose, children }) => {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    panel.current?.focus();
  }, []);

  useEffect(() => {
    if (!onClose) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="kit-modal-backdrop"
      onMouseDown={(event) => {
        if (onClose && event.target === event.currentTarget) onClose();
      }}
    >
      <div ref={panel} className="kit-modal" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        <div className="kit-modal-head">
          <div className="kit-modal-heading">
            <p id={titleId} className="kit-modal-title">
              {title}
            </p>
            {description ? <p className="kit-modal-desc">{description}</p> : null}
          </div>
          {onClose ? (
            <IconButton label="Close" variant="ghost" onClick={onClose}>
              <X aria-hidden={true} />
            </IconButton>
          ) : null}
        </div>
        <div className="kit-modal-body">{children}</div>
      </div>
    </div>
  );
};
