import React from "react";
import { ChevronDown } from "lucide-react";
import "./ui.css";

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectFieldProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: SelectOption[];
  hint?: string;
  error?: string;
  required?: boolean;
}

export const SelectField: React.FC<SelectFieldProps> = ({
  label,
  options,
  hint,
  error,
  required,
  className = "",
  id,
  ...rest
}) => {
  const selectId = id || (label ? `select-${label.toLowerCase().replace(/\s+/g, "-")}` : undefined);

  return (
    <div className="mf-field">
      {label && (
        <label htmlFor={selectId} className="mf-label">
          <span>
            {label}
            {required && <span className="mf-label__required">*</span>}
          </span>
        </label>
      )}
      <div className="mf-input-wrapper">
        <select
          id={selectId}
          className={`mf-select ${error ? "mf-input--error" : ""} ${className}`.trim()}
          {...rest}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <span className="mf-select-chevron">
          <ChevronDown size={14} />
        </span>
      </div>
      {error ? (
        <span className="mf-error">{error}</span>
      ) : hint ? (
        <span className="mf-hint">{hint}</span>
      ) : null}
    </div>
  );
};
