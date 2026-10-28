import React, { useState } from "react";
import { Check, ChevronRight, CreditCard, FileStack, Globe, KeyRound, Layers, Lock, Rocket } from "lucide-react";
import { Button, Checkbox, ProgressSteps, Sheet } from "./ui";
import { SETUP_STEP_IDS, type SetupDone, type SetupStepId } from "../hooks/useSetupProgress";

/**
 * The quick guide: the few steps a working membership needs, shown after every
 * sign in (product owner, 2026-10-27) until the creator ticks "Don't show this
 * again". Each step opens the place it names, so the guide is also the way
 * there. Remembered per browser in localStorage: a per-viewer convenience, and
 * a blocked storage only means the guide shows again.
 *
 * A step the project has finished shows a check (useSetupProgress reads the
 * real state), and the Home tab reopens the guide at any time.
 */
export const QUICK_GUIDE_HIDDEN_KEY = "memberframe:quick-guide-hidden";

export function quickGuideHidden(): boolean {
  try {
    return window.localStorage.getItem(QUICK_GUIDE_HIDDEN_KEY) === "1";
  } catch {
    return false;
  }
}

function rememberHidden(hidden: boolean): void {
  try {
    if (hidden) window.localStorage.setItem(QUICK_GUIDE_HIDDEN_KEY, "1");
    else window.localStorage.removeItem(QUICK_GUIDE_HIDDEN_KEY);
  } catch {
    // Blocked storage: the guide shows again next time.
  }
}

export interface QuickGuideProps {
  /** Which steps are finished, from useSetupProgress. */
  done: SetupDone;
  /** False until the first check answers: no count is shown before then. */
  known: boolean;
  onClose: () => void;
  onOpenPages: () => void;
  onOpenTiers: () => void;
  onOpenPayments: () => void;
  onOpenSignIn: () => void;
  onOpenPageLocks: () => void;
  /** Profile, Site Domains. */
  onOpenDomains: () => void;
}

interface GuideStep {
  id: SetupStepId;
  title: string;
  description: string;
  icon: React.ReactNode;
  /** Absent for a step done in Framer itself (Publish). */
  open?: () => void;
}

export const QuickGuide: React.FC<QuickGuideProps> = ({
  done,
  known,
  onClose,
  onOpenPages,
  onOpenTiers,
  onOpenPayments,
  onOpenSignIn,
  onOpenPageLocks,
  onOpenDomains,
}) => {
  // Starts from what was saved, so reopening the guide from Home and closing
  // it does not quietly undo "Don't show this again".
  const [dontShow, setDontShow] = useState(quickGuideHidden);

  /** Every way out keeps the checkbox's answer. */
  const close = (then?: () => void) => {
    rememberHidden(dontShow);
    onClose();
    then?.();
  };

  const steps: ReadonlyArray<GuideStep> = [
    {
      id: "pages",
      title: "Create the member pages",
      description: "Builder, Predefined Pages: sign in, sign up, dashboard, pricing.",
      icon: <FileStack aria-hidden={true} />,
      open: onOpenPages,
    },
    {
      id: "tiers",
      title: "Set up tiers",
      description: "Manage, Tiers: what members can pay for.",
      icon: <Layers aria-hidden={true} />,
      open: onOpenTiers,
    },
    {
      id: "payments",
      title: "Connect payments",
      description: "Manage, Payments: Stripe, Lemon Squeezy, or Razorpay.",
      icon: <CreditCard aria-hidden={true} />,
      open: onOpenPayments,
    },
    {
      id: "signIn",
      title: "Turn on sign in options",
      description: "Settings, Integration: Google, GitHub, Apple, Discord.",
      icon: <KeyRound aria-hidden={true} />,
      open: onOpenSignIn,
    },
    {
      id: "locks",
      title: "Lock your content",
      description: "Settings, Page locks: choose which tier sees each page.",
      icon: <Lock aria-hidden={true} />,
      open: onOpenPageLocks,
    },
    {
      id: "publish",
      title: "Publish your site",
      description: "Sign in, checkout, and locks run on the published site.",
      icon: <Rocket aria-hidden={true} />,
    },
    {
      id: "domain",
      title: "Add your site's domain",
      description: "Profile, Site Domains: your Framer address and any custom domain. Until then the live site stays locked.",
      icon: <Globe aria-hidden={true} />,
      open: onOpenDomains,
    },
  ];

  const count = SETUP_STEP_IDS.filter((id) => done[id]).length;

  const icon = (step: GuideStep) => (
    <span className={done[step.id] ? "step-row-icon is-done" : "step-row-icon"} aria-hidden={true}>
      {done[step.id] ? <Check /> : step.icon}
    </span>
  );
  const text = (step: GuideStep, index: number) => (
    <span className="step-row-text">
      <span className="step-row-title">
        {index + 1}. {step.title}
        {done[step.id] ? <span className="sr-only"> (done)</span> : null}
      </span>
      <span className="step-row-desc">{step.description}</span>
    </span>
  );

  return (
    <Sheet
      title="Get started with MemberFrame"
      description="Seven steps to a working membership. Click a step to go there."
      onClose={() => close()}
      footer={
        <>
          <Checkbox id="quick-guide-dont-show" checked={dontShow} onChange={setDontShow}>
            Don't show this again
          </Checkbox>
          <Button variant="primary" size="md" onClick={() => close()}>
            Got it
          </Button>
        </>
      }
    >
      {known ? (
        <div className="quick-guide-progress">
          <span className="quick-guide-progress-label">
            {count === SETUP_STEP_IDS.length ? "All set. Every step is done." : `${count} of ${SETUP_STEP_IDS.length} done`}
          </span>
          <ProgressSteps done={count} total={SETUP_STEP_IDS.length} label="Setup progress" />
        </div>
      ) : null}
      <ol className="step-list quick-guide-steps">
        {steps.map((step, index) => (
          <li key={step.title}>
            {step.open ? (
              <button type="button" className="step-row" onClick={() => close(step.open)}>
                {icon(step)}
                {text(step, index)}
                <ChevronRight className="step-row-chevron" aria-hidden={true} />
              </button>
            ) : (
              <div className="step-row is-static">
                {icon(step)}
                {text(step, index)}
              </div>
            )}
          </li>
        ))}
      </ol>
    </Sheet>
  );
};
