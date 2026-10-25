#!/usr/bin/env node
/**
 * No-CDN gate. Proves the built plugin loads nothing from a CDN.
 *
 * Runs after `npm run build`, on what actually ships:
 *   dist/*.html  no <link> or <script> with an http(s) or protocol-relative source
 *   dist/**.css  no @import of a remote stylesheet, no url() to a remote file
 *   dist/**.js   no known CDN host anywhere (fonts, npm CDNs, image CDNs)
 *   dist/assets  the bundled fonts are there (Inter at least)
 * And on the canvas components' source, which run on the creator's site:
 *   no import from a URL, no remote @import or url() in their CSS strings
 *
 * One allowed outside script: Stripe.js from js.stripe.com, which
 * @stripe/stripe-js loads for the billing payment form. Stripe requires it to
 * be served from its own domain (PCI DSS), so it cannot be bundled.
 * Links people click (framefic.com, the marketplace) are not loads and are
 * not checked.
 *
 * Usage: node .agents/scripts/check-no-cdn.js [distDir]
 */

import fs from "fs";
import path from "path";

const root = process.cwd();
const dist = path.resolve(root, process.argv[2] ?? "dist");
const canvasDir = path.resolve(root, "src", "canvas-components");

/** Hosts that only ever serve shared assets: any mention in shipped code is a load. */
const CDN_HOSTS = [
  "fonts.googleapis.com",
  "fonts.gstatic.com",
  "use.typekit.net",
  "cdn.jsdelivr.net",
  "unpkg.com",
  "cdnjs.cloudflare.com",
  "esm.sh",
  "cdn.skypack.dev",
  "ga.jspm.io",
  "images.unsplash.com",
  "source.unsplash.com",
  "cdn.tailwindcss.com",
  "code.jquery.com",
  "use.fontawesome.com",
  "kit.fontawesome.com",
];

/** Outside hosts the plugin may load from, and why. */
const ALLOWED = { "js.stripe.com": "Stripe.js must load from Stripe (PCI DSS); billing payment form only" };

const problems = [];
const report = (file, rule, detail) => problems.push({ file: path.relative(root, file), rule, detail });
const isRemote = (value) => /^(https?:)?\/\//i.test(value.trim().replace(/^["']/, ""));

function files(dir, test) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? files(full, test) : test(entry.name) ? [full] : [];
  });
}

function checkCss(file, css) {
  for (const match of css.matchAll(/@import\s+(?:url\(\s*)?(["']?[^"');\s]+)/gi)) {
    if (isRemote(match[1])) report(file, "remote @import", match[0]);
  }
  for (const match of css.matchAll(/url\(\s*(["']?[^"')]+)/gi)) {
    if (isRemote(match[1])) report(file, "remote url()", match[0]);
  }
}

function checkHosts(file, text) {
  for (const host of CDN_HOSTS) {
    if (text.includes(host)) report(file, "CDN host", host);
  }
}

if (!fs.existsSync(dist)) {
  console.error(`[No-CDN Check] ${path.relative(root, dist)} does not exist. Run npm run build first.`);
  process.exit(1);
}

for (const file of files(dist, (name) => name.endsWith(".html"))) {
  const html = fs.readFileSync(file, "utf8");
  for (const match of html.matchAll(/<(link|script)\b[^>]*\b(?:href|src)\s*=\s*["']([^"']+)["'][^>]*>/gi)) {
    if (isRemote(match[2])) report(file, `remote <${match[1].toLowerCase()}>`, match[2]);
  }
  checkCss(file, html);
  checkHosts(file, html);
}

for (const file of files(dist, (name) => name.endsWith(".css"))) {
  const css = fs.readFileSync(file, "utf8");
  checkCss(file, css);
  checkHosts(file, css);
}

const scripts = files(dist, (name) => /\.(m?js)$/.test(name));
for (const file of scripts) checkHosts(file, fs.readFileSync(file, "utf8"));

const fonts = files(dist, (name) => name.endsWith(".woff2"));
if (!fonts.some((file) => path.basename(file).startsWith("inter-"))) {
  report(dist, "fonts not bundled", "no inter-*.woff2 in the build");
}

for (const file of files(canvasDir, (name) => name.endsWith(".tsx"))) {
  const source = fs.readFileSync(file, "utf8");
  for (const match of source.matchAll(/\bimport\b[^;]*?\bfrom\s*["']([^"']+)["']|\bimport\(\s*["']([^"']+)["']/g)) {
    const target = match[1] ?? match[2];
    if (isRemote(target)) report(file, "import from a URL", target);
  }
  checkCss(file, source);
  checkHosts(file, source);
}

const allowedSeen = Object.keys(ALLOWED).filter((host) => scripts.some((file) => fs.readFileSync(file, "utf8").includes(host)));

console.log(`[No-CDN Check] Scanned ${path.relative(root, dist)} and src/canvas-components. Bundled fonts: ${fonts.length} files.`);
for (const host of allowedSeen) console.log(`  allowed: ${host} (${ALLOWED[host]})`);

if (problems.length > 0) {
  console.error(`\n[No-CDN Check FAILED] ${problems.length} problem(s):\n`);
  problems.forEach((p, i) => console.error(`  ${i + 1}. ${p.file}  ${p.rule}: ${p.detail}`));
  process.exit(1);
}

console.log("[No-CDN Check PASSED] Nothing loads from a CDN.");
