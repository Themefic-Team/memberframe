# Company Agent Ecosystem: Frontend Orchestrator & Sub-Agent Architecture

This document establishes the multi-agent orchestration architecture for the **Company Framer Plugin Development Ecosystem**. It defines how the **Plugin Orchestrator Agent** initiates project discovery by exploring user requirements and feature research, analyzes references and improvements, maintains living specifications (SDD & TDD), delegates tasks to specialized **Frontend Sub-Agents**, and maintains the live **Agent Work Preview**.

This architecture is generalized to build **10 to 15+ Framer plugins** with 100% brand consistency, identical UI layout standards, and rapid turnaround.

---

## 1. Multi-Agent Ecosystem Hierarchy (Frontend-Only)

```mermaid
flowchart TD
    User([User Prompt / New Plugin Request]) --> Orch[Orchestrator: framer-orchestrator]
    
    subgraph Step 0: Research & Feature Analysis
        Orch --> Intake[Interactive Feature & Scope Intake]
        Intake -->|User Answers| SpecPlan[Generate SPEC.md, SDD.md & TDD Plan]
    end
    
    subgraph Phase 1: Core Design & Canvas Components
        SpecPlan -->|UI Panel, Customizer, Themes, .primary-cta| SA_UI[Sub-Agent: framer-frontend-ui]
        SpecPlan -->|React Component, PropertyControls, CSS Template| SA_CodeGen[Sub-Agent: framer-canvas-codegen]
    end
    
    subgraph Phase 2: Pro-Lock & Telemetry (After Core Workflow)
        SA_UI & SA_CodeGen --> SA_Lock[Sub-Agent: framer-licensing-lock<br/>Client Pro-Lock, 7-Day Trial, 1-Instance Check, Watermark]
        SA_UI & SA_CodeGen --> SA_Track[Sub-Agent: framer-telemetry-tracking<br/>getSiteInfo, Site Info Sync, Component Count, Mode Safety]
    end
    
    SA_Lock & SA_Track --> Orch
    Orch --> Preview[Live Agent Work Preview Table]
    Preview --> Pack[TDD Verification & Marketplace Pack]
```

---

## 2. Interactive Intake & Requirements Analysis Protocol

When a user initiates a new plugin project or submits a feature prompt, **the Orchestrator does NOT jump directly into coding or push payment logic**. It starts with a comprehensive feature and research discovery session.

### 2.1. The Core Intake Questionnaire

The Orchestrator utilizes the `ask_question` tool or structured interactive prompts to establish:

1. **Feature Analysis & Research Instructions**:
   - What is the primary purpose and user workflow of the plugin?
   - What are the required feature sets, user interactions, and behavior specifications?
2. **Reference Plugins & Design Inspiration**:
   - Do you have any reference plugins, design inspiration, or competitive benchmarks in mind?
   - What specific layouts, visuals, or interactions should this plugin mirror or improve upon?
3. **Scope of Customization & Control Options**:
   - What customizable controls should designers have in the plugin configurator (e.g., color pickers, typography scales, layout toggles, animations)?
   - Which of these should also be exposed as Framer Property Controls in the canvas sidebar?
4. **Target Canvas Component Deliverable**:
   - What React code component should be deployed to the user's Framer canvas (`framer.createCodeFile`)?
   - How should it scale responsively across mobile, tablet, and desktop viewports?

### 2.2. Living Specification & Phased Planning
Once the user provides their feature answers:
1. The Orchestrator summarizes the analyzed requirements back to the user to confirm alignment.
2. The Orchestrator authors **`SPEC.md`** defining component props, states, and user interactions.
3. The Orchestrator authors **`SDD.md`** outlining UI panels, navigation tabs, and styling structure.
4. The Orchestrator establishes the **TDD Plan** ([`tdd-and-verification.md`](tdd-and-verification.md)) for zero-inline-CSS validation and theme parity.
5. The Orchestrator creates the task list and dispatches tasks in phased order:
   - **Phase 1: Design & UI Customization**
   - **Phase 2: Canvas Code Component Generation**
   - **Phase 3: Pro-Lock, Trial & Subscription Wiring (Done later, after core workflow is built)**
   - **Phase 4: Site Telemetry & Verification**

---

## 3. Sub-Agent Roles and Specializations

### 3.1. Orchestrator Agent: `framer-orchestrator`
- **Role**: Master Conductor & Architectural Supervisor
- **Primary Tasks**:
  - **Mandatory Pre-Flight Check**: Inspect `src/design-tokens.css`, `src/styles/variables.css`, or references `design-tokens.css`. Enforce that all agents strictly follow the exact CSS rules, tokens, and variables in the project without inventing outside designs.
  - **Ecosystem Reference Adherence**: Follow all reference folders in the ecosystem (`.agent/skills/framer-plugin-suite/references/` and existing plugins in the workspace) and `SKILL.md`.
  - Run the Step 0 Feature Research & Discovery interview.
  - Author and maintain `SPEC.md`, `SDD.md`, and the TDD verification plan.
  - Decompose user goals into discrete domain tasks and assign to frontend sub-agents.
  - Maintain and output the **Live Agent Work Preview Table**.
  - Enforce cross-agent standards (Zero Inline CSS, `.primary-cta` double-gradient button, light/dark mode sync).

### 3.2. Sub-Agent: `framer-frontend-ui`
- **Role**: Plugin UI Panel & Layout Specialist
- **Focus**: React + Vite + Framer Plugin SDK iframe
- **Primary Tasks**:
  - Window geometry initialization (`360px × 640px`, top-right).
  - 4-part navigation structure: `Home`, `Builder / Customizer`, `Settings`, `Profile / Subscription`.
  - Configurator forms: color pickers, range sliders, segmented buttons, select dropdowns.
  - **Strict Zero Inline CSS Rule**: 100% external CSS modules. Zero `style={{ ... }}` in JSX.
  - Implementation of the **Mandatory `.primary-cta` Button Standard**.
  - Real-time Light & Dark mode synchronization matching `data-framer-theme` and `data-user-theme`.
  - Sticky Top Trial Countdown Banner (`.framefic-trial-sticky-banner`) with live ticker.
  - Drop-in Profile Page (`ProfilePage.tsx`) with segmented avatar ring & subscription badge.
  - Subscription Management Page (`SubscriptionPage.tsx`) with plan overview, Stripe portal button, and cancellation modal.
  - Author footer.

### 3.3. Sub-Agent: `framer-canvas-codegen`
- **Role**: Framer Canvas Code Component Architect
- **Focus**: Canvas Code Generation (`framer.createCodeFile`, `file.setFileContent`)
- **Primary Tasks**:
  - High-performance React/TypeScript code component templates for canvas deployment.
  - Framer Property Controls declaration (`addPropertyControls`, `ControlType`).
  - Master CSS template string module (`cssContent` via `<style>` tag) with semantic class names and zero inline styles.
  - Embedding Frosted Pro Lock Banner (`IS_LOCKED === true`).
  - Embedding Trial Duplicate Limit Card (`IS_TRIAL && isDuplicate`).
  - Embedding Trial Watermark Badge (`IS_TRIAL === true`).
  - CodeFile auto-lock hooks: `const IS_LOCKED = true/false;`, `const IS_TRIAL = true/false;`.

### 3.4. Sub-Agent: `framer-licensing-lock`
- **Role**: Client Pro-Lock, Licensing & Trial Specialist
- **Focus**: Client UI Gating, 7-Day Trial Limits & CodeFile Auto-Patching
- **Primary Tasks**:
  - Client UI gating: swapping `.primary-cta` (`Sign In to Unlock`, `Upgrade to Unlock`, `Add to Canvas`).
  - Passwordless 6-digit OTP authentication modal (`useAuth`, `AuthModal`).
  - 7-Day trial flow with anti-abuse verification across `email`, `site_id`, `framer_user_id`.
  - **1-Instance Limit Enforcement**: Pre-insertion canvas scan and duplicate blocking during trial.
  - Canvas duplicate protection (`__instances__` registry).
  - Automatic CodeFile Regex Patching (`enforceLockState` in `App.tsx`): rewrites `IS_LOCKED` and `IS_TRIAL` in all deployed files.
  - **Automatic Watermark Removal**: Rewrites `IS_TRIAL = false` immediately upon paid upgrade.
  - Stripe Customer Billing Portal integration (`createBillingPortalSession`) & multi-step cancellation flow.

### 3.5. Sub-Agent: `framer-telemetry-tracking`
- **Role**: Frontend Site Metadata & Telemetry Tracking Specialist
- **Focus**: Framer SDK Metadata, Identity, and Usage Metrics
- **Primary Tasks**:
  - Extract project metadata via `getSiteInfo()` (`siteId`, `siteName`, `siteUrl`, `userId`, `userEmail`).
  - Site info sync: POSTing to `/api/user/site-info` upon login/signup and subscription refresh.
  - Usage metrics: Counting deployed plugin files and passing `componentsCount` to `/api/subscription-status`.
  - **`framer.mode` Guardrail**: Verifying mode to avoid calling `getCodeFiles()` during managed collection sync.
  - Differential compression for Framer's 2kB `setPluginData` limit.

---

## 4. Standard Agent Work Preview Output

Whenever the Orchestrator completes an intake phase, major task milestone, or sub-agent delegation, it presents the structured **Agent Work Preview**:

```markdown
### Company Plugin Agent Work Preview: [Plugin Name]

| Domain | Responsible Agent | Status | Key Deliverables |
| :--- | :--- | :--- | :--- |
| **Orchestration** | `framer-orchestrator` | [Complete] | Feature research intake, SPEC.md, SDD.md, TDD plan |
| **Plugin UI Panel** | `framer-frontend-ui` | [In Progress] | 360x640 window, 4 tabs, Customizer, .primary-cta, Themes |
| **Canvas Component** | `framer-canvas-codegen` | [Queued] | React template, Property controls, CSS injection |
| **Pro-Lock & Trial** | `framer-licensing-lock` | [Queued] | Client Pro-Lock, 7-day trial, 1-instance limit, Watermark removal |
| **Site Telemetry** | `framer-telemetry-tracking` | [Queued] | getSiteInfo(), /api/user/site-info sync, mode safety |

#### Active Verification Checklist:
- [ ] Feature research and improvement scope confirmed with user.
- [ ] UI panel & customizer designed with 100% external CSS (Zero inline CSS).
- [ ] Mandatory `.primary-cta` applied to all primary actions.
- [ ] Light/Dark theme sync with `data-framer-theme`.
- [ ] Canvas Code Component deployed with Property Controls.
- [ ] 7-Day trial sticky top countdown ticker active.
- [ ] 1-Instance limit per component enforced on trial.
- [ ] Watermark automatically removed upon paid upgrade.
- [ ] `framer.mode` safety check before calling `getCodeFiles()`.
- [ ] TDD verification and `npm run pack` passed.
```

---

## 5. End-to-End Orchestrated Development Runbook

```
Step 0: User Prompt Received ➔ framer-orchestrator triggers.
Step 1: Feature Research & Intake ➔ Asks feature analysis, reference preferences, and scope.
Step 2: Analysis & Living Plan ➔ Summarizes findings, drafts SPEC.md, SDD.md, and TDD plan.
Step 3: Frontend UI Panel ➔ framer-frontend-ui builds 360x640 window, customizer, and external CSS.
Step 4: Canvas Code Component ➔ framer-canvas-codegen builds React template & Property Controls.
Step 5: Pro-Lock & Trial ➔ framer-licensing-lock wires client Pro-Lock, trial limits & watermark.
Step 6: Site Telemetry ➔ framer-telemetry-tracking wires getSiteInfo() & /api/user/site-info.
Step 7: Verification & Pack ➔ Runs linter, theme tests, mock tests, and executes `npm run pack`.
```
