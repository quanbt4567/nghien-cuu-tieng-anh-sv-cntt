interface SpeakItLogoProps {
  showWordmark?: boolean;
  size?: "sm" | "md";
}

export function SpeakItLogo({ showWordmark = true, size = "md" }: SpeakItLogoProps) {
  const iconSize = size === "sm" ? 26 : 34;

  return (
    <span className="inline-flex items-center gap-2 select-none">
      <svg
        width={iconSize}
        height={iconSize}
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className="shrink-0 drop-shadow-[0_0_10px_rgba(34,211,238,0.5)]"
      >
        <defs>
          <linearGradient id="sit-bubble" x1="4" y1="4" x2="36" y2="34" gradientUnits="userSpaceOnUse">
            <stop stopColor="#22D3EE" />
            <stop offset="1" stopColor="#6366F1" />
          </linearGradient>
        </defs>
        <path
          d="M10 4h20a7 7 0 0 1 7 7v12a7 7 0 0 1-7 7H21l-8 6.5V30h-3a7 7 0 0 1-7-7V11a7 7 0 0 1 7-7Z"
          fill="url(#sit-bubble)"
        />
        <path
          d="M10 5h20"
          stroke="rgba(255,255,255,0.55)"
          strokeWidth="1"
          strokeLinecap="round"
        />
        <path
          d="M15.5 12.5 9.5 17l6 4.5"
          stroke="#FFFFFF"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M24.5 12.5 30.5 17l-6 4.5"
          stroke="#FFFFFF"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <rect x="18.8" y="13" width="2.4" height="8" rx="1.2" fill="#FDE68A" />
      </svg>
      {showWordmark && (
        <span className="text-lg font-extrabold tracking-tight text-white leading-none">
          Speak<span className="text-cyan-300">IT</span>
        </span>
      )}
    </span>
  );
}
