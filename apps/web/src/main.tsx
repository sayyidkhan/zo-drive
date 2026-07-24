import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { PublicSiteRouter } from "./public-site-router.js";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <PublicSiteRouter />
  </StrictMode>
);
