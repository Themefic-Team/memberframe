/**
 * Framefic billing UI helpers, as the BEAF plugin writes them (App.jsx,
 * ProfilePage.jsx, SubscriptionPage.jsx, lib/framer/notify.js), so every
 * Framefic plugin words and formats its plans the same way. F19.
 */

import { framer } from "framer-plugin";
import type { LicenseView } from "../../services/licenseService";

/** BEAF's toasts: Framer's own notification, error or success. */
export async function notify({ type, message }: { type: "Success" | "Error" | "Info" | "Warning"; message: string }): Promise<void> {
  try {
    await framer.notify(message, { variant: type === "Error" ? "error" : "success" });
  } catch {
    // Outside Framer, the browser preview.
  }
}

/** "5h 3m 2s", BEAF's last-day countdown. */
export function formatCountdown(totalSeconds: number): string {
  const total = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0 || hours > 0) parts.push(`${minutes}m`);
  parts.push(`${seconds}s`);
  return parts.join(" ");
}

/** The sticky banner's text: days, then the live countdown on the last day (F19: at 24 hours). */
export function trialBannerText(secondsLeft: number): string {
  if (secondsLeft <= 86_400) return `Free trial! ${formatCountdown(secondsLeft)} left`;
  const days = Math.ceil(secondsLeft / 86_400);
  return `Free trial! ${days} ${days === 1 ? "day" : "days"} left`;
}

export function getPlanName(plan: string | null | undefined): string {
  switch (plan) {
    case "monthly":
      return "Pro Monthly";
    case "yearly":
      return "Pro Yearly";
    case "lifetime":
      return "Lifetime Deal";
    case "trial":
      return "7-Day Free Trial";
    default:
      return "Free";
  }
}

/** "Active", "Trialing", "Past due", as BEAF capitalises a status. */
export function getStatusLabel(status: string | null | undefined, active: boolean): string {
  if (!status) return active ? "Active" : "Inactive";
  if (status === "canceling") return "Scheduled to cancel";
  if (status === "paid") return "Active";
  return status.charAt(0).toUpperCase() + status.slice(1).replaceAll("_", " ");
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export function isAutoRenew(view: LicenseView | null): string {
  if (!view) return "-";
  if (view.plan === "lifetime") return "Never";
  if (view.state === "active" && !view.cancelAtPeriodEnd && view.status !== "past_due") return "Automatically";
  return "No";
}

/** BEAF's theme sniffing for the account page: Framer's attribute first, then the page colour. */
export function detectTheme(): "light" | "dark" {
  if (typeof document === "undefined") return "dark";
  const read = (el: Element | null, name: string) => el?.getAttribute(name) ?? null;
  const body = document.body;
  const html = document.documentElement;
  const values = [read(body, "data-framer-theme"), read(html, "data-framer-theme"), read(html, "data-user-theme"), read(body, "data-user-theme")];
  if (values.includes("light") && !values.includes("dark")) return "light";
  if (values.includes("dark")) return "dark";
  try {
    const match = window.getComputedStyle(body).backgroundColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (match) {
      const luminance = (0.299 * Number(match[1]) + 0.587 * Number(match[2]) + 0.114 * Number(match[3])) / 255;
      return luminance > 0.6 ? "light" : "dark";
    }
  } catch {
    // Fall through.
  }
  return "dark";
}

/** BEAF's plan card features. */
export const PLAN_FEATURES = ["All features, no limits", "Unlimited members and components", "Priority Support"];
