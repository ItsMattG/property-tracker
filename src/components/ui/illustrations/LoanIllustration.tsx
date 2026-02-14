export function LoanIllustration({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Bank building */}
      <path d="M30 50L60 30L90 50" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      {/* Roof bar */}
      <rect x="28" y="48" width="64" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" fill="none" />
      {/* Pillars */}
      <rect x="38" y="54" width="6" height="30" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <rect x="57" y="54" width="6" height="30" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <rect x="76" y="54" width="6" height="30" stroke="currentColor" strokeWidth="1.5" fill="none" />
      {/* Base */}
      <rect x="28" y="84" width="64" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" fill="none" />
      {/* Percent symbol */}
      <circle cx="52" cy="67" r="3" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <circle cx="68" cy="77" r="3" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <line x1="68" y1="65" x2="52" y2="79" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
