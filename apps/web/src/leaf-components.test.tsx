import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SettingsCard } from "./features/account/components/settings-card.js";
import { FunctionWorkspaceTabs } from "./features/functions/components/function-workspace-tabs.js";
import { CodeBlock } from "./features/public-site/components/code-block.js";
import { ZominAiCheck } from "./features/zomin-ai/components/zomin-ai-check.js";
import { EmptyState } from "./shared/components/empty-state.js";

describe("extracted leaf components", () => {
  it("renders documentation code without changing its label or content", () => {
    render(<CodeBlock code="zo-drive upload launch.pdf" label="CLI" />);
    expect(screen.getByText("CLI")).toBeInTheDocument();
    expect(screen.getByText("zo-drive upload launch.pdf")).toBeInTheDocument();
  });

  it("renders account settings content and the danger treatment", () => {
    const { container } = render(<SettingsCard danger description="Permanent action" icon={<span>!</span>} title="Danger zone"><button>Delete</button></SettingsCard>);
    expect(screen.getByRole("heading", { name: "Danger zone" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
    expect(container.firstElementChild).toHaveClass("border-red-200");
  });

  it("preserves ZominAI ready and unavailable status treatments", () => {
    const { rerender } = render(<ZominAiCheck label="Zo Computer runtime" result={{ detail: "Ready", ready: true }} />);
    expect(screen.getByText("Ready").closest("div")?.parentElement).toHaveClass("border-emerald-200");
    rerender(<ZominAiCheck label="Zo Computer runtime" result={{ detail: "Unavailable", ready: false }} />);
    expect(screen.getByText("Unavailable").closest("div")?.parentElement).toHaveClass("border-amber-200");
  });

  it("keeps function tab selection, disabled state, and callbacks", () => {
    const onChange = vi.fn();
    render(<FunctionWorkspaceTabs activeTab="editor" disabled onChange={onChange} />);
    expect(screen.getByRole("tab", { name: "Editor" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Function runs" })).toBeDisabled();
    fireEvent.click(screen.getByRole("tab", { name: "Editor" }));
    expect(onChange).toHaveBeenCalledWith("editor");
  });

  it("keeps empty-state copy and action behaviour", () => {
    const onAction = vi.fn();
    render(<EmptyState action="Upload" description="Add your first file." onAction={onAction} title="No files" />);
    expect(screen.getByRole("heading", { name: "No files" })).toBeInTheDocument();
    expect(screen.getByText("Add your first file.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Upload" }));
    expect(onAction).toHaveBeenCalledOnce();
  });
});
