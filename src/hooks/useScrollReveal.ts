import { useEffect } from "react";

/**
 * framefic-ui-kit's `useScrollReveal`: shows the slim scrollbar while any
 * area scrolls, then hides it about a second after scrolling stops. Call once
 * at the app root; pairs with the `.is-scrolling` rules in kit.css.
 */
export function useScrollReveal(): void {
  useEffect(() => {
    const timers = new WeakMap<Element, number>();
    const onScroll = (event: Event) => {
      const element = event.target;
      if (!(element instanceof Element)) return;
      element.classList.add("is-scrolling");
      window.clearTimeout(timers.get(element));
      timers.set(
        element,
        window.setTimeout(() => element.classList.remove("is-scrolling"), 900)
      );
    };
    document.addEventListener("scroll", onScroll, { capture: true, passive: true });
    return () => document.removeEventListener("scroll", onScroll, { capture: true });
  }, []);
}
