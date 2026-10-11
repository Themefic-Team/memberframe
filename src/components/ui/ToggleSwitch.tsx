import React from "react";
import "./ui.css";

export interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  title: string;
  description?: string;
  disabled?: boolean;
}

export const ToggleSwitch: React.FC<ToggleSwitchProps> = ({
  checked,
  onChange,
  title,
  description,
  disabled = false,
}) => {
  return (
    <div
      className={`mf-toggle ${disabled ? "mf-toggle--disabled" : ""}`}
      onClick={() => {
        if (!disabled) onChange(!checked);
      }}
      role="switch"
      aria-checked={checked}
      tabIndex={disabled ? -1 : 0}
      onKeyDown={(e) => {
        if (!disabled && (e.key === " " || e.key === "Enter")) {
          e.preventDefault();
          onChange(!checked);
        }
      }}
    >
      <div className="mf-toggle__info">
        <span className="mf-toggle__title">{title}</span>
        {description && <span className="mf-toggle__desc">{description}</span>}
      </div>
      <div className={`mf-toggle__pill ${checked ? "mf-toggle__pill--active" : ""}`}>
        <div className={`mf-toggle__knob ${checked ? "mf-toggle__knob--active" : ""}`} />
      </div>
    </div>
  );
};
