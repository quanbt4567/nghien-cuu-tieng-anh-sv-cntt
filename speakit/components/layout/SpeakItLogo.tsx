interface SpeakItLogoProps {
  showWordmark?: boolean;
  size?: "sm" | "md";
}

export function SpeakItLogo({ showWordmark = true, size = "md" }: SpeakItLogoProps) {
  const iconSize = size === "sm" ? 24 : 32;

  return (
    <span className="inline-flex items-center gap-2 select-none">
      <svg
        width={iconSize}
        height={iconSize}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className="shrink-0 drop-shadow-[0_0_10px_rgba(6,182,212,0.35)]"
      >
        <rect
          x="1"
          y="1"
          width="30"
          height="30"
          rx="9"
          fill="#0B1633"
          stroke="rgba(103, 232, 249, 0.55)"
          strokeWidth="1.25"
        />
        <path
          d="M5 2.5 H27"
          stroke="rgba(255, 255, 255, 0.45)"
          strokeWidth="1"
          strokeLinecap="round"
        />
        <rect x="7" y="13" width="2.5" height="6" rx="1.25" fill="#22D3EE" />
        <rect x="11.5" y="9" width="2.5" height="14" rx="1.25" fill="#34D399" />
        <rect x="16" y="6" width="2.5" height="20" rx="1.25" fill="#FFFFFF" />
        <rect x="20.5" y="10" width="2.5" height="12" rx="1.25" fill="#34D399" />
        <rect x="25" y="13.5" width="2.5" height="5" rx="1.25" fill="#22D3EE" />
      </svg>
      {showWordmark && (
        <span className="text-lg font-extrabold tracking-tight text-white leading-none">
          Speak<span className="text-cyan-400">IT</span>
        </span>
      )}
    </span>
  );
}
