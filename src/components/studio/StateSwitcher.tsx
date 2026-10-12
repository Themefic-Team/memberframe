import React from "react";
import { Segmented } from "../ui";
import { SIMULATED_STATES, type SimulatedState } from "../../hooks/useMemberSession";

export interface StateSwitcherProps {
  value: SimulatedState;
  onChange: (state: SimulatedState) => void;
}

const OPTIONS = SIMULATED_STATES.map((state) => ({
  value: state.value,
  label: state.label,
}));

/**
 * The five-state switcher, PRD section 7.4. Guest, Free, Silver, VIP, Failed.
 *
 * Thin by design: the state list, the labels, and the captions all live in
 * `useMemberSession` so the switcher and the fixtures cannot drift apart. Adding
 * a sixth state means editing one array there, not two files here.
 */
export const StateSwitcher: React.FC<StateSwitcherProps> = ({ value, onChange }) => (
  <Segmented
    label="Simulated member state"
    options={OPTIONS}
    value={value}
    onChange={onChange}
  />
);
