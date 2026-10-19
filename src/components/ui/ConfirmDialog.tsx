import React, { useEffect, useRef } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "./Button";
import { Modal } from "./Modal";

export interface ConfirmDialogProps {
  /** A question naming the thing: "Delete this tier?" */
  title: string;
  /** What happens, in plain words, including what cannot be undone. */
  message: React.ReactNode;
  /** Verb plus object: "Delete tier". */
  confirmLabel: string;
  /** What keeping it is called: "Keep tier". */
  cancelLabel: string;
  /** While the delete runs: both buttons disabled, and the dialog cannot be dismissed. */
  busy?: boolean;
  /** Leading icon on the confirm button. Trash by default. */
  icon?: React.ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * The popup in front of every delete. Kit extension (design-system.md
 * section 9), added 2026-10-19 at the product owner's request: Framer's
 * marketplace review expects a double check before anything is removed, so
 * no delete, remove, or disconnect in the panel acts on the first click.
 *
 * Built on `<Modal>`. Focus starts on the safe button, so Enter keeps the
 * thing rather than deleting it. Escape and the backdrop cancel, except while
 * the delete is running.
 */
export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  title,
  message,
  confirmLabel,
  cancelLabel,
  busy = false,
  icon,
  onConfirm,
  onCancel,
}) => {
  const keep = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    keep.current?.focus();
  }, []);

  return (
    <Modal title={title} {...(busy ? {} : { onClose: onCancel })}>
      <div className="kit-confirm-message">{message}</div>
      <div className="kit-confirm-actions">
        <Button ref={keep} variant="secondary" size="md" disabled={busy} onClick={onCancel}>
          {cancelLabel}
        </Button>
        <Button variant="danger" size="md" disabled={busy} onClick={onConfirm}>
          {icon ?? <Trash2 aria-hidden={true} />}
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
};
