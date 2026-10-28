import React from "react";
import {
  ChevronRight,
  CreditCard,
  FileText,
  Layers,
  List,
  ListChecks,
  Lock,
  Mail,
  Plus,
  ShieldCheck,
} from "lucide-react";
import {
  Banner,
  Button,
  HelpTile,
  HelpTileRow,
  HeroCard,
  PluginCard,
  PluginCardList,
  ProgressSteps,
} from "../ui";
import { BRANDING, HELP_LINKS, SIBLING_PLUGINS } from "../../config/branding";
import { useConnection } from "../../hooks/useConnection";
import { SETUP_STEP_IDS } from "../../hooks/useSetupProgress";

export interface HomeTabProps {
  onOpenBuilder: () => void;
  /** Settings, Page locks: where pages and sections are locked to a tier. */
  onOpenPageLocks: () => void;
  /** Manage, Tiers. */
  onOpenTiers: () => void;
  /** Manage, Payments: Stripe, Lemon Squeezy, Razorpay. */
  onOpenPayments: () => void;
  onOpenConnect: () => void;
  /** Opens the quick guide (QuickGuide.tsx), whenever the creator wants it. */
  onOpenGuide: () => void;
  /** Steps finished, from useSetupProgress; null until the first check answers. */
  setupDone: number | null;
}

interface QuickStep {
  label: string;
  description: string;
  icon: React.ReactNode;
  onClick: () => void;
}

/**
 * The Home tab. PRD task 2.7, layout in section 7.3.
 *
 * Its ledger row carries F02 because PRD section 15.4 puts it there, but the
 * content is panel chrome rather than member administration, so it is
 * documented in `00-plugin-shell.md` section 9.
 *
 * ## It now knows one thing, and only one
 *
 * Whether the project is connected. That is the single fact the panel can
 * establish without guessing, and it is the one that matters most: every other
 * tile leads somewhere that does nothing until it is true. So an unconnected
 * project gets a banner pointing at the account view, and the three tiles stay
 * exactly as stateless as they were.
 *
 * ## It still does not claim to know the rest
 *
 * The obvious quick start is a checklist with ticks: tier created, gateway
 * connected, frame gated. Every one of those facts lives behind the backend,
 * which does not exist (blocker B1), and two of them are unknowable from the
 * panel even once it does: whether a frame on the canvas carries a gate needs
 * `getCodeFiles` plus a canvas walk, and whether a tier exists needs a creator
 * token that no task builds (conflict C10).
 *
 * A checklist with three permanently unticked boxes reads as a broken product.
 * So these are three routes, not three states: each tile says where to go, and
 * none of them asserts anything about progress. Two of the three are now
 * knowable in principle, since the backend and a creator token both exist, and
 * making them real is a separate piece of work rather than something to sneak
 * in here.
 *
 * ## The setup guide, with real progress
 *
 * The first Quick Start row reopens the quick guide at any time and shows how
 * many of its six steps are done. The count comes from useSetupProgress, which
 * reads the project and the site (pages, tiers, gateways, sign in providers,
 * locks, publishing), so a tick means the thing exists, not that a row was
 * clicked. Shown only once connected: before then no step can be done.
 *
 * ## Foundations layout
 *
 * Hero card, Quick start, Help, More from Framefic, in that order, per the
 * Pixelfic shell Home tab and `.agents/rules/design-system.md` section 7.
 * The routes used to sit in Help tiles, which the Content doc reserves for
 * Guide, Contact us, and Changelog links out. They are step rows now, and
 * the Help row carries the docs links the PRD asks for.
 *
 * ## One primary CTA
 *
 * "Open builder", per PRD section 7.3. The other two tiles and the two footer
 * links are secondary affordances, so the tab has exactly one `.primary-cta`.
 */
export const HomeTab: React.FC<HomeTabProps> = ({
  onOpenBuilder,
  onOpenPageLocks,
  onOpenTiers,
  onOpenPayments,
  onOpenConnect,
  onOpenGuide,
  setupDone,
}) => {
  const { state } = useConnection();
  const total = SETUP_STEP_IDS.length;
  const steps: ReadonlyArray<QuickStep> = [
    {
      label: "Gate a frame",
      description: "Lock content behind a member tier.",
      icon: <Lock aria-hidden={true} />,
      onClick: onOpenPageLocks,
    },
    {
      label: "Set up tiers",
      description: "Choose what members pay for.",
      icon: <Layers aria-hidden={true} />,
      onClick: onOpenTiers,
    },
    {
      label: "Connect payments",
      description: "Add Stripe, Lemon Squeezy, or Razorpay.",
      icon: <CreditCard aria-hidden={true} />,
      onClick: onOpenPayments,
    },
  ];

  return (
    <div className="home-tab-container">
      {/*
        Only while loading is unknown; "loading" shows nothing rather than
        flashing a warning at a creator who is in fact connected.
      */}
      {state.status === "disconnected" ? (
        <Banner
          tone="warning"
          title="Try MemberFrame free for 7 days"
          message="Sign up to unlock the builder, members, and payments. No card needed."
          action={{ label: "Start free trial", onClick: onOpenConnect }}
        />
      ) : null}

      <HeroCard
        title="Welcome to MemberFrame"
        description="Gate any frame, sell a membership, and manage members without leaving the canvas."
        illustration={<ShieldCheck />}
        action={
          <Button variant="primary" size="md" className="fill" onClick={onOpenBuilder}>
            <Plus aria-hidden={true} />
            Open builder
          </Button>
        }
      />

      <section className="section-group">
        <h2 className="section-title">Quick Start</h2>
        <div className="step-list">
          {state.status === "connected" ? (
            <button type="button" className="step-row" aria-haspopup="dialog" onClick={onOpenGuide}>
              <span className="step-row-icon" aria-hidden={true}>
                <ListChecks />
              </span>
              <span className="step-row-text">
                <span className="step-row-title">Setup guide</span>
                <span className="step-row-desc">
                  {setupDone === null
                    ? "Six steps to a working membership."
                    : setupDone === total
                      ? `All ${total} steps done.`
                      : `${setupDone} of ${total} steps done.`}
                </span>
                {setupDone !== null ? (
                  <ProgressSteps className="home-setup-progress" done={setupDone} total={total} label="Setup progress" />
                ) : null}
              </span>
              <ChevronRight className="step-row-chevron" aria-hidden={true} />
            </button>
          ) : null}
          {steps.map((step) => (
            <button key={step.label} type="button" className="step-row" onClick={step.onClick}>
              <span className="step-row-icon" aria-hidden={true}>
                {step.icon}
              </span>
              <span className="step-row-text">
                <span className="step-row-title">{step.label}</span>
                <span className="step-row-desc">{step.description}</span>
              </span>
              <ChevronRight className="step-row-chevron" aria-hidden={true} />
            </button>
          ))}
        </div>
      </section>

      <section className="section-group">
        <h2 className="section-title">Help</h2>
        <HelpTileRow>
          <HelpTile label="Guide" icon={<FileText />} href={HELP_LINKS.guide} />
          <HelpTile label="Contact us" icon={<Mail />} href={HELP_LINKS.contact} />
          <HelpTile label="Changelog" icon={<List />} href={HELP_LINKS.changelog} />
        </HelpTileRow>
      </section>

      <section className="section-group">
        <h2 className="section-title">More From {BRANDING.companyName}</h2>
        <PluginCardList>
          {SIBLING_PLUGINS.map((plugin) => (
            <PluginCard
              key={plugin.id}
              name={plugin.name}
              description={plugin.description}
              logo={<img src={plugin.logo} alt="" className="framefic-card-logo-img" />}
              href={plugin.href}
            />
          ))}
        </PluginCardList>
      </section>
    </div>
  );
};
