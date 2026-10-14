import React from "react";
import {
  BookOpen,
  CreditCard,
  Layers,
  LifeBuoy,
  Lock,
  Plus,
  Sparkles,
} from "lucide-react";
import { Banner, Button } from "../ui";
import { BRANDING } from "../../config/branding";
import { useConnection } from "../../hooks/useConnection";

export interface HomeTabProps {
  onOpenBuilder: () => void;
  onOpenManage: () => void;
  onOpenSettings: () => void;
  onOpenConnect: () => void;
}

interface QuickStep {
  label: string;
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
 * project gets a banner pointing at the Connect tab, and the three tiles stay
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
 * ## One primary CTA
 *
 * "Open builder", per PRD section 7.3. The other two tiles and the two footer
 * links are secondary affordances, so the tab has exactly one `.primary-cta`.
 */
export const HomeTab: React.FC<HomeTabProps> = ({
  onOpenBuilder,
  onOpenManage,
  onOpenSettings,
  onOpenConnect,
}) => {
  const { state } = useConnection();
  const steps: ReadonlyArray<QuickStep> = [
    { label: "Gate a frame", icon: <Lock aria-hidden={true} />, onClick: onOpenBuilder },
    { label: "Set up tiers", icon: <Layers aria-hidden={true} />, onClick: onOpenManage },
    { label: "Connect payments", icon: <CreditCard aria-hidden={true} />, onClick: onOpenSettings },
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
          title="Not connected yet"
          message="Connect this Framer project to start storing members."
          action={{ label: "Connect", onClick: onOpenConnect }}
        />
      ) : null}

      <section className="hero-card">
        <div className="hero-card-content">
          <h1 className="hero-card-title">Membership, Inside Framer</h1>
          <p className="hero-card-desc">
            Gate any frame, sell a membership, and manage members without leaving the canvas.
          </p>
        </div>
        <Button variant="primary" size="md" className="fill" onClick={onOpenBuilder}>
          <Plus aria-hidden={true} />
          Open builder
        </Button>
      </section>

      <section className="section-group">
        <h2 className="section-title">Quick Start</h2>
        <div className="help-tile-row">
          {steps.map((step) => (
            <button key={step.label} type="button" className="help-tile" onClick={step.onClick}>
              <span className="help-tile-icon-box">{step.icon}</span>
              <span className="help-tile-label">{step.label}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="section-group">
        <h2 className="section-title">Learn More</h2>
        <div className="framefic-card-list">
          {/*
            External links open in a new tab. The panel is an iframe inside the
            Framer app, and navigating it away would replace the plugin with a
            web page and no way back.
          */}
          <a
            className="framefic-card"
            href={`${BRANDING.companyUrl}/memberframe/docs`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <span className="framefic-card-logo" aria-hidden={true}>
              <BookOpen />
            </span>
            <span className="framefic-card-info">
              <span className="framefic-card-name">Documentation</span>
              <span className="framefic-card-desc">
                Setup guides, gating patterns, and the component reference.
              </span>
            </span>
          </a>

          <a
            className="framefic-card"
            href={`${BRANDING.companyUrl}/support`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <span className="framefic-card-logo" aria-hidden={true}>
              <LifeBuoy />
            </span>
            <span className="framefic-card-info">
              <span className="framefic-card-name">Get Support</span>
              <span className="framefic-card-desc">
                Ask a question or report something that looks wrong.
              </span>
            </span>
          </a>

          <a
            className="framefic-card"
            href={BRANDING.companyUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            <span className="framefic-card-logo" aria-hidden={true}>
              <Sparkles />
            </span>
            <span className="framefic-card-info">
              <span className="framefic-card-name">More From {BRANDING.companyName}</span>
              <span className="framefic-card-desc">
                Other plugins built to the same standard as this one.
              </span>
            </span>
          </a>
        </div>
      </section>
    </div>
  );
};
