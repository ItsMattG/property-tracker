/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MilestoneModal } from "../MilestoneModal";
import type { MilestoneDefinition } from "@/server/services/milestone/types";

// Mock SharePrompt to avoid tRPC context requirement
vi.mock("@/components/referral/SharePrompt", () => ({
  SharePrompt: ({ milestoneLabel, onDismiss }: { milestoneLabel: string; onDismiss: () => void }) => (
    <div data-testid="share-prompt">
      <span>{milestoneLabel}</span>
      <button onClick={onDismiss}>Dismiss Share</button>
    </div>
  ),
}));

const mockMilestone: MilestoneDefinition = {
  id: "first-property",
  category: "portfolio",
  label: "First Property Added",
  description: "You've added your first investment property",
  check: () => true,
};

describe("MilestoneModal", () => {
  it("renders nothing when milestone is null", () => {
    const handleDismiss = vi.fn();
    render(
      <MilestoneModal milestone={null} onDismiss={handleDismiss} />,
    );
    // Dialog should not be open — no label text should be in the document
    expect(screen.queryByText("First Property Added")).not.toBeInTheDocument();
  });

  it("renders milestone label and description when open", () => {
    const handleDismiss = vi.fn();
    render(
      <MilestoneModal milestone={mockMilestone} onDismiss={handleDismiss} />,
    );
    expect(screen.getByText("First Property Added")).toBeInTheDocument();
    expect(
      screen.getByText("You've added your first investment property"),
    ).toBeInTheDocument();
  });

  it("shows a Continue button when open", () => {
    const handleDismiss = vi.fn();
    render(
      <MilestoneModal milestone={mockMilestone} onDismiss={handleDismiss} />,
    );
    expect(screen.getByRole("button", { name: "Continue" })).toBeInTheDocument();
  });

  it("calls onDismiss when Continue button is clicked", () => {
    const handleDismiss = vi.fn();
    render(
      <MilestoneModal milestone={mockMilestone} onDismiss={handleDismiss} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(handleDismiss).toHaveBeenCalledTimes(1);
  });
});
