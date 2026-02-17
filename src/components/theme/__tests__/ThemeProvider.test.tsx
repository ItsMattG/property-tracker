/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { render, act } from "@testing-library/react";
import {
  ThemeProvider,
  applyTheme,
  resolveEffectiveTheme,
  STORAGE_KEY,
  type Theme,
} from "../ThemeProvider";

// ── Helpers ──────────────────────────────────────────────────────────

let matchMediaListeners: Array<(e: MediaQueryListEvent) => void> = [];

function mockMatchMedia(prefersDark: boolean) {
  const listeners: Array<(e: MediaQueryListEvent) => void> = [];
  matchMediaListeners = listeners;

  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query === "(prefers-color-scheme: dark)" ? prefersDark : false,
      media: query,
      addEventListener: vi.fn((_event: string, handler: (e: MediaQueryListEvent) => void) => {
        listeners.push(handler);
      }),
      removeEventListener: vi.fn((_event: string, handler: (e: MediaQueryListEvent) => void) => {
        const index = listeners.indexOf(handler);
        if (index >= 0) listeners.splice(index, 1);
      }),
      dispatchEvent: vi.fn(),
    })),
  });
}

function simulateOSChange(prefersDark: boolean) {
  matchMediaListeners.forEach((handler) =>
    handler({ matches: prefersDark } as MediaQueryListEvent)
  );
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

// ── resolveEffectiveTheme ────────────────────────────────────────────

describe("resolveEffectiveTheme", () => {
  it("returns 'forest' for forest theme", () => {
    expect(resolveEffectiveTheme("forest")).toBe("forest");
  });

  it("returns 'dark' for dark theme", () => {
    expect(resolveEffectiveTheme("dark")).toBe("dark");
  });

  it("returns 'dark' when system and OS prefers dark", () => {
    mockMatchMedia(true);
    expect(resolveEffectiveTheme("system")).toBe("dark");
  });

  it("returns 'forest' when system and OS prefers light", () => {
    mockMatchMedia(false);
    expect(resolveEffectiveTheme("system")).toBe("forest");
  });
});

// ── applyTheme ───────────────────────────────────────────────────────

describe("applyTheme", () => {
  it("sets data-theme=dark and adds .dark class for dark theme", () => {
    applyTheme("dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(localStorage.getItem(STORAGE_KEY)).toBe("dark");
  });

  it("removes data-theme and .dark class for forest theme", () => {
    applyTheme("dark");
    applyTheme("forest");
    expect(document.documentElement.getAttribute("data-theme")).toBeNull();
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(localStorage.getItem(STORAGE_KEY)).toBe("forest");
  });

  it("resolves system theme to dark when OS prefers dark", () => {
    mockMatchMedia(true);
    applyTheme("system");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(localStorage.getItem(STORAGE_KEY)).toBe("system");
  });

  it("resolves system theme to light when OS prefers light", () => {
    mockMatchMedia(false);
    applyTheme("system");
    expect(document.documentElement.getAttribute("data-theme")).toBeNull();
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(localStorage.getItem(STORAGE_KEY)).toBe("system");
  });
});

// ── ThemeProvider ────────────────────────────────────────────────────

describe("ThemeProvider", () => {
  it("applies stored theme from localStorage on mount", () => {
    localStorage.setItem(STORAGE_KEY, "dark");
    render(<ThemeProvider>content</ThemeProvider>);
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("falls back to forest when no stored theme", () => {
    render(<ThemeProvider>content</ThemeProvider>);
    expect(document.documentElement.getAttribute("data-theme")).toBeNull();
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("uses server-provided theme when nothing in localStorage", () => {
    render(<ThemeProvider theme="dark">content</ThemeProvider>);
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("prefers localStorage over server theme prop", () => {
    localStorage.setItem(STORAGE_KEY, "forest");
    render(<ThemeProvider theme="dark">content</ThemeProvider>);
    expect(document.documentElement.getAttribute("data-theme")).toBeNull();
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("applies system theme based on OS preference", () => {
    mockMatchMedia(true);
    localStorage.setItem(STORAGE_KEY, "system");
    render(<ThemeProvider>content</ThemeProvider>);
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("listens for OS color scheme changes when theme is system", () => {
    mockMatchMedia(false);
    localStorage.setItem(STORAGE_KEY, "system");
    render(<ThemeProvider>content</ThemeProvider>);

    // Initially light
    expect(document.documentElement.classList.contains("dark")).toBe(false);

    // Simulate OS switching to dark
    act(() => simulateOSChange(true));
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);

    // Simulate OS switching back to light
    act(() => simulateOSChange(false));
    expect(document.documentElement.getAttribute("data-theme")).toBeNull();
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("does not listen for OS changes when theme is not system", () => {
    localStorage.setItem(STORAGE_KEY, "dark");
    render(<ThemeProvider>content</ThemeProvider>);

    // Simulate OS change - should have no effect
    act(() => simulateOSChange(false));
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("renders children", () => {
    const { getByText } = render(
      <ThemeProvider>
        <span>child content</span>
      </ThemeProvider>
    );
    expect(getByText("child content")).toBeTruthy();
  });
});
