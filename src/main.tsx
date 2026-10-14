import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";

// Order matters.
//   framer.css        declares the --framer-color-* runtime variables
//   design-tokens.css aliases and overrides them per theme
//   App.css           reset and body, consumes the variables above
//   components.css    every component class, consumes the variables above
//   shell.css         shell layout, overrides .framefic-shell
//   builder.css       per-feature, so it comes after the classes it extends
//   manage.css        per-feature, same reason
//   settings.css      per-feature, same reason
import "framer-plugin/framer.css";
import "./styles/design-tokens.css";
import "./App.css";
import "./styles/components.css";
import "./styles/shell.css";
import "./styles/builder.css";
import "./styles/manage.css";
import "./styles/settings.css";
import "./styles/connect.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
