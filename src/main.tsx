import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";

// Order matters. framer.css defines the --framer-color-* runtime variables,
// design-tokens.css then aliases and overrides them per theme, and App.css
// holds only the reset and app layout.
import "framer-plugin/framer.css";
import "./styles/design-tokens.css";
import "./App.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
