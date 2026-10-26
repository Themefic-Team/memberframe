import React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "../../utils/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Full width (framefic-ui-kit `full`). The `fill` class does the same. */
  full?: boolean;
  /** Busy: a spinner in place of the leading icon, the label stays, the button is disabled. */
  loading?: boolean;
}

/**
 * framefic-ui-kit's Button, on our classes.
 *
 * The `primary` variant renders `.primary-cta`. Exactly one per view, never two,
 * per PRD section 7.5. The gradient fill lives in components.css; never give a
 * button a flat brand fill, it fails WCAG AA at 4.07:1.
 *
 * `.primary-cta` is deliberately NOT combined with `.btn`. Both set a height and
 * `.btn` is declared later in components.css, so adding it would win the cascade
 * and shrink the medium CTA from 36px to 30px.
 *
 * Children are wrapped in stable spans (the kit's `.btn-ico` and `.btn-label`):
 * a browser extension that rewrites button text cannot break React's updates,
 * and swapping the icon for the spinner never touches a bare text node.
 */
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "sm", full = false, loading = false, className, type = "button", disabled, children, ...rest },
  ref
) {
  const classes =
    variant === "primary"
      ? cn("primary-cta", size === "sm" && "btn-sm", full && "fill", loading && "is-loading", className)
      : cn("btn", `btn-${variant}`, `btn-${size}`, full && "fill", loading && "is-loading", className);

  const parts = React.Children.toArray(children);
  const leadsWithIcon = parts.length > 1 && React.isValidElement(parts[0]);
  const icon = leadsWithIcon ? parts[0] : null;
  const label = leadsWithIcon ? parts.slice(1) : parts;

  return (
    <button ref={ref} type={type} className={classes} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {loading ? (
        <span className="btn-ico">
          <Loader2 className="btn-spinner" aria-hidden={true} />
        </span>
      ) : icon ? (
        <span className="btn-ico">{icon}</span>
      ) : null}
      <span className="btn-label">{label}</span>
    </button>
  );
});
