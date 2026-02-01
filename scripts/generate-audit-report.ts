import * as fs from "fs/promises";
import * as path from "path";

interface AuditFinding {
  page: string;
  element: string;
  state: string;
  issue?: string;
  severity?: "critical" | "major" | "minor" | "suggestion";
  screenshot?: string;
}

interface AuditSummary {
  critical: number;
  major: number;
  minor: number;
  suggestion: number;
  total: number;
}

async function generateReport(): Promise<void> {
  const projectRoot = process.cwd();
  const auditLogPath = path.join(projectRoot, "e2e/ui-audit/results/audit-log.json");
  const screenshotsDir = path.join(projectRoot, "e2e/ui-audit/results/screenshots");
  const outputPath = path.join(projectRoot, "docs/ui-ux-audit-report.md");

  // Read audit log
  let findings: AuditFinding[] = [];
  try {
    const data = await fs.readFile(auditLogPath, "utf-8");
    findings = JSON.parse(data);
    console.log(`Loaded ${findings.length} findings from audit log`);
  } catch {
    console.log("No audit log found at", auditLogPath);
    console.log("Run the UI audit tests first: npm run test:ui-audit");
  }

  // Get screenshots
  let screenshots: string[] = [];
  try {
    screenshots = await fs.readdir(screenshotsDir);
    console.log(`Found ${screenshots.length} screenshots`);
  } catch {
    console.log("No screenshots directory found");
  }

  // Calculate summary
  const summary: AuditSummary = {
    critical: findings.filter((f) => f.severity === "critical").length,
    major: findings.filter((f) => f.severity === "major").length,
    minor: findings.filter((f) => f.severity === "minor").length,
    suggestion: findings.filter((f) => f.severity === "suggestion").length,
    total: findings.length,
  };

  // Group findings by page
  const byPage = new Map<string, AuditFinding[]>();
  for (const finding of findings) {
    const page = finding.page || "unknown";
    if (!byPage.has(page)) {
      byPage.set(page, []);
    }
    byPage.get(page)!.push(finding);
  }

  // Group findings by severity
  const bySeverity = {
    critical: findings.filter((f) => f.severity === "critical"),
    major: findings.filter((f) => f.severity === "major"),
    minor: findings.filter((f) => f.severity === "minor"),
    suggestion: findings.filter((f) => f.severity === "suggestion"),
  };

  // Generate markdown report
  const now = new Date().toISOString().split("T")[0];

  let md = `# PropertyTracker UI/UX Audit Report

**Generated:** ${now}
**Pages Audited:** ${byPage.size}
**Total Findings:** ${summary.total}
**Screenshots Captured:** ${screenshots.length}

## Executive Summary

| Severity | Count | Description |
|----------|-------|-------------|
| Critical | ${summary.critical} | Blocks user from completing task |
| Major | ${summary.major} | Significantly degrades experience |
| Minor | ${summary.minor} | Polish/consistency issue |
| Suggestion | ${summary.suggestion} | Enhancement opportunity |

`;

  // Add status indicator
  if (summary.critical > 0) {
    md += `\n> **Status:** Action required - ${summary.critical} critical issue(s) found\n\n`;
  } else if (summary.major > 0) {
    md += `\n> **Status:** Attention needed - ${summary.major} major issue(s) found\n\n`;
  } else if (summary.total === 0) {
    md += `\n> **Status:** No issues found (or no audit data available)\n\n`;
  } else {
    md += `\n> **Status:** Good - Only minor issues and suggestions\n\n`;
  }

  md += `---

## Findings by Severity

`;

  // Critical findings
  if (bySeverity.critical.length > 0) {
    md += `### Critical Issues (Blocks user flow)

`;
    for (const finding of bySeverity.critical) {
      md += `- **${finding.page}** - ${finding.element} (${finding.state}): ${finding.issue || "No description"}\n`;
    }
    md += "\n";
  } else {
    md += `### Critical Issues
None found.

`;
  }

  // Major findings
  if (bySeverity.major.length > 0) {
    md += `### Major Issues (Degrades experience)

`;
    for (const finding of bySeverity.major) {
      md += `- **${finding.page}** - ${finding.element} (${finding.state}): ${finding.issue || "No description"}\n`;
    }
    md += "\n";
  } else {
    md += `### Major Issues
None found.

`;
  }

  // Minor findings
  if (bySeverity.minor.length > 0) {
    md += `### Minor Issues (Polish/consistency)

`;
    for (const finding of bySeverity.minor) {
      md += `- **${finding.page}** - ${finding.element} (${finding.state}): ${finding.issue || "No description"}\n`;
    }
    md += "\n";
  } else {
    md += `### Minor Issues
None found.

`;
  }

  // Suggestions
  if (bySeverity.suggestion.length > 0) {
    md += `### Suggestions (Nice to have)

`;
    for (const finding of bySeverity.suggestion) {
      md += `- **${finding.page}** - ${finding.element} (${finding.state}): ${finding.issue || "No description"}\n`;
    }
    md += "\n";
  } else {
    md += `### Suggestions
None found.

`;
  }

  md += `---

## Findings by Page

`;

  // Sort pages alphabetically
  const sortedPages = [...byPage.keys()].sort();

  for (const page of sortedPages) {
    const pageFindings = byPage.get(page)!;
    md += `### ${page}

`;
    if (pageFindings.length === 0) {
      md += "No issues found.\n\n";
    } else {
      md += "| Element | State | Issue | Severity |\n";
      md += "|---------|-------|-------|----------|\n";
      for (const finding of pageFindings) {
        const issue = finding.issue?.replace(/\|/g, "\\|") || "-";
        md += `| ${finding.element} | ${finding.state} | ${issue} | ${finding.severity || "-"} |\n`;
      }
      md += "\n";
    }
  }

  md += `---

## Screenshots

Screenshots are stored in \`e2e/ui-audit/results/screenshots/\`.

`;

  if (screenshots.length > 0) {
    // Group screenshots by page
    const screenshotsByPage = new Map<string, string[]>();
    for (const screenshot of screenshots.sort()) {
      const parts = screenshot.split("-");
      const pageName = parts[0] || "misc";
      if (!screenshotsByPage.has(pageName)) {
        screenshotsByPage.set(pageName, []);
      }
      screenshotsByPage.get(pageName)!.push(screenshot);
    }

    for (const [pageName, pageScreenshots] of screenshotsByPage) {
      md += `**${pageName}:**\n`;
      for (const screenshot of pageScreenshots) {
        md += `- \`${screenshot}\`\n`;
      }
      md += "\n";
    }
  } else {
    md += "No screenshots captured yet.\n\n";
  }

  md += `---

## Recommendations

Based on the audit findings, prioritize fixes in this order:

1. **Critical Issues** - Fix immediately, these block users from completing tasks
2. **Major Issues** - Fix in next sprint, these significantly hurt user experience
3. **Minor Issues** - Address when touching related code
4. **Suggestions** - Nice to have, consider for future improvements

### Quick Wins

`;

  // Identify quick wins (minor issues that are easy to fix)
  const quickWins = findings.filter(
    (f) =>
      f.severity === "minor" &&
      (f.issue?.toLowerCase().includes("label") ||
        f.issue?.toLowerCase().includes("button") ||
        f.issue?.toLowerCase().includes("link"))
  );

  if (quickWins.length > 0) {
    for (const finding of quickWins.slice(0, 5)) {
      md += `- ${finding.page}: ${finding.issue}\n`;
    }
  } else {
    md += "No obvious quick wins identified.\n";
  }

  md += `

---

*Report generated by PropertyTracker UI Audit System*
*Run \`npm run ui-audit:full\` to regenerate this report*
`;

  // Write report
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, md);

  console.log("\n=== Report Generated ===");
  console.log(`Output: ${outputPath}`);
  console.log(`Summary: ${summary.critical} critical, ${summary.major} major, ${summary.minor} minor, ${summary.suggestion} suggestions`);
}

// Run
generateReport().catch((error) => {
  console.error("Failed to generate report:", error);
  process.exit(1);
});
