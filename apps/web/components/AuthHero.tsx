export function AuthHeroIllustration({ className = "" }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 400 260" fill="none">
      <path d="M0 214h400" stroke="rgba(255,255,255,.08)" strokeWidth="1" />
      <path d="M28 206C120 206 128 118 226 108S332 54 366 26" stroke="#fb923c" strokeWidth="3" strokeLinecap="round" strokeDasharray="1 12" opacity=".85" />
      <circle cx="28" cy="206" r="7" fill="#10b981" />
      <circle cx="28" cy="206" r="12" stroke="#10b981" strokeOpacity=".35" strokeWidth="2" />
      <g transform="translate(345,4)">
        <path d="M18 0C8 0 0 8 0 18c0 13.5 18 32 18 32s18-18.5 18-32C36 8 28 0 18 0Z" fill="#f97316" />
        <circle cx="18" cy="18" r="7" fill="white" />
      </g>
      <g transform="translate(158,118)">
        <circle cx="42" cy="42" r="42" fill="rgba(249,115,22,.14)" />
        <circle cx="42" cy="42" r="42" stroke="rgba(251,146,60,.3)" />
        <g transform="translate(20,26)" stroke="#fed7aa" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 24h28l-4-10H10l-6 10Z" fill="#fb923c" fillOpacity=".18" />
          <path d="M8 14l2-6h8l4 6" />
          <circle cx="6" cy="27" r="5" />
          <circle cx="28" cy="27" r="5" />
          <path d="M14 8h6" />
        </g>
      </g>
      <circle cx="70" cy="46" r="2" fill="#fdba74" opacity=".7" />
      <circle cx="120" cy="30" r="1.6" fill="#fdba74" opacity=".55" />
      <circle cx="98" cy="66" r="1.6" fill="#fdba74" opacity=".4" />
    </svg>
  );
}
