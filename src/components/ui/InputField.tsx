import React from "react";
import "./ui.css";

export interface InputFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  iconLeft?: React.ReactNode;
  required?: boolean;
}

export const InputField: React.FC<InputFieldProps> = ({
  label,
  hint,
  error,
  iconLeft,
  required,
  className = "",
  id,
  ...rest
}) => {
  const inputId = id || (label ? `input-${label.toLowerCase().replace(/\s+/g, "-")}` : undefined);

  return (
    <div className="mf-field">
      {label && (
        <label htmlFor={inputId} className="mf-label">
          <span>
            {label}
            {required && <span className="mf-label__required">*</span>}
          </span>
        </label>
      )}
      <div className="mf-input-wrapper">
        {iconLeft && <span className="mf-input-wrapper__icon-left">{iconLeft}</span>}
        <input
          id={inputId}
          className={`mf-input ${iconLeft ? "mf-input--has-icon-left" : ""} ${
            error ? "mf-input--error" : ""
          } ${className}`.trim()}
          {...rest}
        />
      </div>
      {error ? (
        <span className="mf-error">{error}</span>
      ) : hint ? (
        <span className="mf-hint">{hint}</span>
      ) : null}
    </div>
  );
};
