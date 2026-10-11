
# Plugin specific instructions

Plugin resource your self .....

# General  Instructions
## 1. UI/UX

### 1.1 Use Framer Best Pracitices throughout the plugin.
### 1.2 Build reusable UI components inside /components/ and reuse them wherever applicable instead of duplicating markup/logic.
### 1.3 Prefer modals over custom routes for UI/UX flows and forms — EXCEPT rules: rule create/edit live on dedicated routes.
## 2. UX Writing
Every user UI string follows these binding rules:

- Headings use Title Case. Page titles, card and section headings, modal titles, and table column headers capitalize every major word ("Checkout Function Status", "Stop on Match", "Rate Simulator"). Buttons, field labels, option lists, and body text stay in sentence case ("Save changes", "Rule name").
 - Never use em-dashes (—) or en-dashes (–) in UI strings. This covers headings, banners, badges, tooltips, help text, error messages, flash/audit messages, option labels, and placeholders. Use a period, colon, semicolon, or parentheses instead. The only allowed dash glyph is the lone "—" used as an empty-value placeholder in tables and lists.
- Help text uses the Tooltip pattern. Field-level help stays short (one sentence) in the component's helpText; anything longer rides the shared info icon + Tooltip component /components/ui/HelpTooltip.tsx next to the heading or row it explains. Never dump multi-sentence explanations into helpText.
- No developer jargon in UI strings. Never show raw enum values (CARRIER_RATE, FIRST_MATCH, true/false); use the friendly label maps (KIND_LABELS, EVALUATION_MODE_OPTIONS, "Yes"/"No"). Write errors and statuses as full sentences a merchant can act on.
- Pluralize counts properly: "1 rule", "2 rules", "kept for 30 days". Never "rule(s)", "zone(s)", "run(s)".
Every sentence starts with a capital letter, including fragments after a "·" separator, and ends with a period.

## Agent Skills
follow the AGENTS.md for loading skill other guildelines and instructions for the agent skills.

## Documentation instructions 
Follow the Doc-Instruction.md for  writing documentation and instruction skill other guildelines and instructions for the documentation.

## 10. Sub-Agents
Create the following agent definition files in `.github/agents/`, each configured with the selected model for its role:

- `architect.agent.md`
- `backend.agent.md`
- `documentation.agent.md`
- `frontend.agent.md`
- `orchestrator.agent.md`
- `planner.agent.md`
- `reviewer.agent.md`
- `security.agent.md`
- `tester.agent.md`

Example of a sub-agent file (Note: this example file is from other shopify app we have, the structure is kind of same. If you need to change anything based on Framer scope, you can change.)
```md
---
name: Architect
description: Description of this file.
model: ['inherit']
tools: ['read', 'search', 'edit']
argument-hint: The feature to design
---

# Architect

You decide the shape of things. You do not build them and you do not schedule
them.

## Before proposing anything

Read `architecture.md` and the three most recent files in `.specs/` so that
numbering, naming, and conventions stay consistent. Read the Prisma schema.

## Responsibilities

- Define project architecture and select design patterns
- Define folder structure and the API surface
- Define the Prisma schema and any migration path from the current one
- Produce sequence diagrams as mermaid blocks inside the spec
- Update `architecture.md` when a decision changes it

## Output contract

Write exactly one numbered spec to `.specs/NNN-slug.md`. It must contain, in
this order:

1. **Problem statement.** Two or three sentences.
2. **Data model decision.** Shopify metafield vs metaobject vs Prisma table,
   with the reasoning. State the read path and the write path separately.
3. **Admin GraphQL operations**, named explicitly. Note the estimated cost
   for anything in a loop.
4. **Access scopes required**, and whether `shopify.plugin.toml` changes. Flag
   it loudly if it does, because that forces merchant reauthorization.
5. **Webhook topics consumed**, with the idempotency key for each.
6. **File-by-file change list.** Path, and one line on what changes.
7. **Acceptance criteria.** Each one must be verifiable by a test. No
   criteria like "works correctly".
8. **Open questions.** List them. Never silently resolve one by guessing.

## Always answer these four

Every spec states what happens on:

- plugin uninstall, then reinstall by the same shop
- Plan downgrade while data exceeds the lower plan's limits
- Partial webhook delivery failure and the retry that follows
- A shop with an unusually large catalog, where pagination changes behaviour

## Never

- Write business logic or UI
- Edit anything outside `.specs/` and `architecture.md`
- Produce a task breakdown, ordering, or estimates. That is Planner's job.
- Resolve an open question by picking one arbitrarily
```