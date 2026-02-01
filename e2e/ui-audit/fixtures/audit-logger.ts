import type { AuditFinding } from "./demo-account";

/**
 * Utility class for aggregating and summarizing audit findings.
 */
export class AuditLogger {
  private findings: AuditFinding[] = [];

  /**
   * Add a finding to the log.
   */
  add(finding: AuditFinding): void {
    this.findings.push(finding);
  }

  /**
   * Get all findings.
   */
  getFindings(): AuditFinding[] {
    return [...this.findings];
  }

  /**
   * Get findings filtered by severity.
   */
  getBySeverity(severity: AuditFinding["severity"]): AuditFinding[] {
    return this.findings.filter((f) => f.severity === severity);
  }

  /**
   * Get findings filtered by page.
   */
  getByPage(page: string): AuditFinding[] {
    return this.findings.filter((f) => f.page === page);
  }

  /**
   * Get summary counts by severity.
   */
  getSummary(): { critical: number; major: number; minor: number; suggestion: number; total: number } {
    return {
      critical: this.findings.filter((f) => f.severity === "critical").length,
      major: this.findings.filter((f) => f.severity === "major").length,
      minor: this.findings.filter((f) => f.severity === "minor").length,
      suggestion: this.findings.filter((f) => f.severity === "suggestion").length,
      total: this.findings.length,
    };
  }

  /**
   * Clear all findings.
   */
  clear(): void {
    this.findings = [];
  }
}
