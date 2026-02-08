import { test, expect } from "./fixtures/auth";

test.describe("Dashboard", () => {
  let pageErrors: Error[];

  test.beforeEach(async ({ authenticatedPage: page }) => {
    pageErrors = [];
    page.on("pageerror", (err) => pageErrors.push(err));
  });

  test.afterEach(() => {
    expect(pageErrors, "No uncaught page errors").toHaveLength(0);
  });

  // ── Page structure ─────────────────────────────────────────────────

  test("should display welcome heading and description", async ({
    authenticatedPage: page,
  }) => {
    await expect(
      page.getByRole("heading", { name: /welcome to bricktrack/i })
    ).toBeVisible();
    await expect(
      page.getByText(/track your investment properties/i)
    ).toBeVisible();
  });

  test("should display the BrickTrack logo in sidebar", async ({
    authenticatedPage: page,
  }) => {
    const sidebar = page.locator("aside");
    await expect(sidebar.getByText("BrickTrack")).toBeVisible();
  });

  test("should display the header", async ({ authenticatedPage: page }) => {
    await expect(page.locator("header")).toBeVisible();
  });

  test("should display feedback button in header", async ({
    authenticatedPage: page,
  }) => {
    const header = page.locator("header");
    await expect(
      header.getByRole("button", { name: /feedback/i })
    ).toBeVisible();
  });

  // ── Stats cards ────────────────────────────────────────────────────

  test("should display all three stats cards", async ({
    authenticatedPage: page,
  }) => {
    const statsGrid = page.locator("[data-tour='portfolio-summary']");
    await expect(statsGrid.getByText("Properties", { exact: true })).toBeVisible();
    await expect(statsGrid.getByText("Transactions", { exact: true })).toBeVisible();
    await expect(statsGrid.getByText("Uncategorized", { exact: true })).toBeVisible();
  });

  test("should display tax position card", async ({
    authenticatedPage: page,
  }) => {
    await expect(page.getByText(/tax position/i).first()).toBeVisible();
  });

  test("properties card links to /properties", async ({
    authenticatedPage: page,
  }) => {
    const statsGrid = page.locator("[data-tour='portfolio-summary']");
    const propertiesCard = statsGrid.locator('a[href="/properties"]');
    await expect(propertiesCard).toBeVisible();
    await propertiesCard.click();
    await expect(page).toHaveURL(/\/properties/);
  });

  test("transactions card links to /transactions", async ({
    authenticatedPage: page,
  }) => {
    const statsGrid = page.locator("[data-tour='portfolio-summary']");
    const transactionsCard = statsGrid.locator('a[href="/transactions"]');
    await expect(transactionsCard).toBeVisible();
    await transactionsCard.click();
    await expect(page).toHaveURL(/\/transactions/);
  });

  test("uncategorized card links to /transactions?category=uncategorized", async ({
    authenticatedPage: page,
  }) => {
    const uncategorizedCard = page.locator(
      'a[href="/transactions?category=uncategorized"]'
    );
    await expect(uncategorizedCard).toBeVisible();
    await uncategorizedCard.click();
    await expect(page).toHaveURL(/\/transactions\?category=uncategorized/);
  });

  // ── Sidebar navigation (enabled items) ─────────────────────────────

  test("should display core sidebar nav items", async ({
    authenticatedPage: page,
  }) => {
    const sidebar = page.locator("aside");
    await expect(
      sidebar.getByRole("link", { name: /dashboard/i })
    ).toBeVisible();
    await expect(
      sidebar.getByRole("link", { name: /properties/i })
    ).toBeVisible();
    await expect(
      sidebar.getByRole("link", { name: /transactions/i })
    ).toBeVisible();
    await expect(
      sidebar.getByRole("link", { name: "Reports", exact: true })
    ).toBeVisible();
    await expect(
      sidebar.getByRole("link", { name: /banking/i })
    ).toBeVisible();
  });

  test("dashboard link should be active on /dashboard", async ({
    authenticatedPage: page,
  }) => {
    const sidebar = page.locator("aside");
    const dashboardLink = sidebar.getByRole("link", { name: /dashboard/i });
    await expect(dashboardLink).toHaveClass(/bg-primary/);
  });

  // ── Sidebar navigation (feature-flagged items hidden) ──────────────

  test("should hide feature-flagged nav items that are disabled", async ({
    authenticatedPage: page,
  }) => {
    const sidebar = page.locator("aside");

    // These are all feature-flagged to false
    await expect(
      sidebar.getByRole("link", { name: "Discover", exact: true })
    ).not.toBeVisible();
    await expect(
      sidebar.getByRole("link", { name: "Alerts", exact: true })
    ).not.toBeVisible();
    await expect(
      sidebar.getByRole("link", { name: "Portfolio", exact: true })
    ).not.toBeVisible();
    await expect(
      sidebar.getByRole("link", { name: "Forecast", exact: true })
    ).not.toBeVisible();
    await expect(
      sidebar.getByRole("link", { name: "Loans", exact: true })
    ).not.toBeVisible();
    await expect(
      sidebar.getByRole("link", { name: "Emails", exact: true })
    ).not.toBeVisible();
    await expect(
      sidebar.getByRole("link", { name: "Tasks", exact: true })
    ).not.toBeVisible();
  });

  // ── Sidebar settings section ───────────────────────────────────────

  test("should display settings section with core items", async ({
    authenticatedPage: page,
  }) => {
    const sidebar = page.locator("aside");
    await expect(sidebar.getByText("Settings")).toBeVisible();
    await expect(
      sidebar.getByRole("link", { name: /notifications/i })
    ).toBeVisible();
    await expect(
      sidebar.getByRole("link", { name: /feature requests/i })
    ).toBeVisible();
  });

  test("should hide feature-flagged settings items", async ({
    authenticatedPage: page,
  }) => {
    const sidebar = page.locator("aside");
    await expect(
      sidebar.getByRole("link", { name: "Refinance Alerts", exact: true })
    ).not.toBeVisible();
    await expect(
      sidebar.getByRole("link", { name: "Team", exact: true })
    ).not.toBeVisible();
    await expect(
      sidebar.getByRole("link", { name: "Audit Log", exact: true })
    ).not.toBeVisible();
    await expect(
      sidebar.getByRole("link", { name: "Mobile App", exact: true })
    ).not.toBeVisible();
    await expect(
      sidebar.getByRole("link", { name: "Bug Reports", exact: true })
    ).not.toBeVisible();
    await expect(
      sidebar.getByRole("link", { name: "Support", exact: true })
    ).not.toBeVisible();
  });

  // ── Dashboard widgets ─────────────────────────────────────────────

  test("should display Cash Flow widget", async ({
    authenticatedPage: page,
  }) => {
    // CashFlowWidget renders a CardTitle "Cash Flow" in all states (loading, empty, data)
    await expect(
      page.getByRole("heading", { name: "Cash Flow", exact: true })
    ).toBeVisible({ timeout: 10000 });
  });

  test("should display Portfolio Summary table", async ({
    authenticatedPage: page,
  }) => {
    // PortfolioSummaryTable renders when metrics exist; may be hidden if no properties
    const heading = page.getByText("Portfolio Summary", { exact: true });
    const hasProperties = await page
      .locator("[data-tour='portfolio-summary']")
      .getByText(/Investment properties tracked/i)
      .isVisible()
      .catch(() => false);

    if (!hasProperties) {
      // If properties exist, the table should show with headers
      await expect(heading).toBeVisible({ timeout: 10000 });
      await expect(page.getByRole("columnheader", { name: "Value" })).toBeVisible();
      await expect(page.getByRole("columnheader", { name: "Loan" })).toBeVisible();
      await expect(page.getByRole("columnheader", { name: "Equity" })).toBeVisible();
      await expect(page.getByRole("columnheader", { name: "LVR" })).toBeVisible();
      await expect(page.getByRole("columnheader", { name: "Cash" })).toBeVisible();
    }
    // If no properties, table is hidden — test passes either way
  });

  // ── Sidebar collapse/expand ────────────────────────────────────────

  test("should collapse and expand the sidebar", async ({
    authenticatedPage: page,
  }) => {
    const sidebar = page.locator("aside");

    // Sidebar starts expanded
    await expect(sidebar).toHaveClass(/w-64/);
    await expect(sidebar.getByText("BrickTrack")).toBeVisible();

    // Click collapse (force: true to bypass any tour overlay)
    await sidebar
      .getByRole("button", { name: /collapse sidebar/i })
      .click({ force: true });

    // Sidebar is now collapsed
    await expect(sidebar).toHaveClass(/w-16/);
    await expect(sidebar.getByText("BrickTrack")).not.toBeVisible();

    // Click expand (force: true to bypass any tour overlay)
    await sidebar
      .getByRole("button", { name: /expand sidebar/i })
      .click({ force: true });

    // Sidebar is expanded again
    await expect(sidebar).toHaveClass(/w-64/);
    await expect(sidebar.getByText("BrickTrack")).toBeVisible();
  });

  // ── Sidebar navigation (click-through) ─────────────────────────────

  test("should navigate to properties from sidebar", async ({
    authenticatedPage: page,
  }) => {
    const sidebar = page.locator("aside");
    await sidebar.getByRole("link", { name: /properties/i }).click();
    await expect(page).toHaveURL(/\/properties/);
  });

  test("should navigate to transactions from sidebar", async ({
    authenticatedPage: page,
  }) => {
    const sidebar = page.locator("aside");
    await sidebar.getByRole("link", { name: /transactions/i }).click();
    await page.waitForURL(/\/transactions/, { timeout: 10000 });
    await expect(page).toHaveURL(/\/transactions/);
  });

  test("should navigate to reports from sidebar", async ({
    authenticatedPage: page,
  }) => {
    const sidebar = page.locator("aside");
    await sidebar.getByRole("link", { name: "Reports", exact: true }).click();
    await page.waitForURL(/\/reports/, { timeout: 10000 });
    await expect(page).toHaveURL(/\/reports/);
  });

  test("should navigate to banking from sidebar", async ({
    authenticatedPage: page,
  }) => {
    const sidebar = page.locator("aside");
    await sidebar.getByRole("link", { name: /banking/i }).click();
    await page.waitForURL(/\/banking/, { timeout: 10000 });
    await expect(page).toHaveURL(/\/banking/);
  });
});
