# Feature: Test Harness And Framer SDK Mock

Technical development specification, user flow, architectural wiring, and testing checklist for the unit test harness and the Framer Plugin SDK mock.

**PRD reference**: [section 16.1](../memberframe-complete-prd.md), layer 1 of the TDD triad
**Status**: in progress
**Tasks**: 0.8 (see [`../IMPLEMENTATION-STATUS.md`](../IMPLEMENTATION-STATUS.md))

> Not an F-numbered feature. The mock is the harness every later unit test runs inside, so it has no row in the
> feature table of [`README.md`](README.md). It gets a doc because
> [`.agents/rules/feature-development-docs.md`](../../.agents/rules/feature-development-docs.md) section 1 triggers on
> any feature **or component**, and because the decisions recorded in section 8 change what later features are allowed
> to assume about the SDK.

---

## 1. Overview and Problem Solved

- **Feature Name**: Test Harness and Framer SDK Mock
- **Target Audience**: nobody. Internal engineering only, it ships no UI and no canvas code.
- **Value Proposition**: The real `framer` singleton posts messages to a parent window, so any code that touches it cannot be exercised outside the Framer desktop app. PRD section 16.1 lists five things that must be unit tested: the SDK mock itself, auth and token storage, 2kB differential compression, the regex lock-state patcher, and the `isEntitled` truth table. None of those can run until a mock exists. This is the dependency that unblocks all five.
- **Priority Tier**: P0: Core MVP

---

## 2. User Flows

### 2.1. In-Plugin Configuration Flow (Framer Designer)

None. No creator ever sees this.

### 2.2. Visitor / Member Runtime Flow

None. The mock is excluded from the production bundle because nothing in the entry graph imports it.

### 2.3. Engineering Flow

1. A test imports `createFramerMock` from `src/utils/framerMock.ts`.
2. It passes the mock into the function under test, instead of the real singleton.
3. It asserts on the returned values, on the recorded calls in `mock.calls`, or on the `mock.pluginData` store.
4. `npm test` runs the suite once. `npm run test:watch` re-runs on save.

---

## 3. Architecture and File Inventory

### Plugin UI Components

None.

### Canvas Code Components

None.

### Backend API Endpoints

None. The harness makes no network calls and the mock has no HTTP surface. When the backend exists, request mocking is a separate decision, see section 8.5.

### Files

| Path | Role |
| :--- | :--- |
| `src/utils/framerMock.ts` | The mock factory, the narrowed code-file interface, and the 2kB byte helper |
| `test/framerMock.test.ts` | 16 tests. Proves the mock behaves and that the drift guards hold |
| `vitest.config.ts` | Node environment, `test/**/*.test.ts` only, no Vite plugins |
| `package.json` | `test` and `test:watch` scripts, `vitest` dev dependency |
| `tsconfig.json` | `include` widened from `["src"]` to `["src", "test"]` |

### Styling

None. No CSS, so `lint:css` has nothing to say about this task.

---

## 4. Framer Property Controls Specification

Not applicable. No canvas component.

| Control Title | Control Type | Default Value | Description |
| :--- | :--- | :--- | :--- |
| none | | | |

---

## 5. Data Contracts and Core User Schema

```typescript
// src/utils/framerMock.ts

/** The SDK calls MemberFrame actually makes, Picked from the real framer type. */
type SdkMembers = Pick<
  typeof framer,
  | "mode" | "getProjectInfo" | "getPublishInfo" | "getCurrentUser" | "isAllowedTo"
  | "showUI" | "hideUI" | "notify" | "closePlugin" | "getPluginData" | "setPluginData"
>;

/** A code file narrowed to what MemberFrame reads and writes. */
export interface MockCodeFile {
  readonly id: string;
  readonly name: string;
  readonly path: string;
  readonly content: string;
  setFileContent(code: string): Promise<MockCodeFile>;
  remove(): Promise<void>;
}

export interface MockCallLog {
  showUI: UIOptions[];
  hideUI: number;
  notify: Array<{ message: string; hasButton: boolean }>;
  getPluginData: string[];
  setPluginData: Array<{ key: string; value: string | null }>;
  getCodeFiles: number;
  createCodeFile: Array<{ name: string; code: string }>;
  closePlugin: Array<{ message?: string }>;
}

export interface FramerMock extends SdkMembers {
  getCodeFiles(): Promise<readonly MockCodeFile[]>;
  createCodeFile(name: string, code: string): Promise<MockCodeFile>;
  readonly calls: MockCallLog;
  readonly pluginData: Map<string, string>;
}

export function createFramerMock(overrides?: Partial<FramerMock>): FramerMock;
export function pluginDataByteLength(value: string): number;
export const PLUGIN_DATA_BYTE_LIMIT = 2048;
export class MockPluginClosedError extends Error {}
```

Default fixture values, chosen to match the company reference sample wherever the SDK types allow:

| Call | Returns |
| :--- | :--- |
| `mode` | `"canvas"` |
| `getProjectInfo()` | `{ id: "test-site-id-123", name: "Test Framer Project", apiVersion1Id: "v1-test-site-id-123" }` |
| `getCurrentUser()` | `{ id: "user-123", name: "Alex Designer", apiVersion1Id: "v1-user-123", initials: "AD" }` |
| `getPublishInfo()` | `production` at `https://example.framer.app`, `staging: null` |
| `isAllowedTo(...)` | `true` |
| `getCodeFiles()` | `[]` until something is created |

---

## 6. Verification and Testing Checklist

- [ ] Light mode and dark mode colour contrast verified with `data-framer-theme`. Not applicable, no UI.
- [x] Zero inline CSS compliance verified. `npm run lint:css`, 0 violations. No CSS in this task.
- [ ] Framer Property Controls render cleanly in canvas sidebar. Not applicable.
- [ ] Backend API endpoints return proper status codes. Not applicable.
- [ ] All action buttons use `.primary-cta`. Not applicable.
- [x] Strictly Lucide or Framer SVG icons, zero unicode emoji. Confirmed by grep, no icons present.
- [x] `tsc --noEmit` and `npm run build` pass, with `test/` now inside the typecheck.
- [x] **PRD acceptance: unit tests run with no Framer desktop app.** `npm test` passes 16 of 16 in a node environment, no iframe parent, no Framer process.
- [x] The compile-time drift guard is not vacuous. Verified by deliberately renaming `MockCodeFile.content` and confirming `tsc` reported `TS2322: Type 'true' is not assignable to type 'false'` on the assertion, then reverting.
- [x] The 2kB limit is measured in UTF-8 bytes. A test feeds 1024 three-byte characters, which `String.length` would wave through, and asserts the mock rejects at 3072 bytes.

---

## 7. Verified By Whom

| Check | Verified by | Date | Evidence |
| :--- | :--- | :--- | :--- |
| Unit suite runs with no Framer app | agent | 2026-10-11 | `npm test`, 1 file, 16 tests passed, node environment |
| Typecheck covers `src` and `test` | agent | 2026-10-11 | `npx tsc --noEmit` clean after `include` widened |
| Drift guard actually fails on drift | agent | 2026-10-11 | Deliberate rename produced `TS2322` at the assertion, reverted |
| Automated gates | agent | 2026-10-11 | `lint:css` 0 violations, `tsc --noEmit` clean, `vite build` clean |
| Mock fidelity against a live Framer app | | | **Needs a human.** The fixture shapes are typechecked against the SDK `.d.ts`, which is not the same as observing what Framer really returns at runtime |

---

## 8. Decisions And Defects Found While Building

### 8.1. The company reference mock has drifted from the SDK in three places

`.agents/skills/framer-plugin-suite/references/tdd-and-verification.md` section 2 supplies an untyped sample mock. Checked against `node_modules/framer-plugin/dist/index.d.ts` at 3.10.3:

| Reference mock returns | SDK actually declares | Consequence if copied |
| :--- | :--- | :--- |
| `getProjectInfo()` with a `slug` | `ProjectInfo` is `{ name, id, apiVersion1Id }` | Telemetry reads `undefined` for site slug |
| `getCurrentUser()` with an `email` | `User` is `{ name, id, apiVersion1Id, initials, avatarUrl? }` | See 8.2, this one is a product blocker |
| `getPublishInfo()` with `production: { url }` | `Publish` also requires `deploymentTime`, `optimizationStatus`, `currentPageUrl` | Code reading the deployment time compiles against the mock and breaks in Framer |

Source precedence puts `.agents/skills/.../references/` above the PRD, and that is honoured for every **instruction**. It does not extend to a code sample that contradicts the installed library's own type declarations. A mock that returns fields the SDK never returns is worse than having no mock: the tests go green and production reads `undefined`.

So the mock's signatures are `Pick`ed from `typeof framer` rather than written by hand. A signature change in a future SDK breaks this file at `tsc --noEmit` instead of at runtime. Two tests assert the absence of `slug` and `email` specifically, so a future edit cannot reintroduce them quietly.

**This is a defect in the shared reference and it is still there.** Fixing it is out of scope for this repo.

### 8.2. The SDK cannot supply a creator email, and PRD section 13 assumes it can

PRD section 13 lists a telemetry field `userEmail` sourced from `getCurrentUser()` and sent to `POST /api/user/site-info`. `.agents/skills/framer-plugin-suite/references/telemetry-and-tracking.md` shows the same thing in its diagram: `framer.getCurrentUser: userId, name, email`.

The SDK's `User` interface has no `email` and no other call exposes one.

This is not something a mock can paper over. It is a real gap in the F20 data contract and it affects the creator-account model in PRD section 12, because a creator identified only by a hashed id cannot be emailed about a failed payment. Three ways out, all product decisions:

1. Collect the email in the plugin at sign-up and stop treating it as SDK-derived.
2. Drop `userEmail` from the telemetry contract and key the creator account on `getCurrentUser().id`.
3. Obtain it from the payment gateway at checkout, which only works for creators who have paid.

Recorded as a blocker in the ledger. **Not resolved here, and the mock deliberately does not fake it.**

### 8.3. The mock enforces two rules rather than just permitting them

A mock usually imitates. These two cases are more useful if they refuse:

- **`getCodeFiles()` rejects in `configureManagedCollection` and `syncManagedCollection` mode.** `.agents/rules/framer-sdd-standards.md` forbids the call in those modes. Returning `[]` instead would let a missing `framer.mode` guard pass its tests and then conclude, in a real collection sync, that the site has no components at all. Rejecting turns the rule into something a test can fail.
- **`setPluginData()` rejects over 2048 bytes.** PRD section 11 sets the cap and mandates differential compression. A mock with an unbounded `Map` would let the compression tests scheduled in PRD section 16.1 pass without compressing anything.

### 8.4. The 2kB limit is bytes, and `String.length` is not

`String.length` counts UTF-16 code units. A 2048 check written against it passes a 1024-character Japanese tier name that is 3072 bytes on the wire, and Framer then rejects the write. `pluginDataByteLength` uses `TextEncoder`, and a test pins the 3072 figure. Any compression work in Phase 1 must budget in bytes.

### 8.5. Scope held to what MemberFrame calls

`FramerPluginAPI` has several hundred members. A mock claiming to implement the interface would be a lie that `tsc` would then demand be maintained. `SdkMembers` names eleven calls, and the rule is to widen it in the task that first needs a twelfth.

Request mocking is also deliberately absent. The backend does not exist, PRD section 10, so there is no contract to mock against yet. Picking a tool for it now would be guessing.

### 8.6. `CodeFile` cannot be constructed, so production code takes the narrow interface

The real `CodeFile` is a class with `#private` fields and a constructor requiring a `PluginEngine`. No test can build one.

The narrowing runs in the only safe direction. A real `CodeFile` is assignable to `MockCodeFile` because extra private members do not block structural assignment that way round; the reverse fails. So the convention for F19 Pro-Lock and F20 telemetry is that service functions accept `MockCodeFile`, never `CodeFile`, and real call sites hand over the real object unchanged with no cast.

The assertion at the foot of `framerMock.ts` proves the direction holds, and section 6 records the check that the assertion is not vacuously true.

### 8.7. `vitest.config.ts` is separate from `vite.config.ts`

`vite.config.ts` loads `@vitejs/plugin-basic-ssl`, which generates a self-signed certificate, and `vite-plugin-framer`, which rewrites the entry for the Framer host. Neither belongs in a test run. Vitest prefers `vitest.config.ts` when both exist, so the test run starts with no plugins.

The environment is `node`, not `jsdom`. Every item in layer 1 of the triad is pure logic. Rendering React components is layer 2 and needs `jsdom` plus a testing library, which is a separate dependency and a separate decision, not smuggled in here.

### 8.8. `vitest` was added, which was previously logged as a blocker

Ledger blocker B5 recorded that no test runner was installed and that adding one was unscheduled work needing approval. The user authorised task 0.8 after being told it required the dependency. Installed: `vitest` 5.0.3 as a dev dependency, 16 transitive packages, `npm audit` reporting 0 vulnerabilities. No `jsdom`, no testing library, no coverage provider. B5 is now closed for layer 1 and remains open for layer 2.

`tsconfig.json` `include` moved from `["src"]` to `["src", "test"]`, so `npm run build` typechecks the tests too. A test that no longer compiles should break the build, not sit rotting outside it.
