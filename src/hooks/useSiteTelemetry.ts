import { useState, useEffect } from "react";
import { framer } from "framer-plugin";
import { FramerSiteTelemetry } from "../types";

export function useSiteTelemetry(): FramerSiteTelemetry {
  const [telemetry, setTelemetry] = useState<FramerSiteTelemetry>({
    mode: "canvas",
  });

  useEffect(() => {
    async function inspectEnvironment() {
      try {
        const mode = (framer.mode as "canvas" | "image" | "hosted") || "canvas";
        let siteId = "local_dev_workspace";
        let siteName = "MemberFrame Project";

        // Framer Plugin API allows reading project details or selection
        if (typeof framer.getPluginData === "function") {
          const storedSiteId = await framer.getPluginData("memberframe_site_id");
          if (storedSiteId) {
            siteId = storedSiteId;
          } else {
            // Generate deterministic or random project identifier
            siteId = `mf_${Math.random().toString(36).substring(2, 9)}`;
            await framer.setPluginData("memberframe_site_id", siteId);
          }
        }

        setTelemetry({
          siteId,
          siteName,
          mode,
          componentsCount: 0,
        });
      } catch (err) {
        console.warn("[MemberFrame Telemetry] Running in preview environment:", err);
      }
    }

    inspectEnvironment();
  }, []);

  return telemetry;
}
