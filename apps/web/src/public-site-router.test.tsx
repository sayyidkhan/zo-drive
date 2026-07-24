import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { PublicSiteRouter } from "./public-site-router.js";

afterEach(() => {
  cleanup();
  window.history.replaceState({}, "", "/");
});

describe("PublicSiteRouter", () => {
  it("serves the standalone build story without routing through the application shell", () => {
    window.history.replaceState({}, "", "/how-zo-drive-is-built");

    render(<PublicSiteRouter />);

    expect(screen.getByRole("heading", { name: /A private cloud drive/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open Drive" })).toHaveAttribute("href", "http://localhost:3000/?app=1");
    expect(screen.getByLabelText("Zo Shared Drives pairing and mount architecture")).toBeInTheDocument();
  });
});
