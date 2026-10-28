# MemberFrame Data and Permissions Justification

For the Framer Marketplace review team. Every field MemberFrame sends to its server, when it is sent,
and why; then every permission declared in `framer.json`. Audit item C4 in
[`framer-marketplace-audit.md`](framer-marketplace-audit.md).

## Principles

- **Nothing before a click.** On launch the plugin sends only the Framer project id and, when this
  browser is already signed in, the creator's session token. Account and project details are sent
  only after the creator clicks a button that sits under a visible consent line.
- **No secrets in shared project storage.** The creator's session token is kept in this browser
  only, never in Framer plugin data, so collaborators and copies of the project never receive it.
- **No tracking.** No analytics, no fingerprinting, no tracking cookies, and no IP addresses stored.
  Stripe.js loads only when the payment form opens, with Stripe's fraud signals turned off.
- **Secrets are encrypted.** Payment gateway keys and the SMTP password are encrypted with
  AES-256-GCM on the server and never returned to the browser.

## Data Sent to the Backend

| Field | Source | Sent when | Purpose |
| :--- | :--- | :--- | :--- |
| Framer project id (`siteId` anchor) | `framer.getProjectInfo().id` | Launch and every call | License anchor: which project has a trial or a paid plan |
| Creator session token | Issued after sign in | Launch and every call | Authenticates the creator. Stored hashed on the server, expires after 30 days, revoked on Sign Out. Kept in this browser only |
| Creator email | Typed by the creator on the hosted account page | Sign up and sign in, after the consent line | Account identity, sign in codes, receipts, and invoices |
| Framer user id | `framer.getCurrentUser().id` | Linking a project, after a click | One free trial per Framer account |
| Creator name, project name | `getCurrentUser().name`, `getProjectInfo().name` | Linking a project, after a click | Names on receipts and plan emails |
| Published domains | `framer.getPublishInfo()` | Linking a project, after a click | Allowlist (CORS) for the site's member API, so only the creator's own site can call it |
| Payment gateway keys, SMTP password | Typed by the creator in Settings | On save | Lets the creator's members pay and receive email. Encrypted, never returned |
| Member email, name, device user agent | Typed by the creator's site members on the published site | Member sign in | Membership accounts, and the signed-in devices list a member sees. No IP address is stored |
| Signup notice | Creator name, email, project name | Account creation and billing events | Sent to Framefic's internal support inbox so the team can help with setup and billing. Never shared, sold, or used for marketing |

## Sign In

The plugin signs creators in through a hosted Framefic account page that opens in the browser, with
a 6-digit email code or Google. Password sign in exists only on that hosted page. The plugin itself
never shows a password field and never handles a credential.

## Permissions in `framer.json`

| Permission | Used for |
| :--- | :--- |
| `createCodeFile` | Creates the MemberFrame code components in the project |
| `setCodeFileContent` | Updates those components when settings, tiers, or the license change |
| `addComponentInstance` | One-click insertion of a component onto the canvas |
| `createWebPage` | Creates the sign in, account, and pricing pages on request. Existing pages are skipped |
| `cloneNode` | Copies the site's header and footer onto a newly created page |
| `setParent` | Places the copied header and footer inside the new page |
| `setAttributes` | Sets layout on the copied header and footer, and tags protected components with their lock id |
| `removeNodes2` | Rolls back a copy the plugin itself just made when page creation fails. Never removes the creator's content |
| `setPluginData` | Stores non-secret project configuration: the connection ids, the lock registry, and download rules. Never a token or key |

Every protected call is preceded by `framer.isAllowedTo`, and every delete the creator can trigger
opens a confirmation dialog first.
