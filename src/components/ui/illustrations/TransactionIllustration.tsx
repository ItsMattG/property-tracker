export function TransactionIllustration({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Receipt body */}
      <path
        d="M35 20H85V95L79 90L73 95L67 90L60 95L53 90L47 95L41 90L35 95V20Z"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
      />
      {/* Header line */}
      <line x1="45" y1="34" x2="75" y2="34" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      {/* Lines */}
      <line x1="45" y1="46" x2="65" y2="46" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
      <line x1="70" y1="46" x2="75" y2="46" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
      <line x1="45" y1="55" x2="60" y2="55" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
      <line x1="70" y1="55" x2="75" y2="55" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
      <line x1="45" y1="64" x2="68" y2="64" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
      <line x1="70" y1="64" x2="75" y2="64" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
      {/* Divider */}
      <line x1="45" y1="74" x2="75" y2="74" stroke="currentColor" strokeWidth="1" strokeDasharray="3 2" opacity="0.4" />
      {/* Total */}
      <line x1="45" y1="82" x2="55" y2="82" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="65" y1="82" x2="75" y2="82" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
