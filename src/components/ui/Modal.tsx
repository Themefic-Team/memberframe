import React, { useEffect } from "react";
import { X } from "lucide-react";
import "./ui.css";

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="mf-modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="mf-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="mf-modal-title"
      >
        <div className="mf-modal__header">
          <h3 id="mf-modal-title" className="mf-modal__title">
            {title}
          </h3>
          <button
            className="mf-modal__close-btn"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X size={16} />
          </button>
        </div>
        <div className="mf-modal__body">{children}</div>
        {footer && <div className="mf-modal__footer">{footer}</div>}
      </div>
    </div>
  );
};
