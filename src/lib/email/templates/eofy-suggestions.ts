export function eofySuggestionsSubject(): string {
  return "EOFY Tax Optimization Suggestions";
}

export function eofySuggestionsTemplate(data: {
  suggestionCount: number;
  financialYear: string;
}): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>EOFY Tax Suggestions</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="color: #1a1a1a;">EOFY is approaching!</h1>

  <p style="color: #666; font-size: 16px; line-height: 1.5;">
    We've found <strong>${data.suggestionCount}</strong> tax optimization suggestion${data.suggestionCount !== 1 ? "s" : ""}
    for ${data.financialYear} that could help you maximize your deductions.
  </p>

  <div style="background: #f5f5f5; border-radius: 8px; padding: 20px; margin: 20px 0;">
    <p style="margin: 0; color: #666;">
      Review your suggestions before June 30 to ensure you don't miss out on potential tax savings.
    </p>
  </div>

  <a href="${process.env.NEXT_PUBLIC_APP_URL}/reports/tax"
     style="display: inline-block; background: #0066cc; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500;">
    View Suggestions
  </a>

  <p style="color: #999; font-size: 14px; margin-top: 30px;">
    BrickTrack - Smart property investment tracking
  </p>
</body>
</html>
  `.trim();
}
