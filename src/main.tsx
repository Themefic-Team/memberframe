import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";

// Order matters.
//   framer.css        declares the --framer-color-* runtime variables
//   design-tokens.css aliases and overrides them per theme
//   App.css           reset and body, consumes the variables above
//   components.css    every component class, consumes the variables above
//   shell.css         shell layout, overrides .framefic-shell so it comes last
import "framer-plugin/framer.css";
import "./styles/design-tokens.css";
import "./App.css";
import "./styles/components.css";
import "./styles/shell.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
