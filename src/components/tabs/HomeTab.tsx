import React from "react";
import { Sparkles } from "lucide-react";
import { Button, EmptyState } from "../ui";

export interface HomeTabProps {
  onOpenBuilder: () => void;
}

/**
 * Placeholder. The hero card, quick-start guide, docs tiles, and cross-promo
 * cards land here later.
 *
 * "Open builder" is the Home tab's one primary CTA, PRD section 7.3, and it
 * already works: it moves to the Builder tab. The other three tabs show no
 * action yet rather than a button that goes nowhere.
 */
export const HomeTab: React.FC<HomeTabProps> = ({ onOpenBuilder }) => (
  <EmptyState
    icon={<Sparkles aria-hidden={true} />}
    title="Welcome To MemberFrame"
    description="Gate any frame, sell a membership, and manage members without leaving Framer."
    action={
      <Button variant="primary" onClick={onOpenBuilder}>
        Open builder
      </Button>
    }
  />
);
