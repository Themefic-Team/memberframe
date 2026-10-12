import React, { useCallback, useState } from "react";
import { Plus } from "lucide-react";
import { framer } from "framer-plugin";
import { Banner, Button, FieldRow, FieldRows, Select, Slider, TextField, useToast } from "../ui";
import {
  deployCanvasComponent,
  generateMemberAuthCode,
  generateMemberGateCode,
} from "../../services";
import { DEFAULT_MEMBER_AUTH_CONFIG } from "../../types/canvas";
import {
  CANVAS_COMPONENTS,
  DEFAULT_COMPONENT_ID,
  PreviewStudio,
  findComponent,
  type CanvasComponentEntry,
  type CanvasComponentId,
} from "../studio";
import { MemberSessionProvider } from "../../hooks/useMemberSession";
import {
  BLUR_MAX,
  BLUR_MIN,
  DEFAULT_MEMBER_GATE_CONFIG,
  FALLBACK_ACTION_LABELS,
  visibleGateRows,
  type GateFallbackAction,
  type MemberGateConfig,
} from "../../types/canvas";
import { REQUIRED_TIER_LABELS, type RequiredTier } from "../../types/member";

const COMPONENT_OPTIONS = CANVAS_COMPONENTS.map((component) => ({
  value: component.id,
  label: component.name,
}));

/**
 * `anyone` is omitted. A gate set to "Anyone" is entitled by definition, so it
 * gates nothing: the creator would be inserting a component that does no work.
 * The resolver still handles the value, because F09 and F07 need an ungated
 * branch, but it is not something to offer here.
 */
const REQUIRED_TIER_OPTIONS: ReadonlyArray<{ value: RequiredTier; label: string }> = [
  "signed_in",
  "free_member",
  "tier_1",
  "tier_2",
  "vip",
].map((key) => ({
  value: key as RequiredTier,
  label: REQUIRED_TIER_LABELS[key as RequiredTier],
}));

const FALLBACK_OPTIONS: ReadonlyArray<{ value: GateFallbackAction; label: string }> = (
  ["blur", "hide", "redirect", "custom_card"] as const
).map((action) => ({ value: action, label: FALLBACK_ACTION_LABELS[action] }));

/**
 * The Builder tab. PRD tasks 1.3 and 1.5, layout in section 7.4.
 *
 * Picker, then the Live Preview Studio, then the customizer, then exactly one
 * primary CTA. The order is the PRD's and it matters: a creator changes a field
 * and the thing directly above it moves.
 *
 * The customizer edits a draft of F01's property controls, which is why this
 * task spans F01 and F04. The rows mirror F01's `hidden` predicates, so the
 * panel offers exactly what Framer's sidebar will offer after insertion.
 */
export const BuilderTab: React.FC = () => {
  const [componentId, setComponentId] = useState<CanvasComponentId>(DEFAULT_COMPONENT_ID);
  const [gateConfig, setGateConfig] = useState<MemberGateConfig>(DEFAULT_MEMBER_GATE_CONFIG);
  const [deploying, setDeploying] = useState(false);
  /**
   * Title and message only, not the service's `DeployFailure`.
   *
   * The reason code is for a caller that branches on it, and this one does not:
   * every failure renders the same banner. Storing the narrower shape means the
   * catch below does not have to invent a reason code for an error that did not
   * come from the deploy path at all.
   */
  const [failure, setFailure] = useState<{ title: string; message: string } | null>(null);
  const showToast = useToast();

  const patch = useCallback(
    <Key extends keyof MemberGateConfig>(key: Key, value: MemberGateConfig[Key]) =>
      setGateConfig((current) => ({ ...current, [key]: value })),
    []
  );

  const entry = findComponent(componentId);
  const isGate = entry.id === "member_gate";
  const rows = visibleGateRows(gateConfig.fallbackAction);

  /**
   * Task 1.5. Generate the component, write it, insert it.
   *
   * A finished action is a toast and a persistent problem is a banner, per the
   * UI kit's own convention, so a failure stays on screen until the creator
   * fixes it or succeeds. The toast copy is kept under the 45 character limit
   * the kit warns about.
   */
  const handleAddToCanvas = useCallback(async () => {
    setDeploying(true);
    setFailure(null);

    try {
      /*
        Task 2.5 made this plural. The gate carries the creator's customizer
        values; Member Auth is inserted with its defaults and configured in
        Framer's properties panel, because its panel customizer is not built.
        Both go through the same generator core and the same deploy path.
      */
      const generated =
        entry.id === "member_auth"
          ? generateMemberAuthCode(DEFAULT_MEMBER_AUTH_CONFIG)
          : generateMemberGateCode(gateConfig);

      const outcome = await deployCanvasComponent(framer, generated);

      if (outcome.ok) {
        showToast({
          tone: "success",
          message: `${entry.name} ${outcome.action === "created" ? "added" : "updated"}`,
        });
      } else {
        setFailure(outcome);
      }
    } catch (error) {
      // `generateMemberGateCode` throws only on a repo defect, and the deploy
      // path returns outcomes rather than throwing. Anything arriving here is
      // unexpected, so it is reported rather than swallowed.
      setFailure({
        title: "Could not add the component",
        message: error instanceof Error ? error.message : "An unexpected error stopped the insert.",
      });
    } finally {
      setDeploying(false);
    }
  }, [entry, gateConfig, showToast]);

  return (
    <MemberSessionProvider>
      <div className="tab-panel-body">
        <FieldRows>
          <FieldRow label="Component" htmlFor="builder-component" fill>
            <Select
              id="builder-component"
              value={componentId}
              options={COMPONENT_OPTIONS}
              onChange={setComponentId}
              fill
            />
          </FieldRow>
        </FieldRows>

        <PreviewStudio componentId={componentId} gateConfig={gateConfig} />

        {isGate ? (
          <FieldRows>
            <FieldRow label="Required tier" htmlFor="gate-required-tier">
              <Select
                id="gate-required-tier"
                value={gateConfig.requiredTier}
                options={REQUIRED_TIER_OPTIONS}
                onChange={(value) => patch("requiredTier", value)}
                fill
              />
            </FieldRow>

            <FieldRow label="Locked state" htmlFor="gate-fallback">
              <Select
                id="gate-fallback"
                value={gateConfig.fallbackAction}
                options={FALLBACK_OPTIONS}
                onChange={(value) => patch("fallbackAction", value)}
                fill
              />
            </FieldRow>

            {rows.blur ? (
              <FieldRow label="Blur amount" htmlFor="gate-blur">
                <Slider
                  id="gate-blur"
                  value={gateConfig.blurIntensity}
                  min={BLUR_MIN}
                  max={BLUR_MAX}
                  unit="px"
                  onChange={(value) => patch("blurIntensity", value)}
                />
              </FieldRow>
            ) : null}

            {rows.redirect ? (
              <FieldRow label="Redirect target" htmlFor="gate-redirect" fill>
                <TextField
                  id="gate-redirect"
                  value={gateConfig.redirectUrl}
                  placeholder="/sign-in"
                  onChange={(value) => patch("redirectUrl", value)}
                  fill
                />
              </FieldRow>
            ) : null}

            {rows.card ? (
              <>
                <FieldRow label="Lock title" htmlFor="gate-card-title" fill>
                  <TextField
                    id="gate-card-title"
                    value={gateConfig.cardTitle}
                    onChange={(value) => patch("cardTitle", value)}
                    fill
                  />
                </FieldRow>

                <FieldRow label="Lock message" htmlFor="gate-card-description" fill>
                  <TextField
                    id="gate-card-description"
                    value={gateConfig.cardDescription}
                    onChange={(value) => patch("cardDescription", value)}
                    fill
                  />
                </FieldRow>
              </>
            ) : null}
          </FieldRows>
        ) : null}

        {failure ? (
          <Banner tone="danger" title={failure.title} message={failure.message} />
        ) : null}

        {/*
          The tab's one and only `.primary-cta`, per PRD section 7.5.

          Live from task 1.5. It is still disabled for the fourteen components
          that are not authored yet: the generator has nothing to emit for them,
          and a button that reports a failure the creator cannot fix is worse
          than one that is plainly not ready.
        */}
        <div className="studio-cta">
          <Button
            variant="primary"
            size="md"
            className="fill"
            disabled={!entry.deployable || deploying}
            onClick={handleAddToCanvas}
          >
            <Plus aria-hidden={true} />
            {deploying ? "Adding" : "Add to canvas"}
          </Button>
          <p className="studio-cta-note">{ctaNote(entry, isGate)}</p>
        </div>
      </div>
    </MemberSessionProvider>
  );
};

/**
 * The line under the CTA.
 *
 * Three cases, because after task 2.5 there are three. A deployable component
 * with a customizer says what the button writes; a deployable component without
 * one says where to configure it; an unauthored component names the task that
 * will build it, so an inert button reads as a schedule rather than a defect.
 */
function ctaNote(entry: CanvasComponentEntry, hasCustomizer: boolean): string {
  if (!entry.deployable) return `${entry.name} arrives with task ${entry.task}.`;

  if (hasCustomizer) {
    return "Writes MemberGate.tsx into this project and inserts one instance.";
  }

  return `Inserts ${entry.name} with its defaults. Configure it in the Framer properties panel.`;
}
