import { useEffect } from "react";

/**
 * Measure the scroll area's reserved scrollbar gutter and publish it as
 * `--mf-scrollbar-gutter` on the root, so the panel's right padding can be
 * 16px minus the gutter and the content sits 16px from both edges.
 *
 * The gutter is not one number: 6px where the slim WebKit bar applies (Chrome,
 * the Framer desktop app on Windows), 0 where scrollbars overlay the content
 * (macOS, Firefox on Windows 11), and Firefox's own width elsewhere. A fixed
 * 10px right padding was right only for the first and left 16 / 10 on the
 * others (2026-10-27). Sheets share the same scrollbar rules, so one value
 * serves both.
 */
export function useScrollbarGutter(active: boolean): void {
  useEffect(() => {
    // Collapsed, the scroll area is out of the DOM: measure again on expand.
    if (!active || typeof document === "undefined") return;
    const area = document.querySelector<HTMLElement>(".framefic-content-area");
    if (!area) return;

    const measure = () => {
      const gutter = Math.max(0, area.offsetWidth - area.clientWidth);
      document.documentElement.style.setProperty("--mf-scrollbar-gutter", `${gutter}px`);
    };

    measure();
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(measure) : null;
    observer?.observe(area);
    window.addEventListener("resize", measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [active]);
}
