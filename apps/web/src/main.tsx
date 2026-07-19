import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { DriveApp } from "./drive-app.js";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <DriveApp />
  </StrictMode>
);
