/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ReceiptScanner } from "../ReceiptScanner";

// Mock tRPC
vi.mock("@/lib/trpc/client", () => ({
  trpc: {
    documentExtraction: {
      getRemainingScans: {
        useQuery: vi.fn().mockReturnValue({
          data: { used: 2, limit: 5, remaining: 3 },
        }),
      },
      listPendingReviews: {
        useQuery: vi.fn().mockReturnValue({ data: [] }),
      },
      confirmTransaction: {
        useMutation: vi.fn().mockReturnValue({
          mutate: vi.fn(),
          isPending: false,
        }),
      },
      discardExtraction: {
        useMutation: vi.fn().mockReturnValue({
          mutate: vi.fn(),
          isPending: false,
        }),
      },
    },
    documents: {
      getUploadUrl: {
        useMutation: vi.fn().mockReturnValue({
          mutateAsync: vi.fn(),
          isPending: false,
        }),
      },
      create: {
        useMutation: vi.fn().mockReturnValue({
          mutateAsync: vi.fn(),
          isPending: false,
        }),
      },
    },
    useUtils: vi.fn().mockReturnValue({
      documentExtraction: {
        getExtraction: { fetch: vi.fn() },
        listPendingReviews: { invalidate: vi.fn() },
        getRemainingScans: { invalidate: vi.fn() },
      },
      transaction: {
        list: { invalidate: vi.fn() },
      },
    }),
  },
}));

// Mock sonner
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

describe("ReceiptScanner", () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
  };

  it("renders dialog when open", () => {
    render(<ReceiptScanner {...defaultProps} />);
    expect(screen.getByText("Scan Receipt")).toBeInTheDocument();
  });

  it("shows remaining scan count for free tier", () => {
    render(<ReceiptScanner {...defaultProps} />);
    expect(screen.getByText(/3 scans remaining/i)).toBeInTheDocument();
  });

  it("shows file input with camera capture", () => {
    render(<ReceiptScanner {...defaultProps} />);
    const fileInput = document.querySelector('input[type="file"]');
    expect(fileInput).toBeInTheDocument();
    expect(fileInput).toHaveAttribute("accept", "image/jpeg,image/png,image/heic,application/pdf");
  });

  it("renders nothing when closed", () => {
    render(<ReceiptScanner {...defaultProps} open={false} />);
    expect(screen.queryByText("Scan Receipt")).not.toBeInTheDocument();
  });

  it("calls onOpenChange when dialog closes", () => {
    const onOpenChange = vi.fn();
    render(<ReceiptScanner {...defaultProps} onOpenChange={onOpenChange} />);
    // Dialog close button
    const closeButton = screen.getByRole("button", { name: /close/i });
    fireEvent.click(closeButton);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
