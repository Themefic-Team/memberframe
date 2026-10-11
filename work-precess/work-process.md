# MemberFrame Work Process

How to do the work, step by step. Follow this for every task.

- What to build and in what order: [../docs/development-plan.md](../docs/development-plan.md)
- How each feature is designed (database, API, components): [../docs/implementation-guide.md](../docs/implementation-guide.md)
- What is done: [progress-tracker.md](progress-tracker.md)
- Current state of the project: [../docs/project-review.md](../docs/project-review.md)

---

## Part A. One-Time Setup

1. Install Node.js 18 or later, npm 9 or later, and Git.
2. Clone the repo and run `npm install`.
3. Run `npm run dev`. Vite starts on `https://localhost:5173`.
4. In Framer, open a project, then Plugins, then "Open Development Plugin", and enter that URL.
5. The MemberFrame panel opens at 360 by 640 in the top right.

Things that are easy to get wrong:

- The `id` in `framer.json` must be exactly 6 characters (`memfrm`). Framer rejects anything else.
- The dev server must be HTTPS. `vite.config.ts` already handles this.
- Agent rules and the linter live in `.agent/`. There is no second agent folder.

Full setup details: [../docs/development-docs/00-workspace-setup-and-standards.md](../docs/development-docs/00-workspace-setup-and-standards.md).

---

## Part B. The Task Loop

Do these nine steps for every task. One task is one row in the tracker.

### Step 1. Pick the task

Open [progress-tracker.md](progress-tracker.md). Take the first task in the current milestone that is `Not started` and not blocked. Do not start a later milestone while the current one has open tasks.

### Step 2. Mark it started

In the tracker, set the task to `In progress` and add today's date. Do this before writing code, so nobody else picks the same task.

### Step 3. Read before writing

- The feature's section in `docs/implementation-guide.md`. This is the design to follow.
- The feature's development doc in `docs/development-docs/`, if one exists.
- The existing code for that feature.
- For anything that calls the backend: the guide's section 3 (API) and section 2.3 (object shapes).

If the spec and the code disagree, stop and settle it. Write the answer in the development doc.

### Step 4. Write the development doc first

Create or update `docs/development-docs/NN-feature-slug.md` using the template in `.agent/rules/feature-development-docs.md`. Fill in the user flow, file list, property controls, and data types. Leave the checklist unticked. Set the status line to `In progress`.

### Step 5. Build

Order inside one feature:

1. Types in `src/types/index.ts`.
2. API client method, with its mock response.
3. Plugin UI (tab or component), using the UI kit in `src/components/ui/`.
4. Canvas component, if the feature has one.
5. Unit tests for the logic.

Rules that apply while building are in the development plan, section 4.3.

### Step 6. Check

```bash
npm run lint:css        # zero inline CSS
npx tsc --noEmit        # zero type errors
npm run build           # production build
```

After task M0-6 these three become one command: `npm run check`. All must pass. Fix failures before going on.

### Step 7. Test inside Framer

1. Open the plugin in Framer with `npm run dev` running.
2. Test the feature in dark theme, then in light theme.
3. For a canvas component: insert it, change each property control, then publish to a test site and test it there as a visitor.
4. Test the failure cases: no network, wrong input, signed out.

A feature that was only tested in the browser preview is not tested.

### Step 8. Update the docs and the tracker

- Tick each checklist item in the development doc that you actually checked.
- Set the doc's status line (`Prototype`, `Done`, and so on).
- Update the task row in the tracker: status, date, and a short note.
- Update the feature row in the tracker's feature table.
- Add one line to the tracker's Done Log.

### Step 9. Commit

One task, one commit. Message format:

```
M2-5: tiers tab saves to site meta, add edit and reorder
```

The task ID at the start links the commit to the tracker row. Commit the code, the development doc, and the tracker together.

---

## Part C. Finishing a Milestone

When every task in a milestone is `Done`:

1. Run the three checks from Step 6 on a clean checkout.
2. Go through the milestone's exit condition in the development plan. It must be true on a real Framer site.
3. Have a second person test it. Then mark the features `Verified`.
4. Write the milestone's finish date in the tracker.
5. Read the next milestone. If it needs backend endpoints, confirm they are ready before starting.

---

## Part D. When Something Is Blocked

| Situation | What to do |
| :--- | :--- |
| Backend endpoint is not ready | Build against the mock client. Mark the task `Prototype`, not `Done`. Add the blocker to the tracker's Blockers table. |
| Guide is unclear or contradicts the code | Do not guess. Add it to "Blockers and Open Questions" in the tracker and ask. |
| Task is marked (BE) | It is done in the backend repository. Follow the same nine steps there, and update this tracker. |
| A Framer API does not behave as expected | Write what you found in the feature's development doc under a "Framer Notes" heading, so the next person does not repeat it. |
| A task is bigger than one day | Split it into smaller rows in the tracker before continuing. |

---

## Part E. Working With AI Agents

The same loop applies when an AI agent does the work.

- Give the agent the task ID. It should read the tracker, the development plan, and the feature doc first.
- The agent must update the tracker and the development doc in the same change as the code. `.agent/rules/feature-development-docs.md` already requires the doc.
- An agent may set a status to `Prototype` or `Done`. Only a person sets `Verified`.
- Do not accept "Implemented and Verified" from an agent unless Step 7 was really done in Framer.
