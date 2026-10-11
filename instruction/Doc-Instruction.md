# Documentation Instructions

These instructions cover two outputs for this app:

1. **`docs/highlighted-features/`**: a feature list for the app store listing and the landing page.
2. **`docs/help/`**: help documentation for merchants (store owners).

Both must be based on what the code actually does, not on assumptions.

---

## Step 1: Read the codebase first

Before writing anything, read the full codebase: admin UI, settings, storefront or theme extension, API routes, webhooks, plans and billing, and any feature flags.

Then build a feature inventory for your own use. For every setting a merchant can see or change, note:

- The exact UI label (button, menu, tab and field names)
- The default value
- What it does for the merchant
- Which plan it belongs to, if the app has plans

Rules for accuracy:

- Only document features that work and are visible to merchants.
- If a feature is half-built, hidden behind a flag, or not reachable in the UI, leave it out of both outputs and list it in the run summary instead.
- Always use the exact UI labels from the code, and put them in **bold** in help docs.

---

## Step 2: Highlighted features

**File:** `docs/highlighted-features/features.md`

For each feature, include:

- **Feature name:** short and benefit-led (2 to 5 words)
- **One-line summary:** under 20 words, ready to use as an app store listing bullet
- **Description:** 2 to 3 plain sentences on what the merchant gets and why it matters
- **Plan:** which plan includes it (skip if the app has no plans)
- **Where to find it in the app:** so the right screenshot can be taken

Order features from most important to least important. End the file with a **Top 5 for the listing** section that picks the five strongest features.

Write in plain, benefit-focused language with no technical jargon. The "no em-dashes" rule below applies here too.

---

## Step 3: Tone of voice

All documentation (help docs and highlighted features) must use **one tone**, the same on every page. A reader who jumps from the Getting started page to the Troubleshooting page should feel the same person wrote both.

### Selected tone

**Tone: Friendly and helpful**

Change the line above to choose a different tone for this app. Pick only one:

| Tone | How it sounds | Example |
|---|---|---|
| **Friendly and helpful** (default) | Warm, patient and encouraging, like a helpful teammate | "Pick the product you want to give away. You can change it any time." |
| **Professional and clear** | Calm, direct and polished, with no chatty phrases | "Select the product to offer as a gift. This can be changed later." |
| **Simple and direct** | Plain and to the point with no extra detail, best for quick-setup apps. Sentences are still complete and clear | "Select the product you want to give away, then click **Save**." |
| **Upbeat and energetic** | Positive and lively, but never over the top | "Nice work! Your first gift rule is now live, so open your store and add a product to your cart to see it in action." |

### Tone rules

- Read the selected tone before writing any page, and apply it to every page, heading, step and FAQ answer.
- Keep the tone the same in highlighted features. They can be more benefit-focused, but they must sound like the same voice.
- Use the same words for the same things everywhere. If one page says "gift rule", no other page should call it "offer", "campaign" or "promotion". Keep a short word list at the top of `docs/help/README.md` under **Terms used in these docs**, and follow it.
- Use the same kind of phrasing for repeated moments, such as page intros, save confirmations and "What to read next" lines.
- Keep the same level of detail from page to page. Don't make one page very chatty and the next very short.
- No jokes, slang or emojis in any tone.
- When you update an existing page, match the selected tone. If an older page uses a different tone, rewrite it to match and mention it in the run summary.
- If the selected tone changes, update every page in `docs/help/` and `docs/highlighted-features/` in the same run.

---

## Step 4: Help documentation

### Folder structure

- One page per task or feature. Use kebab-case file names, for example `getting-started.md` or `create-a-free-gift-rule.md`.
- Add `docs/help/README.md` as an index that lists every page in the suggested reading order, plus the **Terms used in these docs** word list.
- The minimum page set:
  - Getting started (install and first setup)
  - One page per main feature
  - Plans and billing (if the app has plans)
  - Troubleshooting and FAQ

### Writing rules (binding)

1. **Point of view is "you" and "your".** Write directly to the store owner.
2. **Never use "we", "us" or "our".** The docs are for the merchant, not the developer.
3. **Write for non-technical readers.** Use everyday words. If a technical term can't be avoided, explain it in plain words the first time it appears. Don't show code, file paths or API names unless the merchant has to type them.
4. **Use longer, easy-to-read sentences instead of short, unclear ones.** A sentence should give the reader everything they need: what to do, where to do it, and why it matters. Don't cut sentences down so much that they lose meaning or sound like notes. Join closely related ideas with words like "so", "then", "because" and "which".
   - Unclear: "Open Settings. Toggle it on. Save."
   - Clear: "Go to **Settings** and turn on **Free Gift**, then click **Save** so the gift will start showing in your cart."

   Longer does not mean complicated. Keep one main idea per sentence, avoid stacking several clauses, and split a sentence if it goes past about 30 words.
5. **Instructions in the present, outcomes in the future.** Tell the reader what to do ("Click **Save**."), then say what will happen next ("A green banner will confirm the change.").
6. **Never use em-dashes (—).** Use a period, comma or colon instead.
7. **Sound like a person, not a template.** Explain things the way one person helps another. Avoid long lists of bold-lead bullets, perfectly parallel sentences, and filler such as "The good news:", "Simply", "Seamlessly" or "Effortlessly".
8. **Check grammar and spelling** on every page before finishing.
9. **Screenshot placeholders must be visible.** Use square brackets in the format `[Add <What It Shows> Screenshot]`, for example `[Add Zone Condition Screenshot]`. Place each one right after the step it illustrates. Never put placeholders inside HTML comments, because they disappear when the page is rendered.
10. **Every page has a Video tutorial section** with a visible placeholder in the format `[Add <Page Title> Video Tutorial]`, for example `[Add Getting Started Video Tutorial]`.

### Page template

Use a how-to, blog-style layout:

```markdown
# How to <do the task>

A short intro (1 to 3 sentences): what this page helps you do and when you would need it.

## Before you start
(Only if something is needed first, such as a paid plan or another setting.)

## Video tutorial
[Add <Page Title> Video Tutorial]

## Step 1: <Action>
What to do, in plain words. What will happen after.

[Add <Step Name> Screenshot]

## Step 2: <Action>
...

## Check that it works
How the merchant can confirm the setup worked, for example by viewing their store.

## Troubleshooting
(Optional. Common problems and how to fix them.)

## What to read next
- [Related page](related-page.md)
```

---

## Step 5: Docs ship with code

Any task that changes something a merchant can see or use (a new setting, a renamed label, a changed default, a removed feature) must update the affected `docs/help/` pages and `docs/highlighted-features/features.md` in the same run. If a change needs no doc updates, say so in the run summary.

---

## Step 6: Final check

Before finishing, confirm every item:

- [ ] Every step and label matches the current code and UI
- [ ] Every page uses the selected tone, and the tone is the same across all pages
- [ ] The same terms are used everywhere, matching **Terms used in these docs**
- [ ] No "we", "us" or "our" anywhere in help content
- [ ] No em-dashes anywhere
- [ ] Every page has a Video tutorial placeholder
- [ ] All screenshot placeholders are visible, in square brackets, and follow the naming format
- [ ] Every page ends with "What to read next"
- [ ] `docs/help/README.md` lists every page
- [ ] Sentences are complete and easy to read, with no short, note-style fragments
- [ ] Grammar and spelling checked

## Run summary

End each run with a short summary:

- Pages created or updated
- The tone used, and any older pages rewritten to match it
- Features left out and why (unfinished, hidden, behind a flag)
- Anything unclear in the code that needs a decision from the team
