/**
 * The four sign-in providers' marks for the panel (31-sign-in-methods.md):
 * the Settings integration cards and the Manage member views. One colour, the
 * current text colour, per the Pixelfic kit: the panel never draws brand
 * colours. The canvas sign-in buttons carry their own full-colour copies,
 * since a canvas file may import nothing.
 */

import React from "react";
import { cn } from "../utils/cn";

export type SignInProvider = "google" | "apple" | "github" | "discord";

export const SIGN_IN_PROVIDER_NAMES: Record<SignInProvider, string> = {
  google: "Google",
  apple: "Apple",
  github: "GitHub",
  discord: "Discord",
};

const PATHS: Record<SignInProvider, string> = {
  google: "M12 11v3.2h5.3c-.2 1.4-1.6 4.1-5.3 4.1-3.2 0-5.8-2.6-5.8-5.9S8.8 6.5 12 6.5c1.8 0 3 .8 3.7 1.4l2.5-2.4C16.6 4 14.5 3 12 3 7 3 3 7 3 12s4 9 9 9c5.2 0 8.6-3.6 8.6-8.7 0-.6 0-1-.1-1.3H12z",
  apple: "M16.3 12.7c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.8-1.5-.2-2.9.9-3.7.9-.8 0-2-.8-3.2-.8-1.7 0-3.4 1.4-3.4 4 0 1.6.6 3.3 1.4 4.4.7 1 1.4 1.9 2.4 1.9.9 0 1.3-.6 2.5-.6s1.5.6 2.5.6c1 0 1.7-.9 2.4-1.9.5-.8.8-1.5 1-1.9-1.9-.7-2.1-2.5-2.1-3.3zM14.3 6c.6-.7 1-1.6.9-2.6-.9.1-1.9.6-2.5 1.3-.5.6-1 1.6-.9 2.5 1 .1 2-.5 2.5-1.2z",
  github: "M12 2a10 10 0 00-3.2 19.5c.5.1.7-.2.7-.5v-1.8c-2.8.6-3.4-1.3-3.4-1.3-.4-1.2-1.1-1.5-1.1-1.5-.9-.6.1-.6.1-.6 1 .1 1.5 1 1.5 1 .9 1.5 2.3 1.1 2.9.8.1-.6.3-1.1.6-1.4-2.2-.2-4.6-1.1-4.6-5 0-1.1.4-2 1-2.7-.1-.3-.4-1.3.1-2.7 0 0 .8-.3 2.7 1a9.4 9.4 0 015 0c1.9-1.3 2.7-1 2.7-1 .5 1.4.2 2.4.1 2.7.6.7 1 1.6 1 2.7 0 3.9-2.4 4.8-4.6 5 .4.3.7 1 .7 2v2.9c0 .3.2.6.7.5A10 10 0 0012 2z",
  discord: "M19.3 5.6A16 16 0 0015.2 4.3l-.3.7a12 12 0 00-5.8 0l-.3-.7a16 16 0 00-4.1 1.3C2.2 9.3 1.5 12.9 1.9 16.4a16 16 0 004.8 2.4l.6-1a10 10 0 01-1.6-.8l.4-.3a11.4 11.4 0 009.8 0l.4.3c-.5.3-1 .6-1.6.8l.6 1a16 16 0 004.8-2.4c.5-4-.6-7.6-2.8-10.8zM8.7 14.3c-.9 0-1.7-.9-1.7-1.9s.8-1.9 1.7-1.9 1.7.9 1.7 1.9-.8 1.9-1.7 1.9zm6.6 0c-.9 0-1.7-.9-1.7-1.9s.8-1.9 1.7-1.9 1.7.9 1.7 1.9-.8 1.9-1.7 1.9z"
};

export function isSignInProvider(value: unknown): value is SignInProvider {
  return value === "google" || value === "apple" || value === "github" || value === "discord";
}

/**
 * Brand marks, the one place the panel draws its own svg: Lucide has no
 * brand logos (design-system.md section 12). Sized by CSS (`.provider-mark`,
 * 16px; `small` is 12px, for inline beside text), like every icon.
 */
export const ProviderMark: React.FC<{ provider: SignInProvider; small?: boolean; className?: string }> = ({
  provider,
  small = false,
  className,
}) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className={cn("provider-mark", small && "is-small", className)}>
    <path fill="currentColor" d={PATHS[provider]} />
  </svg>
);
