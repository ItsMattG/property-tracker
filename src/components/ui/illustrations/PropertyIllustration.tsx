export function PropertyIllustration({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* House body */}
      <rect x="30" y="55" width="60" height="45" rx="3" stroke="currentColor" strokeWidth="2" fill="none" />
      {/* Roof */}
      <path d="M25 58L60 30L95 58" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      {/* Door */}
      <rect x="50" y="72" width="20" height="28" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none" />
      {/* Door handle */}
      <circle cx="66" cy="86" r="1.5" fill="currentColor" />
      {/* Left window */}
      <rect x="36" y="64" width="12" height="10" rx="1" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <line x1="42" y1="64" x2="42" y2="74" stroke="currentColor" strokeWidth="1" />
      <line x1="36" y1="69" x2="48" y2="69" stroke="currentColor" strokeWidth="1" />
      {/* Right window */}
      <rect x="72" y="64" width="12" height="10" rx="1" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <line x1="78" y1="64" x2="78" y2="74" stroke="currentColor" strokeWidth="1" />
      <line x1="72" y1="69" x2="84" y2="69" stroke="currentColor" strokeWidth="1" />
      {/* Chimney */}
      <rect x="75" y="35" width="8" height="18" stroke="currentColor" strokeWidth="1.5" fill="none" />
    </svg>
  );
}
