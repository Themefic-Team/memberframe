/**
 * Standalone Code Component Generator
 * Uses Vite's native ?raw imports to provide 100% accurate, pristine code files
 * directly from src/canvas-components/ without string-escaping issues.
 */

import memberGateRaw from "../canvas-components/MemberGate.tsx?raw";
import memberAuthRaw from "../canvas-components/MemberAuth.tsx?raw";
import memberDashboardRaw from "../canvas-components/MemberDashboard.tsx?raw";
import meteredPaywallRaw from "../canvas-components/MeteredPaywall.tsx?raw";
import cmsGatedTemplateRaw from "../canvas-components/CMSGatedTemplate.tsx?raw";
import protectedDownloadRaw from "../canvas-components/ProtectedDownload.tsx?raw";
import courseProgressRaw from "../canvas-components/CourseProgress.tsx?raw";
import donationSliderRaw from "../canvas-components/DonationSlider.tsx?raw";

const COMPONENT_SOURCES: Record<string, string> = {
  MemberGate: memberGateRaw,
  MemberAuth: memberAuthRaw,
  MemberDashboard: memberDashboardRaw,
  MeteredPaywall: meteredPaywallRaw,
  CMSGatedTemplate: cmsGatedTemplateRaw,
  ProtectedDownload: protectedDownloadRaw,
  CourseProgress: courseProgressRaw,
  DonationSlider: donationSliderRaw,
};

export function getCanvasComponentSource(componentName: string): string {
  if (COMPONENT_SOURCES[componentName]) {
    return COMPONENT_SOURCES[componentName];
  }

  return `import React from "react";\nimport { addPropertyControls, ControlType } from "framer";\n\nexport default function ${componentName}() {\n  return <div>${componentName} Active</div>;\n}`;
}
