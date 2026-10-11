import React, { useEffect } from "react";
import { framer } from "framer-plugin";

export const App: React.FC = () => {
  useEffect(() => {
    try {
      framer.showUI({ position: "top right", width: 360, height: 640 });
    } catch {
      // Running in standalone browser dev preview
    }
  }, []);

  return (
    <main className="app">
      <h1>MemberFrame</h1>
      <p>Fresh start. Build from here.</p>
    </main>
  );
};
