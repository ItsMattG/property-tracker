/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ScoreIndicator } from "../ScoreIndicator";

describe("ScoreIndicator", () => {
  it("renders the label and value", () => {
    render(
      <ScoreIndicator label="Gross Yield" value="5.2%" percentile={80} />
    );

    expect(screen.getByText("Gross Yield")).toBeInTheDocument();
    expect(screen.getByText("5.2%")).toBeInTheDocument();
  });

  it("shows 'Excellent' status for percentile above 75", () => {
    render(
      <ScoreIndicator label="Yield" value="6.0%" percentile={90} />
    );

    expect(screen.getByText("Excellent")).toBeInTheDocument();
  });

  it("shows 'Average' status for percentile between 25 and 75", () => {
    render(
      <ScoreIndicator label="Yield" value="4.0%" percentile={50} />
    );

    expect(screen.getByText("Average")).toBeInTheDocument();
  });

  it("shows 'Below Average' status for percentile below 25", () => {
    render(
      <ScoreIndicator label="Yield" value="2.0%" percentile={10} />
    );

    expect(screen.getByText("Below Average")).toBeInTheDocument();
  });

  it("shows 'N/A' status when percentile is null", () => {
    render(
      <ScoreIndicator label="Yield" value="--" percentile={null} />
    );

    expect(screen.getByText("N/A")).toBeInTheDocument();
  });

  it("renders a progressbar with correct aria attributes", () => {
    render(
      <ScoreIndicator label="Expense Ratio" value="30%" percentile={65} />
    );

    const progressbar = screen.getByRole("progressbar");
    expect(progressbar).toHaveAttribute("aria-valuenow", "65");
    expect(progressbar).toHaveAttribute("aria-valuemin", "0");
    expect(progressbar).toHaveAttribute("aria-valuemax", "100");
  });

  it("renders progressbar with 0 width when percentile is null", () => {
    render(
      <ScoreIndicator label="Yield" value="--" percentile={null} />
    );

    const progressbar = screen.getByRole("progressbar");
    expect(progressbar).toHaveAttribute("aria-valuenow", "0");
    expect(progressbar.style.width).toBe("0%");
  });

  it("applies custom className", () => {
    const { container } = render(
      <ScoreIndicator
        label="Yield"
        value="5%"
        percentile={50}
        className="mt-4"
      />
    );

    const wrapper = container.firstElementChild;
    expect(wrapper?.className).toContain("mt-4");
  });

  it("renders at boundary: percentile exactly 75 shows Average", () => {
    render(
      <ScoreIndicator label="Yield" value="4.5%" percentile={75} />
    );

    expect(screen.getByText("Average")).toBeInTheDocument();
  });

  it("renders at boundary: percentile exactly 25 shows Average", () => {
    render(
      <ScoreIndicator label="Yield" value="3.0%" percentile={25} />
    );

    expect(screen.getByText("Average")).toBeInTheDocument();
  });
});
