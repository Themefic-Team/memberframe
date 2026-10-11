import React from "react";
import { Blocks } from "lucide-react";
import { EmptyState } from "../ui";

/**
 * Placeholder. The component picker, Live Preview Studio, five-state switcher,
 * and the customizer land here in PRD tasks 1.1 to 1.3, with "Add to canvas" as
 * this tab's one primary CTA.
 */
export const BuilderTab: React.FC = () => (
  <EmptyState
    icon={<Blocks aria-hidden={true} />}
    title="Builder"
    description="Pick a component, preview it against a simulated member, then add it to the canvas."
  />
);
