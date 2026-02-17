/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { ThemeToggle } from "../ThemeToggle";
import { STORAGE_KEY } from "../ThemeProvider";

// ── Mocks ────────────────────────────────────────────────────────────

// Mock Tooltip components to avoid Radix Provider issues
vi.mock("@/components/ui/tooltip", () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children, asChild }: { children: React.ReactNode; asChild?: boolean }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <span data-testid="tooltip">{children}</span>,
}));

function mockMatchMedia(prefersDark: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query === "(prefers-color-scheme: dark)" ? prefersDark : false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

// ── Setup ────────────────────────────────────────────────────────────

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
  document.documentElement.classList.remove("dark");
  mockMatchMedia(false);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── Tests ────────────────────────────────────────────────────────────

describe("ThemeToggle", () => {
  it("renders with light mode by default", () => {
    const { getByRole } = render(<ThemeToggle />);
    const button = getByRole("button");
    expect(button).toHaveAttribute("aria-label", "Switch to dark mode");
  });

  it("reads stored theme from localStorage", () => {
    localStorage.setItem(STORAGE_KEY, "dark");
    const { getByRole } = render(<ThemeToggle />);
    const button = getByRole("button");
    expect(button).toHaveAttribute("aria-label", "Switch to system mode");
  });

  it("reads system theme from localStorage", () => {
    localStorage.setItem(STORAGE_KEY, "system");
    const { getByRole } = render(<ThemeToggle />);
    const button = getByRole("button");
    expect(button).toHaveAttribute("aria-label", "Switch to light mode");
  });

  it("cycles from light to dark on click", () => {
    const { getByRole } = render(<ThemeToggle />);
    const button = getByRole("button");

    fireEvent.click(button);

    expect(localStorage.getItem(STORAGE_KEY)).toBe("dark");
    expect(button).toHaveAttribute("aria-label", "Switch to system mode");
  });

  it("cycles from dark to system on click", () => {
    localStorage.setItem(STORAGE_KEY, "dark");
    const { getByRole } = render(<ThemeToggle />);
    const button = getByRole("button");

    fireEvent.click(button);

    expect(localStorage.getItem(STORAGE_KEY)).toBe("system");
    expect(button).toHaveAttribute("aria-label", "Switch to light mode");
  });

  it("cycles from system back to light on click", () => {
    localStorage.setItem(STORAGE_KEY, "system");
    const { getByRole } = render(<ThemeToggle />);
    const button = getByRole("button");

    fireEvent.click(button);

    expect(localStorage.getItem(STORAGE_KEY)).toBe("forest");
    expect(button).toHaveAttribute("aria-label", "Switch to dark mode");
  });

  it("completes full cycle: light -> dark -> system -> light", () => {
    const { getByRole } = render(<ThemeToggle />);
    const button = getByRole("button");

    // Light -> Dark
    fireEvent.click(button);
    expect(localStorage.getItem(STORAGE_KEY)).toBe("dark");

    // Dark -> System
    fireEvent.click(button);
    expect(localStorage.getItem(STORAGE_KEY)).toBe("system");

    // System -> Light
    fireEvent.click(button);
    expect(localStorage.getItem(STORAGE_KEY)).toBe("forest");
  });

  it("applies dark theme to DOM when clicking to dark", () => {
    const { getByRole } = render(<ThemeToggle />);
    fireEvent.click(getByRole("button"));

    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("applies system theme resolving to light when OS prefers light", () => {
    mockMatchMedia(false);
    localStorage.setItem(STORAGE_KEY, "dark");
    const { getByRole } = render(<ThemeToggle />);

    // dark -> system (OS = light)
    fireEvent.click(getByRole("button"));

    expect(localStorage.getItem(STORAGE_KEY)).toBe("system");
    expect(document.documentElement.getAttribute("data-theme")).toBeNull();
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("applies system theme resolving to dark when OS prefers dark", () => {
    mockMatchMedia(true);
    localStorage.setItem(STORAGE_KEY, "dark");
    const { getByRole } = render(<ThemeToggle />);

    // dark -> system (OS = dark)
    fireEvent.click(getByRole("button"));

    expect(localStorage.getItem(STORAGE_KEY)).toBe("system");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("ignores invalid stored theme values", () => {
    localStorage.setItem(STORAGE_KEY, "invalid-theme");
    const { getByRole } = render(<ThemeToggle />);
    const button = getByRole("button");
    // Should fall back to "forest"
    expect(button).toHaveAttribute("aria-label", "Switch to dark mode");
  });
});
