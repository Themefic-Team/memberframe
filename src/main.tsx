import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";

// Order matters.
//   framer-base.css   framer.css inside a cascade layer, so every kit class beats
//                     its bare-element rules (see the file header)
//   design-tokens.css aliases and overrides them per theme
//   App.css           reset and body, consumes the variables above
//   components.css    every component class, consumes the variables above
//   kit.css           kit extensions the reference does not cover
//   shell.css         shell layout, overrides .framefic-shell
//   builder.css       per-feature, so it comes after the classes it extends
//   manage.css        per-feature, same reason
//   settings.css      per-feature, same reason
import "./styles/framer-base.css";
import "./styles/design-tokens.css";
import "./App.css";
import "./styles/components.css";
import "./styles/kit.css";
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
