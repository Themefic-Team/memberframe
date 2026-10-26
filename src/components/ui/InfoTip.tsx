import React, { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Info } from "lucide-react";
import { cn } from "../../utils/cn";

export interface InfoTipProps {
  /** What the hint is about, for the trigger's accessible name: "About {label}". */
  label: string;
  children: React.ReactNode;
}

/** Gap between the trigger and the bubble, and the bubble's margin from the window edge. */
const OFFSET = 6;
const EDGE = 8;
/** Long enough to move the pointer from the icon onto the bubble without it closing. */
const CLOSE_DELAY_MS = 120;

/** `:focus-visible`, the browser's own test for focus a keyboard moved. True where it is unsupported. */
function isKeyboardFocus(element: HTMLElement): boolean {
  try {
    return element.matches(":focus-visible");
  } catch {
    return true;
  }
}

/**
 * A field hint behind a 14px info icon. Opens on hover, keyboard focus, or a
 * tap; closes on leave, blur, Escape, or scroll. WCAG 1.4.13: the bubble can be
 * hovered without closing, and dismissed without moving focus.
 *
 * The bubble is `position: fixed` and placed from the trigger's rect, because
 * the cards field rows live in clip their overflow and an absolute bubble would
 * be cut off at the card edge. The coordinates arrive as custom properties set
 * through the ref, the same bridge PreviewStudio uses, so there is no
 * `style={{ }}`.
 *
 * The bubble is rendered into document.body through a portal. A fixed
 * element inside a transformed ancestor is placed against that ancestor, not
 * the window, and cards transform (the kit's hover lift): inline, the bubble
 * landed away from its icon (2026-10-25).
 *
 * The bubble stays in the DOM while closed so `aria-describedby` always has
 * something to read: a screen reader hears the hint when the icon is focused.
 */
export const InfoTip: React.FC<InfoTipProps> = ({ label, children }) => {
  const tipId = `${useId()}-tip`;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const bubbleRef = useRef<HTMLSpanElement>(null);
  const closeTimer = useRef<number | null>(null);
  const [open, setOpen] = useState(false);

  const cancelClose = useCallback(() => {
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);

  const show = useCallback(() => {
    cancelClose();
    setOpen(true);
  }, [cancelClose]);

  const hideSoon = useCallback(() => {
    cancelClose();
    closeTimer.current = window.setTimeout(() => setOpen(false), CLOSE_DELAY_MS);
  }, [cancelClose]);

  const hideNow = useCallback(() => {
    cancelClose();
    setOpen(false);
  }, [cancelClose]);

  useEffect(() => cancelClose, [cancelClose]);

  // Below the icon and centred on it, clamped inside the window. Above it when
  // there is no room below, which is the case near the pinned footer.
  useLayoutEffect(() => {
    const trigger = triggerRef.current;
    const bubble = bubbleRef.current;
    if (!open || !trigger || !bubble) return;

    const anchor = trigger.getBoundingClientRect();
    const width = bubble.offsetWidth;
    const height = bubble.offsetHeight;

    const centre = anchor.left + anchor.width / 2 - width / 2;
    const x = Math.max(EDGE, Math.min(centre, window.innerWidth - width - EDGE));
    const below = anchor.bottom + OFFSET;
    const y =
      below + height > window.innerHeight - EDGE
        ? Math.max(EDGE, anchor.top - OFFSET - height)
        : below;

    bubble.style.setProperty("--info-tip-x", `${Math.round(x)}px`);
    bubble.style.setProperty("--info-tip-y", `${Math.round(y)}px`);
  }, [open]);

  // A fixed bubble would float away from its field when the panel scrolls.
  useEffect(() => {
    if (!open) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") hideNow();
    };

    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", hideNow, true);
    window.addEventListener("resize", hideNow);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", hideNow, true);
      window.removeEventListener("resize", hideNow);
    };
  }, [open, hideNow]);

  const bubble = (
    <span
      ref={bubbleRef}
      id={tipId}
      role="tooltip"
      className={cn("info-tip-bubble", open && "is-open")}
      onMouseEnter={show}
      onMouseLeave={hideSoon}
    >
      {children}
    </span>
  );

  return (
    <span className="info-tip" onMouseEnter={show} onMouseLeave={hideSoon}>
      <button
        ref={triggerRef}
        type="button"
        className={cn("info-tip-trigger", open && "is-open")}
        aria-label={`About ${label}`}
        aria-describedby={tipId}
        onFocus={(event) => {
          // Keyboard focus only. Focus a script moves here (a dialog opening)
          // must not open the bubble over the form.
          if (isKeyboardFocus(event.currentTarget)) show();
        }}
        onBlur={hideNow}
        onClick={() => (open ? hideNow() : show())}
      >
        <Info aria-hidden={true} />
      </button>
      {/* No document when rendered on a server (tests): then inline. */}
      {typeof document === "undefined" ? bubble : createPortal(bubble, document.body)}
    </span>
  );
};
